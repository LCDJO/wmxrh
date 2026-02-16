/**
 * Cost Projection Engine
 *
 * Projects CLT workforce costs over a configurable horizon.
 * Applies salary adjustments, headcount changes, and benefit inflation.
 * Pure function — no I/O, no side effects.
 */

import type {
  CostProjectionInput,
  CostProjectionOutput,
  MonthlyCostProjection,
  CostDriver,
} from './types';

export function projectCosts(input: CostProjectionInput): CostProjectionOutput {
  const { dataset, horizon_months, salary_adjustment_rate = 0, headcount_delta = 0, benefit_inflation_rate = 0 } = input;

  // Baseline from current simulations
  const sims = dataset.simulations;
  const currentHeadcount = sims.length;

  if (currentHeadcount === 0) {
    return emptyProjection(horizon_months);
  }

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

  // Monthly salary adjustment rate (compound)
  const monthlyAdjRate = salary_adjustment_rate > 0
    ? Math.pow(1 + salary_adjustment_rate, 1 / 12) - 1
    : 0;
  const monthlyBenefitInflation = benefit_inflation_rate > 0
    ? Math.pow(1 + benefit_inflation_rate, 1 / 12) - 1
    : 0;

  const now = new Date(dataset.analysis_date);
  const projections: MonthlyCostProjection[] = [];

  for (let m = 1; m <= horizon_months; m++) {
    const date = new Date(now);
    date.setMonth(date.getMonth() + m);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const hc = Math.max(0, currentHeadcount + headcount_delta * m);
    const salaryMultiplier = Math.pow(1 + monthlyAdjRate, m);
    const benefitMultiplier = Math.pow(1 + monthlyBenefitInflation, m);

    const totalSalarioBase = round(avgSalaryPerEmployee * hc * salaryMultiplier);
    const totalProventos = round(baselineProventos * (hc / currentHeadcount) * salaryMultiplier);
    const totalEncargos = round(avgEncargosPerEmployee * hc * salaryMultiplier);
    const totalProvisoes = round(avgProvisoesPerEmployee * hc * salaryMultiplier);
    const totalBeneficios = round(avgBeneficiosPerEmployee * hc * benefitMultiplier);
    const custoTotal = round(totalProventos + totalEncargos + totalProvisoes + totalBeneficios);

    projections.push({
      month,
      headcount: hc,
      total_salario_base: totalSalarioBase,
      total_proventos: totalProventos,
      total_encargos: totalEncargos,
      total_provisoes: totalProvisoes,
      total_beneficios: totalBeneficios,
      custo_total_empregador: custoTotal,
      delta_vs_current: round(custoTotal - baselineCost),
      delta_pct: baselineCost > 0 ? round(((custoTotal - baselineCost) / baselineCost) * 100) : 0,
    });
  }

  // Cost drivers
  const lastProjection = projections[projections.length - 1];
  const drivers: CostDriver[] = [];

  if (salary_adjustment_rate > 0) {
    const salaryImpact = round(lastProjection.total_salario_base - baselineSalario);
    drivers.push({ driver: 'Reajuste salarial', impact_monthly: round(salaryImpact / horizon_months), impact_pct: round((salaryImpact / baselineCost) * 100), category: 'salary' });
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

  return {
    horizon_months,
    baseline_monthly_cost: baselineCost,
    projected_monthly_avg: projectedAvg,
    projected_annual_total: round(projectedAvg * 12),
    monthly_projections: projections,
    cost_drivers: drivers,
    assumptions: [
      `Reajuste anual: ${(salary_adjustment_rate * 100).toFixed(1)}%`,
      `Variação headcount: ${headcount_delta}/mês`,
      `Inflação benefícios: ${(benefit_inflation_rate * 100).toFixed(1)}%`,
      'Encargos patronais mantidos nas alíquotas atuais',
      'Composição de rubricas constante',
    ],
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
    is_projection: true,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
