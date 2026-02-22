/**
 * EPI Cost Engine — Integration with Payroll Simulation & Workforce Intelligence
 *
 * Provides EPI cost data for:
 * - Payroll Simulation: total employer cost includes EPI costs
 * - Workforce Intelligence: EPI spend as workforce health/cost signal
 */

import { supabase } from '@/integrations/supabase/client';
import type { EpiEmployeeCostSummary } from './types';

// ═══════════════════════════════════════════════════════
// PAYROLL SIMULATION INTEGRATION
// ═══════════════════════════════════════════════════════

export interface EpiCostForPayroll {
  employee_id: string;
  employee_name: string;
  total_epi_cost: number;
  total_items: number;
  centro_custo?: string;
}

/**
 * Returns EPI costs per employee for a company within a period.
 * Used by PayrollSimulationEngine to include EPI in total employer cost.
 */
export async function getEpiCostsForPayroll(
  tenantId: string,
  companyId: string,
  periodFrom?: string,
  periodTo?: string
): Promise<EpiCostForPayroll[]> {
  const { data, error } = await supabase.rpc('get_epi_cost_summary_by_company', {
    _tenant_id: tenantId,
    _company_id: companyId,
    _period_from: periodFrom ?? undefined,
    _period_to: periodTo ?? undefined,
  });

  if (error) throw new Error(`Erro ao buscar custos EPI para folha: ${error.message}`);
  return (data ?? []) as unknown as EpiCostForPayroll[];
}

// ═══════════════════════════════════════════════════════
// WORKFORCE INTELLIGENCE INTEGRATION
// ═══════════════════════════════════════════════════════

export interface EpiCostIntelligence {
  total_cost: number;
  total_items: number;
  avg_cost_per_employee: number;
  top_epi_by_cost: EpiEmployeeCostSummary[];
  cost_trend_signal: 'stable' | 'increasing' | 'decreasing';
}

/**
 * Returns EPI cost intelligence for tenant-wide analytics.
 * Used by WorkforceIntelligenceEngine for cost health scoring.
 */
export async function getEpiCostIntelligence(
  tenantId: string,
  periodFrom?: string,
  periodTo?: string
): Promise<EpiCostIntelligence> {
  let query = supabase
    .from('epi_employee_costs')
    .select('custo_total, quantidade, employee_id')
    .eq('tenant_id', tenantId);

  if (periodFrom) query = query.gte('data_apropriacao', periodFrom);
  if (periodTo) query = query.lte('data_apropriacao', periodTo);

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao calcular inteligência EPI: ${error.message}`);

  const records = (data ?? []) as any[];
  const total_cost = records.reduce((s, r) => s + (r.custo_total ?? 0), 0);
  const total_items = records.reduce((s, r) => s + (r.quantidade ?? 0), 0);
  const uniqueEmployees = new Set(records.map((r) => r.employee_id)).size;

  return {
    total_cost,
    total_items,
    avg_cost_per_employee: uniqueEmployees > 0 ? Math.round((total_cost / uniqueEmployees) * 100) / 100 : 0,
    top_epi_by_cost: [],
    cost_trend_signal: 'stable',
  };
}
