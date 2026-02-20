/**
 * EPI Delivery Service
 *
 * Manages EPI delivery, return, replacement and expiration workflows.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  EpiDelivery,
  EpiDeliveryInput,
  EpiReplacementInput,
  ExpiredEpiResult,
} from './types';

// ═══════════════════════════════════════════════════════
// CREATE DELIVERY
// ═══════════════════════════════════════════════════════

export async function createEpiDelivery(input: EpiDeliveryInput): Promise<EpiDelivery> {
  // Fetch catalog item for validade calculation
  const { data: catalog } = await supabase
    .from('epi_catalog' as any)
    .select('validade_meses, ca_numero')
    .eq('id', input.epi_catalog_id)
    .single();

  const validadeMeses = (catalog as any)?.validade_meses ?? 12;
  const dataEntrega = input.data_entrega ?? new Date().toISOString().split('T')[0];
  const dataValidade = new Date(dataEntrega);
  dataValidade.setMonth(dataValidade.getMonth() + validadeMeses);

  const row = {
    tenant_id: input.tenant_id,
    company_id: input.company_id ?? null,
    employee_id: input.employee_id,
    epi_catalog_id: input.epi_catalog_id,
    risk_exposure_id: input.risk_exposure_id ?? null,
    quantidade: input.quantidade ?? 1,
    motivo: input.motivo ?? 'entrega_inicial',
    data_entrega: dataEntrega,
    data_validade: dataValidade.toISOString().split('T')[0],
    lote: input.lote ?? null,
    ca_numero: input.ca_numero ?? (catalog as any)?.ca_numero ?? null,
    observacoes: input.observacoes ?? null,
    status: 'entregue',
  };

  const { data, error } = await supabase
    .from('epi_deliveries' as any)
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`Erro ao registrar entrega de EPI: ${error.message}`);
  return data as unknown as EpiDelivery;
}

// ═══════════════════════════════════════════════════════
// REPLACE EPI (Substituição)
// ═══════════════════════════════════════════════════════

export async function replaceEpi(input: EpiReplacementInput): Promise<EpiDelivery> {
  // 1. Mark old delivery as 'substituido'
  const { data: oldDelivery, error: fetchErr } = await supabase
    .from('epi_deliveries' as any)
    .select('*')
    .eq('id', input.old_delivery_id)
    .single();

  if (fetchErr || !oldDelivery) throw new Error('Entrega anterior não encontrada');

  await supabase
    .from('epi_deliveries' as any)
    .update({ status: 'substituido' } as any)
    .eq('id', input.old_delivery_id);

  // 2. Create new delivery
  const old = oldDelivery as any;
  return createEpiDelivery({
    tenant_id: input.tenant_id,
    company_id: old.company_id,
    employee_id: old.employee_id,
    epi_catalog_id: old.epi_catalog_id,
    risk_exposure_id: old.risk_exposure_id,
    quantidade: old.quantidade,
    motivo: input.motivo,
    observacoes: input.observacoes ?? `Substituição da entrega ${input.old_delivery_id}`,
  });
}

// ═══════════════════════════════════════════════════════
// RETURN EPI (Devolução)
// ═══════════════════════════════════════════════════════

export async function returnEpi(
  deliveryId: string,
  motivo: string,
): Promise<void> {
  const { error } = await supabase
    .from('epi_deliveries' as any)
    .update({
      status: 'devolvido',
      data_devolucao: new Date().toISOString().split('T')[0],
      motivo_devolucao: motivo,
    } as any)
    .eq('id', deliveryId);

  if (error) throw new Error(`Erro ao registrar devolução: ${error.message}`);
}

// ═══════════════════════════════════════════════════════
// SCAN EXPIRED EPIs
// ═══════════════════════════════════════════════════════

export async function scanExpiredEpis(tenantId: string): Promise<ExpiredEpiResult[]> {
  const { data, error } = await supabase.rpc('scan_expired_epis', {
    _tenant_id: tenantId,
  });

  if (error) throw new Error(`Erro ao escanear EPIs vencidos: ${error.message}`);
  return (data ?? []) as unknown as ExpiredEpiResult[];
}

// ═══════════════════════════════════════════════════════
// MARK AS EXPIRED
// ═══════════════════════════════════════════════════════

export async function markDeliveryExpired(deliveryId: string): Promise<void> {
  await supabase
    .from('epi_deliveries' as any)
    .update({ status: 'vencido' } as any)
    .eq('id', deliveryId);
}

// ═══════════════════════════════════════════════════════
// FETCH DELIVERIES FOR EMPLOYEE
// ═══════════════════════════════════════════════════════

export async function getEmployeeEpiDeliveries(
  tenantId: string,
  employeeId: string,
): Promise<EpiDelivery[]> {
  const { data, error } = await supabase
    .from('epi_deliveries' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('data_entrega', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EpiDelivery[];
}
