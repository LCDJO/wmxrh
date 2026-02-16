/**
 * Payroll Simulation — CQRS Read Models
 *
 * Projection-only views derived from PayrollSimulationOutput.
 * These are query-side contracts — no mutations, no side effects.
 *
 * Views:
 * - PayrollSimulationView: flat summary of a single simulation
 * - CompanyCostProjectionView: aggregated company/group cost projection
 * - EmployeeCostBreakdownView: detailed per-employee cost decomposition
 */

import type {
  PayrollSimulationOutput,
  EncargoEstimate,
} from './types';
import type { SimulationRiskDetectedPayload } from './payroll-simulation.events';
import type { CalculatedRubric } from '@/domains/labor-rules';
import { detectSimulationRisks, type ComplianceContext } from './payroll-simulation.events';

// ══════════════════════════════════════════
// 1. PayrollSimulationView
//    Flat read model for listing / detail screens
// ══════════════════════════════════════════

export interface PayrollSimulationView {
  /** Metadata */
  employee_id?: string;
  employee_name?: string;
  department?: string;
  company_group?: string;
  competencia?: string;
  simulated_at: string;

  /** Salary */
  salario_base: number;
  total_proventos: number;
  total_descontos: number;
  salario_liquido: number;

  /** Encargos (SIMULAÇÃO) */
  encargos: EncargoEstimate;

  /** Employer cost */
  custo_total_empregador: number;
  fator_custo: number;

  /** Rubric count */
  rubrics_count: number;

  /** Risk alerts */
  alerts: SimulationRiskDetectedPayload[];
  has_critical_alert: boolean;
}

export function toPayrollSimulationView(
  output: PayrollSimulationOutput,
  meta?: {
    employee_id?: string;
    employee_name?: string;
    department?: string;
    company_group?: string;
    competencia?: string;
    tenantId?: string;
    compliance?: ComplianceContext;
  },
): PayrollSimulationView {
  const alerts = detectSimulationRisks(
    meta?.tenantId ?? 'unknown',
    meta?.employee_id,
    output.employerCost.fator_custo,
    output.summary.baseInss,
    output.input.salario_base,
    output.input,
    meta?.compliance,
  );

  return {
    employee_id: meta?.employee_id,
    employee_name: meta?.employee_name,
    department: meta?.department,
    company_group: meta?.company_group,
    competencia: meta?.competencia,
    simulated_at: output.simulated_at,
    salario_base: output.input.salario_base,
    total_proventos: output.summary.totalProventos,
    total_descontos: output.summary.totalDescontos,
    salario_liquido: output.employerCost.salario_liquido,
    encargos: output.encargos,
    custo_total_empregador: output.employerCost.custo_total_empregador,
    fator_custo: output.employerCost.fator_custo,
    rubrics_count: output.rubrics.length,
    alerts,
    has_critical_alert: alerts.some(a => a.risk_level === 'critical'),
  };
}

// ══════════════════════════════════════════
// 2. CompanyCostProjectionView
//    Aggregated cost projection across employees
// ══════════════════════════════════════════

export interface GroupCostSummary {
  group_name: string;
  headcount: number;
  total_salario_base: number;
  total_proventos: number;
  total_custo_empregador: number;
  total_inss_estimado: number;
  total_fgts_estimado: number;
  total_irrf_estimado: number;
  total_provisoes: number;
  total_beneficios: number;
  avg_fator_custo: number;
}

export interface CompanyCostProjectionView {
  /** Overall KPIs */
  headcount: number;
  total_folha_bruta: number;
  total_folha_liquida: number;
  total_custo_empregador: number;
  total_encargos_estimados: number;
  total_provisoes: number;
  total_beneficios: number;
  avg_fator_custo: number;

  /** Breakdown by group */
  by_group: GroupCostSummary[];

  /** Top cost employees */
  top_cost: PayrollSimulationView[];

  /** Alert summary */
  total_alerts: number;
  critical_alerts: number;

  /** Disclaimer */
  is_simulacao: true;
}

