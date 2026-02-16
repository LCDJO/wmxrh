/**
 * Cost Projection Engine
 *
 * Projects CLT workforce costs over a configurable horizon.
 * Consumes:
 *   - PayrollSimulation snapshots (baseline)
 *   - Scheduled SalaryAdjustments (point-in-time salary bumps)
 *   - Active CCT (annual readjustment on base date month)
 *   - Headcount delta + benefit inflation
 *
 * Pure function — no I/O, no side effects.
 */

import type {
  CostProjectionInput,
  CostProjectionOutput,
  MonthlyCostProjection,
  CostDriver,
  CostProjectionSummary,
  ScheduledAdjustment,
} from './types';

export function projectCosts(input: CostProjectionInput): CostProjectionOutput {
  const {
    dataset,
    horizon_months,
    salary_adjustment_rate = 0,
    headcount_delta = 0,
    benefit_inflation_rate = 0,
    scheduled_adjustments = [],
    active_cct,
  } = input;

  const sims = dataset.simulations;
  const currentHeadcount = sims.length;

  if (currentHeadcount === 0) {
    return emptyProjection(horizon_months);
  }

  // ── Baseline from current simulations ──
  const baselineCost = round(sims.reduce((s, sim) => s + sim.custo_total_empregador, 0));
  const baselineSalario = round(sims.reduce((s, sim) => s + sim.salario_base, 0));
  const baselineEncargos = round(sims.reduce((s, sim) => s + sim.encargos_total, 0));
  const baselineProvisoes = round(sims.reduce((s, sim) => s + sim.provisoes_total, 0));
  const baselineBeneficios = round(sims.reduce((s, sim) => s + sim.beneficios_total, 0));
  const baselineProventos = round(sims.reduce((s, sim) => s + sim.total_proventos, 0));

  const avgCostPerEmployee = baselineCost / currentHeadcount;
  const avgSalaryPerEmployee = baselineSalario / currentHeadcount;
  const avgEncargosPerEmployee = baselineEncargos / currentHeadcount;
  const avgProvisoesPerEmployee = baselineProvisoes / currentHeadcount;
  const avgBeneficiosPerEmployee = baselineBeneficios / currentHeadcount;

  // ── CCT readjustment rate (overrides generic salary_adjustment_rate if provided) ──
  const cctRate = active_cct?.annual_readjustment_pct
    ? active_cct.annual_readjustment_pct / 100
    : 0;
  const cctBaseMonth = active_cct?.base_date_month ?? 0;

  // Fallback monthly salary adjustment
  const effectiveAnnualRate = cctRate > 0 ? 0 : salary_adjustment_rate;
  const monthlyAdjRate = effectiveAnnualRate > 0
    ? Math.pow(1 + effectiveAnnualRate, 1 / 12) - 1
    : 0;

  const monthlyBenefitInflation = benefit_inflation_rate > 0
    ? Math.pow(1 + benefit_inflation_rate, 1 / 12) - 1
    : 0;

  // ── Pre-process scheduled adjustments by month ──
  const adjustmentsByMonth = new Map<string, ScheduledAdjustment[]>();
  for (const adj of scheduled_adjustments) {
    const key = adj.effective_date.slice(0, 7); // YYYY-MM
    const list = adjustmentsByMonth.get(key) ?? [];
    list.push(adj);
    adjustmentsByMonth.set(key, list);
  }

  // ── Project month by month ──
  const now = new Date(dataset.analysis_date);
  const projections: MonthlyCostProjection[] = [];
  let cumulativeSalaryBump = 0; // from scheduled adjustments
  let cctApplied = false;
  let cctMultiplier = 1;

  for (let m = 1; m <= horizon_months; m++) {
    const date = new Date(now);
    date.setMonth(date.getMonth() + m);
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthNum = date.getMonth() + 1;

    const hc = Math.max(0, currentHeadcount + headcount_delta * m);

    // CCT readjustment: apply once when base_date_month is hit
    let cctThisMonth = false;
    if (cctRate > 0 && cctBaseMonth > 0 && monthNum === cctBaseMonth && !cctApplied) {
      cctMultiplier = 1 + cctRate;
      cctApplied = true;
      cctThisMonth = true;
    }

    // Scheduled adjustments for this month
    const monthAdjs = adjustmentsByMonth.get(monthStr) ?? [];
    const adjBump = monthAdjs.reduce((s, a) => s + (a.new_salary - a.previous_salary), 0);
    cumulativeSalaryBump += adjBump;

    // Salary multiplier: gradual adjustment + CCT + scheduled bumps
    const salaryMultiplier = Math.pow(1 + monthlyAdjRate, m) * cctMultiplier;
    const benefitMultiplier = Math.pow(1 + monthlyBenefitInflation, m);

    const adjustedSalarioBase = round(avgSalaryPerEmployee * hc * salaryMultiplier + cumulativeSalaryBump);
    const totalProventos = round(baselineProventos * (hc / currentHeadcount) * salaryMultiplier + cumulativeSalaryBump);
    const totalEncargos = round(avgEncargosPerEmployee * hc * salaryMultiplier);
    const totalProvisoes = round(avgProvisoesPerEmployee * hc * salaryMultiplier);
    const totalBeneficios = round(avgBeneficiosPerEmployee * hc * benefitMultiplier);
    const custoTotal = round(totalProventos + totalEncargos + totalProvisoes + totalBeneficios);

    projections.push({
      month: monthStr,
      headcount: hc,
      total_salario_base: adjustedSalarioBase,
      total_proventos: totalProventos,
      total_encargos: totalEncargos,
      total_provisoes: totalProvisoes,
      total_beneficios: totalBeneficios,
      custo_total_empregador: custoTotal,
      delta_vs_current: round(custoTotal - baselineCost),
      delta_pct: baselineCost > 0 ? round(((custoTotal - baselineCost) / baselineCost) * 100) : 0,
      adjustments_applied: monthAdjs.length,
      cct_readjustment_applied: cctThisMonth,
    });
  }

  // ── Cost drivers ──
  const lastProjection = projections[projections.length - 1];
  const drivers: CostDriver[] = [];

  if (effectiveAnnualRate > 0) {
    const salaryImpact = round(lastProjection.total_salario_base - baselineSalario - cumulativeSalaryBump);
    drivers.push({ driver: 'Reajuste salarial gradual', impact_monthly: round(salaryImpact / horizon_months), impact_pct: round((salaryImpact / baselineCost) * 100), category: 'salary' });
  }
  if (cctRate > 0) {
    const cctImpact = round(baselineSalario * cctRate);
    drivers.push({ driver: `Reajuste CCT (${(cctRate * 100).toFixed(1)}% — mês ${cctBaseMonth})`, impact_monthly: round(cctImpact), impact_pct: round((cctImpact / baselineCost) * 100), category: 'cct' });
  }
  if (scheduled_adjustments.length > 0) {
    const totalAdjImpact = scheduled_adjustments.reduce((s, a) => s + (a.new_salary - a.previous_salary), 0);
    drivers.push({ driver: `Aumentos agendados (${scheduled_adjustments.length})`, impact_monthly: round(totalAdjImpact), impact_pct: round((totalAdjImpact / baselineCost) * 100), category: 'adjustment' });
  }
  if (headcount_delta !== 0) {
    const hcImpact = round(headcount_delta * horizon_months * avgCostPerEmployee);
    drivers.push({ driver: `Variação headcount (${headcount_delta > 0 ? '+' : ''}${headcount_delta}/mês)`, impact_monthly: round(headcount_delta * avgCostPerEmployee), impact_pct: round((hcImpact / baselineCost) * 100), category: 'headcount' });
  }
  if (benefit_inflation_rate > 0) {
    const benImpact = round(lastProjection.total_beneficios - baselineBeneficios);
    drivers.push({ driver: 'Inflação benefícios', impact_monthly: round(benImpact / horizon_months), impact_pct: round((benImpact / baselineCost) * 100), category: 'benefit' });
  }

  const projectedAvg = round(projections.reduce((s, p) => s + p.custo_total_empregador, 0) / projections.length);

  // ── Summary ──
  const p3 = projections.length >= 3 ? projections[2].custo_total_empregador : lastProjection.custo_total_empregador;
  const p12 = projections.length >= 12 ? projections[11].custo_total_empregador : lastProjection.custo_total_empregador;

  const impactoAumentos = round(
    (drivers.find(d => d.category === 'salary')?.impact_monthly ?? 0) +
    (drivers.find(d => d.category === 'adjustment')?.impact_monthly ?? 0) +
    (drivers.find(d => d.category === 'cct')?.impact_monthly ?? 0)
  );
  const impactoBeneficios = round(drivers.find(d => d.category === 'benefit')?.impact_monthly ?? 0);
  const impactoCCT = round(drivers.find(d => d.category === 'cct')?.impact_monthly ?? 0);
  const impactoHeadcount = round(drivers.find(d => d.category === 'headcount')?.impact_monthly ?? 0);

  const summary: CostProjectionSummary = {
    custo_atual: baselineCost,
    custo_projetado_3_meses: p3,
    custo_projetado_12_meses: p12,
    impacto_aumentos: impactoAumentos,
    impacto_beneficios: impactoBeneficios,
    impacto_cct: impactoCCT,
    impacto_headcount: impactoHeadcount,
  };

  // ── Assumptions ──
  const assumptions: string[] = [];
  if (cctRate > 0) assumptions.push(`CCT: reajuste de ${(cctRate * 100).toFixed(1)}% no mês ${cctBaseMonth}`);
  if (effectiveAnnualRate > 0) assumptions.push(`Reajuste anual genérico: ${(effectiveAnnualRate * 100).toFixed(1)}%`);
  if (scheduled_adjustments.length > 0) assumptions.push(`${scheduled_adjustments.length} aumento(s) agendado(s) no período`);
  assumptions.push(`Variação headcount: ${headcount_delta}/mês`);
  assumptions.push(`Inflação benefícios: ${(benefit_inflation_rate * 100).toFixed(1)}%`);
  assumptions.push('Encargos patronais mantidos nas alíquotas atuais');
  assumptions.push('Composição de rubricas constante');

  return {
    horizon_months,
    baseline_monthly_cost: baselineCost,
    projected_monthly_avg: projectedAvg,
    projected_annual_total: round(projectedAvg * 12),
    monthly_projections: projections,
    cost_drivers: drivers,
    assumptions,
    summary,
    is_projection: true,
  };
}

function emptyProjection(horizon: number): CostProjectionOutput {
  return {
    horizon_months: horizon as any,
    baseline_monthly_cost: 0,
    projected_monthly_avg: 0,
    projected_annual_total: 0,
    monthly_projections: [],
    cost_drivers: [],
    assumptions: ['Sem dados de simulação disponíveis'],
    summary: {
      custo_atual: 0,
      custo_projetado_3_meses: 0,
      custo_projetado_12_meses: 0,
      impacto_aumentos: 0,
      impacto_beneficios: 0,
      impacto_cct: 0,
      impacto_headcount: 0,
    },
    is_projection: true,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
