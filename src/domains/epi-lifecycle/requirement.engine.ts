/**
 * EPI Requirement Engine — Domain Service
 *
 * Automatically creates EPI requirements based on employee risk exposures.
 * Integrates with Occupational Risk Engine via epi_risk_mappings.
 *
 * Flow:
 *   1. Employee gets a risk exposure (employee_risk_exposures)
 *   2. DB trigger (fn_auto_create_epi_requirements) checks epi_risk_mappings
 *   3. Creates epi_requirements with status='pendente'
 *   4. When EPI is delivered, trigger auto-fulfills the requirement
 *
 * This service provides the query/management layer on top of the DB triggers.
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface EpiRequirement {
  id: string;
  tenant_id: string;
  employee_id: string;
  epi_catalog_id: string;
  risk_exposure_id: string | null;
  motivo: string;
  obrigatorio: boolean;
  status: 'pendente' | 'atendido' | 'dispensado';
  atendido_em: string | null;
  atendido_por: string | null;
  delivery_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EpiRequirementWithDetails extends EpiRequirement {
  employee_name?: string;
  epi_nome?: string;
  ca_numero?: string;
}

// ═══════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════

/** Get all pending EPI requirements for a tenant */
export async function getPendingRequirements(tenantId: string): Promise<EpiRequirementWithDetails[]> {
  const { data, error } = await supabase
    .from('epi_requirements' as any)
    .select(`
      *,
      employees:employee_id(name),
      epi_catalog:epi_catalog_id(nome, ca_numero)
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    ...r,
    employee_name: r.employees?.name,
    epi_nome: r.epi_catalog?.nome,
    ca_numero: r.epi_catalog?.ca_numero,
  }));
}

/** Get all requirements for a specific employee */
export async function getEmployeeRequirements(employeeId: string): Promise<EpiRequirement[]> {
  const { data, error } = await supabase
    .from('epi_requirements' as any)
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as EpiRequirement[];
}

// ═══════════════════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════════════════

/** Manually create an EPI requirement */
export async function createRequirement(input: {
  tenantId: string;
  employeeId: string;
  epiCatalogId: string;
  riskExposureId?: string;
  motivo: string;
  obrigatorio?: boolean;
}): Promise<EpiRequirement> {
  const { data, error } = await supabase
    .from('epi_requirements' as any)
    .insert({
      tenant_id: input.tenantId,
      employee_id: input.employeeId,
      epi_catalog_id: input.epiCatalogId,
      risk_exposure_id: input.riskExposureId ?? null,
      motivo: input.motivo,
      obrigatorio: input.obrigatorio ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as EpiRequirement;
}

/** Dismiss/dispense a requirement */
export async function dismissRequirement(requirementId: string): Promise<void> {
  const { error } = await supabase
    .from('epi_requirements' as any)
    .update({ status: 'dispensado' })
    .eq('id', requirementId);

  if (error) throw error;
}

/** Manually scan all active risk exposures and generate missing requirements */
export async function scanAndGenerateRequirements(tenantId: string): Promise<number> {
  // Get all active exposures requiring EPI
  const { data: exposures } = await supabase
    .from('employee_risk_exposures')
    .select('id, tenant_id, employee_id, risk_factor_id, requires_epi, epi_description')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('requires_epi', true)
    .is('deleted_at', null);

  if (!exposures || exposures.length === 0) return 0;

  // Get risk factor names
  const riskFactorIds = [...new Set(exposures.map(e => e.risk_factor_id).filter(Boolean))];
  const { data: factors } = await supabase
    .from('occupational_risk_factors')
    .select('id, name')
    .in('id', riskFactorIds);

  const factorMap = new Map((factors ?? []).map(f => [f.id, f.name]));

  // Get all mandatory mappings
  const { data: mappings } = await supabase
    .from('epi_risk_mappings' as any)
    .select('epi_catalog_id, risk_agent')
    .eq('tenant_id', tenantId)
    .eq('obrigatorio', true);

  if (!mappings || mappings.length === 0) return 0;

  let created = 0;

  for (const exp of exposures) {
    const agentName = factorMap.get(exp.risk_factor_id) ?? exp.epi_description ?? '';

    for (const mapping of mappings as any[]) {
      if (mapping.risk_agent !== agentName) continue;

      const { error } = await supabase
        .from('epi_requirements' as any)
        .insert({
          tenant_id: tenantId,
          employee_id: exp.employee_id,
          epi_catalog_id: mapping.epi_catalog_id,
          risk_exposure_id: exp.id,
          motivo: `Exposição a ${mapping.risk_agent} detectada automaticamente`,
          obrigatorio: true,
        })
        .select();

      if (!error) created++;
      // Ignore conflict errors (duplicate)
    }
  }

  return created;
}
