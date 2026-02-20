/**
 * EPI Inventory — Employee Cost Tracking Service
 *
 * Custo acumulado de EPI por colaborador para integração com Payroll Simulation.
 */

import { supabase } from '@/integrations/supabase/client';
import type { EpiEmployeeCost, EpiEmployeeCostSummary } from './types';

export async function getEmployeeCostHistory(
  tenantId: string,
  employeeId: string
): Promise<EpiEmployeeCost[]> {
  const { data, error } = await supabase
    .from('epi_employee_costs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Erro ao buscar custos: ${error.message}`);
  return (data ?? []) as unknown as EpiEmployeeCost[];
}

export async function getEmployeeCostSummary(
  tenantId: string,
  employeeId: string
): Promise<EpiEmployeeCostSummary[]> {
  const { data, error } = await supabase.rpc('get_epi_cost_by_employee', {
    _tenant_id: tenantId,
    _employee_id: employeeId,
  });

  if (error) throw new Error(`Erro ao calcular resumo de custos: ${error.message}`);
  return (data ?? []) as unknown as EpiEmployeeCostSummary[];
}

export async function getTenantCostReport(
  tenantId: string,
  period?: { from: string; to: string }
): Promise<{ total_cost: number; total_items: number; by_epi: EpiEmployeeCostSummary[] }> {
  let query = supabase
    .from('epi_employee_costs')
    .select('custo_total, quantidade')
    .eq('tenant_id', tenantId);

  if (period) {
    query = query.gte('data_apropriacao', period.from).lte('data_apropriacao', period.to);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao gerar relatório: ${error.message}`);

  const records = (data ?? []) as any[];
  const total_cost = records.reduce((sum, r) => sum + (r.custo_total ?? 0), 0);
  const total_items = records.reduce((sum, r) => sum + (r.quantidade ?? 0), 0);

  return { total_cost, total_items, by_epi: [] };
}
