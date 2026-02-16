/**
 * Salary Analysis Engine
 *
 * Analyzes compensation distribution across organizational groups.
 * Detects outliers, compression, and disparity patterns.
 * Pure function — no I/O.
 */

import type {
  SalaryAnalysisInput,
  SalaryAnalysisOutput,
  SalaryGroupStats,
  SalaryEquityAlert,
} from './types';

export function analyzeSalaries(input: SalaryAnalysisInput): SalaryAnalysisOutput {
  const { dataset, group_by } = input;
  const employees = dataset.employees.filter(e => e.status === 'active' && e.current_salary > 0);

  if (employees.length === 0) {
    return emptyAnalysis(group_by);
  }

  // Group employees
  const groupMap = new Map<string, typeof employees>();
  for (const emp of employees) {
    const key = resolveGroupKey(emp, group_by);
    const list = groupMap.get(key) ?? [];
    list.push(emp);
    groupMap.set(key, list);
  }

  // Simulation lookup
  const simMap = new Map(dataset.simulations.map(s => [s.employee_id, s]));

  // Build group stats
  const groups: SalaryGroupStats[] = Array.from(groupMap, ([group_key, emps]) => {
    const salaries = emps.map(e => e.current_salary).sort((a, b) => a - b);
    const fatorCustos = emps.map(e => simMap.get(e.id)?.fator_custo ?? 0).filter(f => f > 0);

    return buildGroupStats(group_key, salaries, fatorCustos);
  }).sort((a, b) => b.total_folha - a.total_folha);

  // Overall stats
  const allSalaries = employees.map(e => e.current_salary).sort((a, b) => a - b);
  const allFatores = employees.map(e => simMap.get(e.id)?.fator_custo ?? 0).filter(f => f > 0);
  const overall = buildGroupStats('overall', allSalaries, allFatores);

  // Detect equity alerts
  const equity_alerts = detectEquityAlerts(groups, overall, employees, simMap);

  // Distribution skew
  const skew = overall.median_salary < overall.avg_salary * 0.95
    ? 'right'
    : overall.median_salary > overall.avg_salary * 1.05
      ? 'left'
      : 'normal';

  return {
    group_by,
    groups,
    overall,
    equity_alerts,
    distribution_skew: skew,
    compa_ratio_avg: overall.avg_salary > 0 ? round(overall.median_salary / overall.avg_salary) : 0,
  };
}

function resolveGroupKey(
  emp: { department?: string; position?: string; company_id: string; company_group_id?: string },
  group_by: string,
): string {
  switch (group_by) {
    case 'department': return emp.department ?? 'Sem Departamento';
    case 'position': return emp.position ?? 'Sem Cargo';
    case 'company': return emp.company_id;
    case 'company_group': return emp.company_group_id ?? 'Sem Grupo';
    default: return 'unknown';
  }
}

function buildGroupStats(group_key: string, salaries: number[], fatorCustos: number[]): SalaryGroupStats {
  const n = salaries.length;
  if (n === 0) return emptyGroupStats(group_key);

  const sum = salaries.reduce((s, v) => s + v, 0);
  const avg = sum / n;
  const median = n % 2 === 0
    ? (salaries[n / 2 - 1] + salaries[n / 2]) / 2
    : salaries[Math.floor(n / 2)];
  const p25 = salaries[Math.floor(n * 0.25)] ?? salaries[0];
  const p75 = salaries[Math.floor(n * 0.75)] ?? salaries[n - 1];
  const variance = salaries.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / n;
  const avgFator = fatorCustos.length > 0
    ? fatorCustos.reduce((s, v) => s + v, 0) / fatorCustos.length
    : 0;

  return {
    group_key,
    group_name: group_key,
    headcount: n,
    min_salary: salaries[0],
    max_salary: salaries[n - 1],
    avg_salary: round(avg),
    median_salary: round(median),
    p25_salary: round(p25),
    p75_salary: round(p75),
    std_deviation: round(Math.sqrt(variance)),
    total_folha: round(sum),
    avg_fator_custo: round(avgFator),
    salary_spread: round(salaries[n - 1] / salaries[0]),
  };
}

function detectEquityAlerts(
  groups: SalaryGroupStats[],
  overall: SalaryGroupStats,
  employees: { id: string; current_salary: number; department?: string; position?: string }[],
  simMap: Map<string, { fator_custo: number }>,
): SalaryEquityAlert[] {
  const alerts: SalaryEquityAlert[] = [];

  for (const g of groups) {
    // Salary compression: spread < 1.15x within group of 3+ people
    if (g.headcount >= 3 && g.salary_spread < 1.15) {
      alerts.push({
        alert_type: 'compression',
        severity: 'warning',
        group: g.group_name,
        message: `Compressão salarial no grupo "${g.group_name}" — spread de apenas ${g.salary_spread.toFixed(2)}x entre ${g.headcount} colaboradores.`,
        affected_employees: [],
        details: { spread: g.salary_spread, headcount: g.headcount },
      });
    }

    // High disparity: spread > 3x
    if (g.headcount >= 2 && g.salary_spread > 3) {
      alerts.push({
        alert_type: 'role_disparity',
        severity: 'critical',
        group: g.group_name,
        message: `Alta disparidade salarial no grupo "${g.group_name}" — diferença de ${g.salary_spread.toFixed(1)}x entre menor e maior salário.`,
        affected_employees: [],
        details: { spread: g.salary_spread, min: g.min_salary, max: g.max_salary },
      });
    }
  }

  // Outliers: employees > 2 std deviations from overall mean
  const threshold = overall.avg_salary + 2 * overall.std_deviation;
  const outliers = employees.filter(e => e.current_salary > threshold);
  if (outliers.length > 0) {
    alerts.push({
      alert_type: 'outlier',
      severity: 'info',
      group: 'Geral',
      message: `${outliers.length} colaborador(es) com salário acima de 2 desvios-padrão da média (>${Math.round(threshold).toLocaleString('pt-BR')}).`,
      affected_employees: outliers.map(e => e.id),
      details: { threshold, count: outliers.length },
    });
  }

  return alerts;
}

function emptyGroupStats(key: string): SalaryGroupStats {
  return {
    group_key: key, group_name: key, headcount: 0,
    min_salary: 0, max_salary: 0, avg_salary: 0, median_salary: 0,
    p25_salary: 0, p75_salary: 0, std_deviation: 0, total_folha: 0,
    avg_fator_custo: 0, salary_spread: 0,
  };
}

function emptyAnalysis(group_by: string): SalaryAnalysisOutput {
  return {
    group_by, groups: [], overall: emptyGroupStats('overall'),
    equity_alerts: [], distribution_skew: 'normal', compa_ratio_avg: 0,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