export function toCompanyCostProjectionView(
  simulations: { output: PayrollSimulationOutput; name: string; group: string; department: string; employeeId?: string }[],
  tenantId?: string,
): CompanyCostProjectionView {
  const views = simulations.map(s =>
    toPayrollSimulationView(s.output, {
      employee_id: s.employeeId,
      employee_name: s.name,
      department: s.department,
      company_group: s.group,
      tenantId,
    }),
  );

  // Aggregate by group
  const groupMap = new Map<string, PayrollSimulationView[]>();
  views.forEach(v => {
    const key = v.company_group ?? 'Sem Grupo';
    const list = groupMap.get(key) ?? [];
    list.push(v);
    groupMap.set(key, list);
  });

  const by_group: GroupCostSummary[] = Array.from(groupMap, ([group_name, items]) => ({
    group_name,
    headcount: items.length,
    total_salario_base: round(items.reduce((s, v) => s + v.salario_base, 0)),
    total_proventos: round(items.reduce((s, v) => s + v.total_proventos, 0)),
    total_custo_empregador: round(items.reduce((s, v) => s + v.custo_total_empregador, 0)),
    total_inss_estimado: round(items.reduce((s, v) => s + v.encargos.valor_inss_estimado, 0)),
    total_fgts_estimado: round(items.reduce((s, v) => s + v.encargos.valor_fgts_estimado, 0)),
    total_irrf_estimado: round(items.reduce((s, v) => s + v.encargos.valor_irrf_estimado, 0)),
    total_provisoes: round(items.reduce((s, v) => s + (v.total_proventos * 0.08), 0)), // simplified
    total_beneficios: 0,
    avg_fator_custo: round(items.reduce((s, v) => s + v.fator_custo, 0) / items.length),
  }));

  const allAlerts = views.flatMap(v => v.alerts);

  return {
    headcount: views.length,
    total_folha_bruta: round(views.reduce((s, v) => s + v.total_proventos, 0)),
    total_folha_liquida: round(views.reduce((s, v) => s + v.salario_liquido, 0)),
    total_custo_empregador: round(views.reduce((s, v) => s + v.custo_total_empregador, 0)),
    total_encargos_estimados: round(views.reduce((s, v) => s + v.encargos.total_encargos_estimados, 0)),
    total_provisoes: round(by_group.reduce((s, g) => s + g.total_provisoes, 0)),
    total_beneficios: round(by_group.reduce((s, g) => s + g.total_beneficios, 0)),
    avg_fator_custo: round(views.reduce((s, v) => s + v.fator_custo, 0) / views.length),
    by_group,
    top_cost: [...views].sort((a, b) => b.custo_total_empregador - a.custo_total_empregador).slice(0, 10),
    total_alerts: allAlerts.length,
    critical_alerts: allAlerts.filter(a => a.risk_level === 'critical').length,
    is_simulacao: true,
  };
}

// ══════════════════════════════════════════
// 3. EmployeeCostBreakdownView
//    Detailed decomposition for a single employee
// ══════════════════════════════════════════

export interface CostLineItem {
  label: string;
  category: 'provento' | 'desconto' | 'encargo_patronal' | 'provisao' | 'beneficio';
  value: number;
  percentage_of_base?: number;
  legal_basis?: string;
}

export interface EmployeeCostBreakdownView {
  /** Employee info */
  employee_id?: string;
  employee_name?: string;
  department?: string;
  company_group?: string;

  /** Summary */
  salario_base: number;
  salario_liquido: number;
  custo_total_empregador: number;
  fator_custo: number;

  /** Detailed line items */
  line_items: CostLineItem[];

  /** Rubrics from simulation */
  rubrics: CalculatedRubric[];

  /** Encargos */
  encargos: EncargoEstimate;

  /** Alerts */
  alerts: SimulationRiskDetectedPayload[];

  /** Chart data: pie segments */
  composition: { name: string; value: number }[];

  is_simulacao: true;
}

