/**
 * Risk Detection Engine
 *
 * Scans workforce dataset for labor law violations, health/safety gaps,
 * cost anomalies, and contract irregularities.
 *
 * Detected rules:
 *  1. Salário abaixo do piso sindical (LEGAL_RISK)
 *  2. Excesso de horas extras recorrentes (LEGAL_RISK)
 *  3. Adicional sem exposição de risco registrada (COMPLIANCE_WARNING)
 *  4. Exames PCMSO vencidos (COMPLIANCE_WARNING)
 *  5. Empresa sem programa PGR ativo (LEGAL_RISK)
 *  6. Exposição a risco sem adicional (LEGAL_RISK)
 *  7. Violações trabalhistas críticas (LEGAL_RISK)
 *  8. Fator de custo anômalo (FINANCIAL_RISK)
 *  9. Colaboradores sem benefícios (FINANCIAL_RISK)
 *
 * Pure function — no I/O.
 */

import type {
  RiskDetectionInput,
  RiskDetectionOutput,
  LaborRisk,
  WorkforceDataset,
  WorkforceInsightType,
} from './types';

const DEFAULT_MAX_OVERTIME = 44; // CLT Art. 59

export function detectRisks(input: RiskDetectionInput): RiskDetectionOutput {
  const { dataset, piso_cct, max_overtime_hours = DEFAULT_MAX_OVERTIME } = input;
  const risks: LaborRisk[] = [];
  let riskIdCounter = 0;
  const rid = () => `WIR-${String(++riskIdCounter).padStart(3, '0')}`;
  const now = dataset.analysis_date;

  const push = (
    category: LaborRisk['category'],
    insight_type: WorkforceInsightType,
    severity: LaborRisk['severity'],
    title: string,
    description: string,
    affected: string[],
    financial_exposure: number,
    recommended_action: string,
    legal_basis?: string,
  ) => {
    risks.push({
      risk_id: rid(), category, insight_type, severity, title, description,
      affected_employees: affected, affected_count: affected.length,
      financial_exposure: round(financial_exposure),
      legal_basis, recommended_action, detection_date: now,
    });
  };

  // ── 1. Salário abaixo do piso sindical ──
  if (piso_cct && piso_cct > 0) {
    const below = dataset.employees.filter(e => e.status === 'active' && e.current_salary > 0 && e.current_salary < piso_cct);
    if (below.length > 0) {
      const exposure = below.reduce((s, e) => s + (piso_cct - e.current_salary) * 12, 0);
      push('salary_compliance', 'LEGAL_RISK', 'critical',
        'Salários abaixo do piso CCT',
        `${below.length} colaborador(es) com salário abaixo do piso convencional de R$ ${piso_cct.toLocaleString('pt-BR')}.`,
        below.map(e => e.id), exposure,
        'Ajustar salários ao piso da CCT vigente imediatamente.',
        'CLT Art. 611-A / Convenção Coletiva',
      );
    }
  }

  // ── 2. Excesso de horas extras recorrentes ──
  const overtimeAbuse = dataset.compliance.filter(c =>
    c.avg_overtime_hours != null && c.avg_overtime_hours > max_overtime_hours
  );
  if (overtimeAbuse.length > 0) {
    const avgExcess = overtimeAbuse.reduce((s, c) => s + ((c.avg_overtime_hours ?? 0) - max_overtime_hours), 0) / overtimeAbuse.length;
    push('overtime_exposure', 'LEGAL_RISK', 'high',
      'Excesso de horas extras recorrentes',
      `${overtimeAbuse.length} colaborador(es) com média de HE acima de ${max_overtime_hours}h/mês (excesso médio: ${avgExcess.toFixed(1)}h).`,
      overtimeAbuse.map(c => c.employee_id),
      overtimeAbuse.length * 2000 * 12, // estimated annual exposure per employee
      'Revisar banco de horas e escalas; avaliar contratação para reduzir dependência de HE.',
      'CLT Art. 59 / Súmula 376 TST',
    );
  }

  // ── 3. Adicional sem exposição de risco registrada ──
  const hazardWithoutExposure = dataset.compliance.filter(c => c.has_hazard_pay_without_exposure);
  if (hazardWithoutExposure.length > 0) {
    push('contract_irregularity', 'COMPLIANCE_WARNING', 'medium',
      'Adicional de insalubridade/periculosidade sem exposição registrada',
      `${hazardWithoutExposure.length} colaborador(es) recebem adicional sem registro de exposição a risco no GHE/LTCAT.`,
      hazardWithoutExposure.map(c => c.employee_id),
      hazardWithoutExposure.length * 3000,
      'Atualizar LTCAT/GHE ou suspender adicional indevido após avaliação técnica.',
      'CLT Art. 189-197 / NR-15 / NR-16',
    );
  }

  // ── 4. Exames PCMSO vencidos ──
  const overdueExams = dataset.compliance.filter(c => c.exam_overdue);
  if (overdueExams.length > 0) {
    push('health_safety', 'COMPLIANCE_WARNING', 'high',
      'Exames ocupacionais vencidos',
      `${overdueExams.length} colaborador(es) com exames periódicos vencidos (PCMSO).`,
      overdueExams.map(c => c.employee_id),
      overdueExams.length * 3000,
      'Agendar exames periódicos com urgência.',
      'NR-7 / CLT Art. 168',
    );
  }

  // ── 5. Empresa sem programa PGR ativo ──
  const noPGR = dataset.compliance.filter(c => c.has_active_pgr === false);
  if (noPGR.length > 0) {
    // Group by unique company (avoid duplicating the risk)
    const uniqueCompanies = new Set(
      dataset.employees
        .filter(e => noPGR.some(c => c.employee_id === e.id))
        .map(e => e.company_id)
    );
    push('health_safety', 'LEGAL_RISK', 'critical',
      'Empresa(s) sem Programa de Gerenciamento de Riscos (PGR) ativo',
      `${uniqueCompanies.size} empresa(s) sem PGR vigente, afetando ${noPGR.length} colaborador(es).`,
      noPGR.map(c => c.employee_id),
      uniqueCompanies.size * 50000, // multa estimada por empresa
      'Elaborar ou renovar o PGR imediatamente conforme NR-1.',
      'NR-1 (nova redação) / CLT Art. 157',
    );
  }

  // ── 6. Exposição a risco sem adicional ──
  const missingHazard = dataset.compliance.filter(c => c.has_risk_exposure && !c.has_hazard_pay);
  if (missingHazard.length > 0) {
    push('health_safety', 'LEGAL_RISK', 'critical',
      'Exposição a risco sem adicional',
      `${missingHazard.length} colaborador(es) expostos a riscos ocupacionais sem adicional de insalubridade/periculosidade.`,
      missingHazard.map(c => c.employee_id),
      missingHazard.length * 5000 * 12,
      'Avaliar GHE e conceder adicional correspondente.',
      'CLT Art. 189-197 / NR-15 / NR-16',
    );
  }

  // ── 7. Violações trabalhistas críticas ──
  const criticalViolations = dataset.compliance.filter(c => c.open_violations > 0 && c.violation_severities.includes('critical'));
  if (criticalViolations.length > 0) {
    push('contract_irregularity', 'LEGAL_RISK', 'critical',
      'Violações trabalhistas críticas em aberto',
      `${criticalViolations.length} colaborador(es) com violações de severidade crítica não resolvidas.`,
      criticalViolations.map(c => c.employee_id),
      criticalViolations.length * 10000,
      'Resolver violações críticas e documentar ações corretivas.',
    );
  }

  // ── 8. Fator de custo anômalo ──
  const sims = dataset.simulations;
  if (sims.length >= 3) {
    const fatores = sims.map(s => s.fator_custo);
    const avgFator = fatores.reduce((s, f) => s + f, 0) / fatores.length;
    const highCost = sims.filter(s => s.fator_custo > avgFator * 1.5);
    if (highCost.length > 0) {
      push('cost_anomaly', 'FINANCIAL_RISK', 'medium',
        'Fator de custo anômalo',
        `${highCost.length} colaborador(es) com fator custo 50%+ acima da média (${avgFator.toFixed(2)}x).`,
        highCost.map(s => s.employee_id),
        highCost.reduce((s, c) => s + c.custo_total_empregador - c.salario_base * avgFator, 0),
        'Revisar composição de custos dos colaboradores destacados.',
      );
    }
  }

  // ── 9. Colaboradores sem benefícios ──
  const employeesWithBenefits = new Set(dataset.benefits.filter(b => b.is_active).map(b => b.employee_id));
  const activeEmps = dataset.employees.filter(e => e.status === 'active');
  const noBenefits = activeEmps.filter(e => !employeesWithBenefits.has(e.id));
  if (noBenefits.length > 0 && activeEmps.length > 0 && noBenefits.length / activeEmps.length > 0.2) {
    push('benefit_gap', 'FINANCIAL_RISK', 'medium',
      'Colaboradores sem benefícios',
      `${noBenefits.length} colaborador(es) ativos (${Math.round(noBenefits.length / activeEmps.length * 100)}%) sem nenhum benefício ativo.`,
      noBenefits.map(e => e.id), 0,
      'Avaliar elegibilidade e incluir nos planos de benefícios.',
    );
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
