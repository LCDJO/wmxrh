/**
 * EPI Compliance Service
 *
 * Cross-module integration with Occupational Risk, NR Training,
 * Safety Automation and Workforce Intelligence.
 */

import { supabase } from '@/integrations/supabase/client';
import type { EpiRiskMapping, ExpiredEpiResult } from './types';
import { scanExpiredEpis, markDeliveryExpired } from './delivery.service';

// ═══════════════════════════════════════════════════════
// RISK MAPPING (EPI ↔ Risco Ocupacional)
// ═══════════════════════════════════════════════════════

export async function getRequiredEpisForRisk(
  tenantId: string,
  riskAgent: string,
): Promise<EpiRiskMapping[]> {
  const { data, error } = await supabase
    .from('epi_risk_mappings' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('risk_agent', riskAgent);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EpiRiskMapping[];
}

export async function createRiskMapping(
  tenantId: string,
  epiCatalogId: string,
  riskAgent: string,
  nrAplicavel?: number,
  obrigatorio = true,
  descricao?: string,
): Promise<EpiRiskMapping> {
  const { data, error } = await supabase
    .from('epi_risk_mappings' as any)
    .insert({
      tenant_id: tenantId,
      epi_catalog_id: epiCatalogId,
      risk_agent: riskAgent,
      nr_aplicavel: nrAplicavel ?? null,
      obrigatorio,
      descricao: descricao ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar mapeamento EPI/Risco: ${error.message}`);
  return data as unknown as EpiRiskMapping;
}

// ═══════════════════════════════════════════════════════
// EMPLOYEE COMPLIANCE CHECK
// ═══════════════════════════════════════════════════════

export interface EpiComplianceResult {
  employee_id: string;
  compliant: boolean;
  missing_epis: { epi_catalog_id: string; epi_nome: string; risk_agent: string }[];
  expired_epis: ExpiredEpiResult[];
  unsigned_deliveries: string[];
}

interface RiskExposureRow {
  id: string;
  agente_risco: string;
}

interface RiskMappingRow {
  epi_catalog_id: string;
  risk_agent: string;
}

interface DeliveryRow {
  id: string;
  epi_catalog_id: string;
  status: string;
  data_validade: string | null;
}

interface EpiCatalogRow {
  id: string;
  nome: string;
}

interface SignatureRow {
  delivery_id: string;
}

export async function checkEmployeeEpiCompliance(
  tenantId: string,
  employeeId: string,
): Promise<EpiComplianceResult> {
  // 1. Get employee's active risk exposures
  const { data: exposures } = await supabase
    .from('employee_risk_exposures')
    .select('id, agente_risco')
    .eq('employee_id', employeeId)
    .eq('is_active', true)
    .is('deleted_at', null);

  const riskAgents = ((exposures ?? []) as unknown as RiskExposureRow[]).map(e => e.agente_risco);

  // 2. Get required EPIs for those risks
  const { data: mappings } = await supabase
    .from('epi_risk_mappings' as 'epi_risk_mappings')
    .select('epi_catalog_id, risk_agent')
    .eq('tenant_id', tenantId)
    .eq('obrigatorio', true)
    .in('risk_agent', riskAgents.length > 0 ? riskAgents : ['__none__']);

  // 3. Get employee's active EPI deliveries
  const { data: deliveries } = await supabase
    .from('epi_deliveries' as 'epi_deliveries')
    .select('id, epi_catalog_id, status, data_validade')
    .eq('employee_id', employeeId)
    .eq('status', 'entregue');

  const typedDeliveries = (deliveries ?? []) as unknown as DeliveryRow[];
  const activeEpiIds = new Set(typedDeliveries.map(d => d.epi_catalog_id));

  // 4. Check for missing EPIs
  const typedMappings = (mappings ?? []) as unknown as RiskMappingRow[];
  const missingRaw = typedMappings.filter(m => !activeEpiIds.has(m.epi_catalog_id));

  // Fetch names for missing
  const missingEpiIds = [...new Set(missingRaw.map(m => m.epi_catalog_id))];
  let epiNames: Record<string, string> = {};
  if (missingEpiIds.length > 0) {
    const { data: catalogs } = await supabase
      .from('epi_catalog' as 'epi_catalog')
      .select('id, nome')
      .in('id', missingEpiIds);
    const typedCatalogs = (catalogs ?? []) as unknown as EpiCatalogRow[];
    epiNames = Object.fromEntries(typedCatalogs.map(c => [c.id, c.nome]));
  }

  const missing_epis = missingRaw.map(m => ({
    epi_catalog_id: m.epi_catalog_id,
    epi_nome: epiNames[m.epi_catalog_id] ?? 'Desconhecido',
    risk_agent: m.risk_agent,
  }));

  // 5. Check for expired EPIs
  const now = new Date();
  const expired_epis: ExpiredEpiResult[] = typedDeliveries
    .filter(d => d.data_validade && new Date(d.data_validade) < now)
    .map(d => ({
      delivery_id: d.id,
      employee_id: employeeId,
      employee_name: '',
      epi_nome: '',
      data_validade: d.data_validade!,
      dias_vencido: Math.floor((now.getTime() - new Date(d.data_validade!).getTime()) / 86400000),
    }));

  // 6. Check for unsigned deliveries
  const deliveryIds = typedDeliveries.map(d => d.id);
  let unsigned_deliveries: string[] = [];
  if (deliveryIds.length > 0) {
    const { data: sigs } = await supabase
      .from('epi_signatures' as 'epi_signatures')
      .select('delivery_id')
      .in('delivery_id', deliveryIds)
      .eq('is_valid', true);
    const typedSigs = (sigs ?? []) as unknown as SignatureRow[];
    const signedIds = new Set(typedSigs.map(s => s.delivery_id));
    unsigned_deliveries = deliveryIds.filter(id => !signedIds.has(id));
  }

  return {
    employee_id: employeeId,
    compliant: missing_epis.length === 0 && expired_epis.length === 0 && unsigned_deliveries.length === 0,
    missing_epis,
    expired_epis,
    unsigned_deliveries,
  };
}

// ═══════════════════════════════════════════════════════
// BATCH EXPIRATION SCAN + AUTO-MARK
// ═══════════════════════════════════════════════════════

export async function processExpiredEpis(tenantId: string): Promise<ExpiredEpiResult[]> {
  const expired = await scanExpiredEpis(tenantId);

  // Auto-mark as expired
  for (const item of expired) {
    await markDeliveryExpired(item.delivery_id);
  }

  return expired;
}