export function toEmployeeCostBreakdownView(
  output: PayrollSimulationOutput,
  meta?: {
    employee_id?: string;
    employee_name?: string;
    department?: string;
    company_group?: string;
    tenantId?: string;
    compliance?: ComplianceContext;
  },
): EmployeeCostBreakdownView {
  const base = output.input.salario_base;
  const pct = (v: number) => base > 0 ? round((v / base) * 100) : 0;

  const line_items: CostLineItem[] = [];

  // Proventos
  line_items.push({ label: 'Salário Base', category: 'provento', value: base, percentage_of_base: 100 });
  for (const r of output.rubrics.filter(r => r.valor > 0 && r.category !== 'vale_transporte')) {
    line_items.push({ label: r.rule_name, category: 'provento', value: r.valor, percentage_of_base: pct(r.valor), legal_basis: r.legal_basis ?? undefined });
  }

  // Descontos empregado
  line_items.push({ label: 'INSS Empregado', category: 'desconto', value: output.taxes.inss, percentage_of_base: pct(output.taxes.inss) });
  line_items.push({ label: 'IRRF', category: 'desconto', value: output.taxes.irrf, percentage_of_base: pct(output.taxes.irrf) });
  for (const r of output.rubrics.filter(r => r.category === 'vale_transporte')) {
    line_items.push({ label: r.rule_name, category: 'desconto', value: r.valor, percentage_of_base: pct(r.valor) });
  }

  // Encargos patronais
  line_items.push({ label: 'FGTS (8%)', category: 'encargo_patronal', value: output.taxes.fgts, percentage_of_base: pct(output.taxes.fgts) });
  line_items.push({ label: 'INSS Patronal (20%)', category: 'encargo_patronal', value: output.employerCost.inss_patronal, percentage_of_base: pct(output.employerCost.inss_patronal) });
  line_items.push({ label: 'RAT (2%)', category: 'encargo_patronal', value: output.employerCost.rat, percentage_of_base: pct(output.employerCost.rat) });
  line_items.push({ label: 'Terceiros (5,8%)', category: 'encargo_patronal', value: output.employerCost.terceiros, percentage_of_base: pct(output.employerCost.terceiros) });

  // Provisões
  line_items.push({ label: 'Férias + 1/3', category: 'provisao', value: output.reflections.ferias_terco, percentage_of_base: pct(output.reflections.ferias_terco) });
  line_items.push({ label: '13º Salário', category: 'provisao', value: output.reflections.decimo_terceiro, percentage_of_base: pct(output.reflections.decimo_terceiro) });
  line_items.push({ label: 'Multa FGTS (40%)', category: 'provisao', value: output.reflections.provisao_multa_fgts, percentage_of_base: pct(output.reflections.provisao_multa_fgts) });

  // Benefícios
  line_items.push({ label: 'Benefícios', category: 'beneficio', value: output.employerCost.beneficios, percentage_of_base: pct(output.employerCost.beneficios) });

  const filteredItems = line_items.filter(item => item.value > 0);

  const composition = [
    { name: 'Salário Líquido', value: output.employerCost.salario_liquido },
    { name: 'INSS Empregado', value: output.taxes.inss },
    { name: 'IRRF', value: output.taxes.irrf },
    { name: 'FGTS', value: output.taxes.fgts },
    { name: 'Encargos Patronais', value: output.employerCost.inss_patronal + output.employerCost.rat + output.employerCost.terceiros },
    { name: 'Provisões', value: output.reflections.total_provisoes },
    { name: 'Benefícios', value: output.employerCost.beneficios },
  ].filter(d => d.value > 0);

  const alerts = detectSimulationRisks(
    meta?.tenantId ?? 'unknown',
    meta?.employee_id,
    output.employerCost.fator_custo,
    output.summary.baseInss,
    output.input.salario_base,
    output.input,
    meta?.compliance,
  );

  return {
    employee_id: meta?.employee_id,
    employee_name: meta?.employee_name,
    department: meta?.department,
    company_group: meta?.company_group,
    salario_base: base,
    salario_liquido: output.employerCost.salario_liquido,
    custo_total_empregador: output.employerCost.custo_total_empregador,
    fator_custo: output.employerCost.fator_custo,
    line_items: filteredItems,
    rubrics: output.rubrics,
    encargos: output.encargos,
    alerts,
    composition,
    is_simulacao: true,
  };
}

// ── Util ──

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
