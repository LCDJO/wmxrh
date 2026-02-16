/**
 * Risk Detection Engine
 *
 * Scans workforce dataset for labor law violations, health/safety gaps,
 * cost anomalies, and contract irregularities.
 * Pure function — no I/O.
 */

import type {
  RiskDetectionInput,
  RiskDetectionOutput,
  LaborRisk,
  RiskCategory,
  WorkforceDataset,
} from './types';

const DEFAULT_MAX_OVERTIME = 44; // CLT Art. 59

export function detectRisks(input: RiskDetectionInput): RiskDetectionOutput {
  const { dataset, piso_cct, max_overtime_hours = DEFAULT_MAX_OVERTIME } = input;
  const risks: LaborRisk[] = [];
  let riskIdCounter = 0;
  const rid = () => `WIR-${String(++riskIdCounter).padStart(3, '0')}`;
  const now = dataset.analysis_date;

  // ── 1. Salary compliance ──
  if (piso_cct && piso_cct > 0) {
    const below = dataset.employees.filter(e => e.status === 'active' && e.current_salary > 0 && e.current_salary < piso_cct);
    if (below.length > 0) {
      const exposure = below.reduce((s, e) => s + (piso_cct - e.current_salary) * 12, 0);
      risks.push({
        risk_id: rid(), category: 'salary_compliance', severity: 'critical',
        title: 'Salários abaixo do piso CCT',
        description: `${below.length} colaborador(es) com salário abaixo do piso convencional de R$ ${piso_cct.toLocaleString('pt-BR')}.`,
        affected_employees: below.map(e => e.id), affected_count: below.length,
        financial_exposure: round(exposure),
        legal_basis: 'CLT Art. 611-A / Convenção Coletiva',
        recommended_action: 'Ajustar salários ao piso da CCT vigente imediatamente.',
        detection_date: now,
      });
    }
  }

  // ── 2. Health & Safety gaps ──
  const overdueExams = dataset.compliance.filter(c => c.exam_overdue);
  if (overdueExams.length > 0) {
    risks.push({
      risk_id: rid(), category: 'health_safety', severity: 'high',
      title: 'Exames ocupacionais vencidos',
      description: `${overdueExams.length} colaborador(es) com exames periódicos vencidos (PCMSO).`,
      affected_employees: overdueExams.map(c => c.employee_id), affected_count: overdueExams.length,
      financial_exposure: round(overdueExams.length * 3000), // avg fine estimate
      legal_basis: 'NR-7 / CLT Art. 168',
      recommended_action: 'Agendar exames periódicos com urgência.',
      detection_date: now,
    });
  }

  // Risk exposure without hazard pay
  const missingHazard = dataset.compliance.filter(c => c.has_risk_exposure && !c.has_hazard_pay);
  if (missingHazard.length > 0) {
    risks.push({
      risk_id: rid(), category: 'health_safety', severity: 'critical',
      title: 'Exposição a risco sem adicional',
      description: `${missingHazard.length} colaborador(es) expostos a riscos ocupacionais sem adicional de insalubridade/periculosidade.`,
      affected_employees: missingHazard.map(c => c.employee_id), affected_count: missingHazard.length,
      financial_exposure: round(missingHazard.length * 5000 * 12),
      legal_basis: 'CLT Art. 189-197 / NR-15 / NR-16',
      recommended_action: 'Avaliar GHE e conceder adicional correspondente.',
      detection_date: now,
    });
  }

  // ── 3. Compliance violations ──
  const withViolations = dataset.compliance.filter(c => c.open_violations > 0);
  const criticalViolations = withViolations.filter(c => c.violation_severities.includes('critical'));
  if (criticalViolations.length > 0) {
    risks.push({
      risk_id: rid(), category: 'contract_irregularity', severity: 'critical',
      title: 'Violações trabalhistas críticas em aberto',
      description: `${criticalViolations.length} colaborador(es) com violações de severidade crítica não resolvidas.`,
      affected_employees: criticalViolations.map(c => c.employee_id), affected_count: criticalViolations.length,
      financial_exposure: round(criticalViolations.length * 10000),
      recommended_action: 'Resolver violações críticas e documentar ações corretivas.',
      detection_date: now,
    });
  }

  // ── 4. Cost anomalies ──
  const sims = dataset.simulations;
  if (sims.length >= 3) {
    const fatores = sims.map(s => s.fator_custo);
    const avgFator = fatores.reduce((s, f) => s + f, 0) / fatores.length;
    const highCost = sims.filter(s => s.fator_custo > avgFator * 1.5);
    if (highCost.length > 0) {
      risks.push({
        risk_id: rid(), category: 'cost_anomaly', severity: 'medium',
        title: 'Fator de custo anômalo',
        description: `${highCost.length} colaborador(es) com fator custo 50%+ acima da média (${avgFator.toFixed(2)}x).`,
        affected_employees: highCost.map(s => s.employee_id), affected_count: highCost.length,
        financial_exposure: round(highCost.reduce((s, c) => s + c.custo_total_empregador - c.salario_base * avgFator, 0)),
        recommended_action: 'Revisar composição de custos dos colaboradores destacados.',
        detection_date: now,
      });
    }
  }

  // ── 5. Benefit gaps ──
  const employeesWithBenefits = new Set(dataset.benefits.filter(b => b.is_active).map(b => b.employee_id));
  const activeEmps = dataset.employees.filter(e => e.status === 'active');
  const noBenefits = activeEmps.filter(e => !employeesWithBenefits.has(e.id));
  if (noBenefits.length > 0 && activeEmps.length > 0 && noBenefits.length / activeEmps.length > 0.2) {
    risks.push({
      risk_id: rid(), category: 'benefit_gap', severity: 'medium',
      title: 'Colaboradores sem benefícios',
      description: `${noBenefits.length} colaborador(es) ativos (${Math.round(noBenefits.length / activeEmps.length * 100)}%) sem nenhum benefício ativo.`,
      affected_employees: noBenefits.map(e => e.id), affected_count: noBenefits.length,
      financial_exposure: 0,
      recommended_action: 'Avaliar elegibilidade e incluir nos planos de benefícios.',
      detection_date: now,
    });
  }

  // ── Score calculation ──
  const severityWeight = { critical: 25, high: 15, medium: 8, low: 3 };
  const rawScore = risks.reduce((s, r) => s + (severityWeight[r.severity] || 0), 0);
  const risk_score = Math.min(100, rawScore);

  return {
    total_risks: risks.length,
    critical_count: risks.filter(r => r.severity === 'critical').length,
    high_count: risks.filter(r => r.severity === 'high').length,
    medium_count: risks.filter(r => r.severity === 'medium').length,
    low_count: risks.filter(r => r.severity === 'low').length,
    total_financial_exposure: round(risks.reduce((s, r) => s + r.financial_exposure, 0)),
    risks: risks.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity)),
    risk_score,
    risk_trend: 'stable',
  };
}

function severityOrder(s: string): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[s] ?? 4;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
