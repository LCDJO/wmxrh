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

  // ── 10. Empresa sem treinamento NR obrigatório ──
  if (dataset.occupational && dataset.occupational.length > 0) {
    const pendingTraining = dataset.occupational.filter(o => o.has_pending_trainings && o.pending_training_count > 0);
    if (pendingTraining.length > 0) {
      const totalPending = pendingTraining.reduce((s, o) => s + o.pending_training_count, 0);
      const affectedEmps = dataset.employees
        .filter(e => e.status === 'active' && pendingTraining.some(o => o.company_id === e.company_id))
        .map(e => e.id);
      push('occupational_training', 'COMPLIANCE_WARNING', 'high',
        'Treinamentos NR obrigatórios pendentes',
        `${pendingTraining.length} empresa(s) com ${totalPending} treinamento(s) NR obrigatório(s) não realizados, afetando ${affectedEmps.length} colaborador(es).`,
        affectedEmps, pendingTraining.length * 5000,
        'Agendar treinamentos NR obrigatórios pendentes com urgência.',
        'NR-1 / CLT Art. 157',
      );
    }
  }

  // ── 11. Cargos sem CBO definido ──
  if (dataset.cbo_assignments && dataset.cbo_assignments.length > 0) {
    const noCbo = dataset.cbo_assignments.filter(c => !c.has_cbo_defined);
    if (noCbo.length > 0) {
      push('cbo_gap', 'COMPLIANCE_WARNING', 'medium',
        'Cargos sem CBO definido',
        `${noCbo.length} colaborador(es) sem código CBO atribuído ao cargo, prejudicando conformidade eSocial e relatórios ocupacionais.`,
        noCbo.map(c => c.employee_id), noCbo.length * 1000,
        'Definir CBO para todos os cargos ativos conforme tabela CBO do MTE.',
        'eSocial S-2200 / Portaria MTE',
      );
    }
  }

  // ── 12. Risco alto sem PGR ativo ──
  if (dataset.occupational && dataset.occupational.length > 0) {
    const highRiskNoPgr = dataset.occupational.filter(o => o.grau_risco >= 3 && !o.has_active_pgr);
    if (highRiskNoPgr.length > 0) {
      const affectedEmps = dataset.employees
        .filter(e => e.status === 'active' && highRiskNoPgr.some(o => o.company_id === e.company_id))
        .map(e => e.id);
      push('health_safety', 'LEGAL_RISK', 'critical',
        'Risco ocupacional alto sem PGR ativo',
        `${highRiskNoPgr.length} empresa(s) com grau de risco ≥ 3 sem Programa de Gerenciamento de Riscos ativo, afetando ${affectedEmps.length} colaborador(es).`,
        affectedEmps, highRiskNoPgr.length * 80000,
        'Elaborar PGR imediatamente — obrigatório para atividades de alto risco.',
        'NR-1 / NR-9 / CLT Art. 157',
      );
    }
  }

  // ── 13. NR Compliance Risk — expired NR trainings ──
  if (dataset.nr_trainings && dataset.nr_trainings.length > 0) {
    const expired = dataset.nr_trainings.filter(t => t.status === 'expired');
    if (expired.length > 0) {
      const uniqueNrs = new Set(expired.map(t => t.nr_number));
      const affectedEmpIds = [...new Set(expired.map(t => t.employee_id))];
      push('nr_compliance', 'COMPLIANCE_WARNING', 'high',
        'Treinamentos NR vencidos',
        `${expired.length} treinamento(s) NR vencido(s) (NR-${[...uniqueNrs].join(', NR-')}), afetando ${affectedEmpIds.length} colaborador(es).`,
        affectedEmpIds, affectedEmpIds.length * 5000,
        'Reagendar treinamentos NR vencidos com urgência para manter conformidade.',
        'NR-1 / CLT Art. 157',
      );
    }
  }

  // ── 14. Training Gap Detected — overdue NR trainings ──
  if (dataset.nr_trainings && dataset.nr_trainings.length > 0) {
    const overdue = dataset.nr_trainings.filter(t => t.status === 'overdue');
    if (overdue.length > 0) {
      const affectedEmpIds = [...new Set(overdue.map(t => t.employee_id))];
      push('training_gap', 'LEGAL_RISK', 'critical',
        'Lacunas de treinamento NR detectadas',
        `${overdue.length} treinamento(s) NR em atraso para ${affectedEmpIds.length} colaborador(es). Colaboradores podem estar operando sem qualificação obrigatória.`,
        affectedEmpIds, affectedEmpIds.length * 10000,
        'Bloquear operações de risco e providenciar treinamentos imediatamente.',
        'NR-1 Art. 1.7 / CLT Art. 157-158',
      );
    }
  }

  // ── 15. Operational Risk Detected — employees with hard/soft blocks ──
  if (dataset.nr_trainings && dataset.nr_trainings.length > 0) {
    const blocked = dataset.nr_trainings.filter(t =>
      t.blocking_level === 'hard_block' || t.blocking_level === 'soft_block'
    );
    if (blocked.length > 0) {
      const hardBlocked = blocked.filter(t => t.blocking_level === 'hard_block');
      const affectedEmpIds = [...new Set(blocked.map(t => t.employee_id))];
      const hardBlockedEmpIds = [...new Set(hardBlocked.map(t => t.employee_id))];
      push('operational_risk', 'LEGAL_RISK', hardBlockedEmpIds.length > 0 ? 'critical' : 'high',
        'Risco operacional — funcionários bloqueados',
        `${affectedEmpIds.length} colaborador(es) com restrição operacional (${hardBlockedEmpIds.length} bloqueio total). Operação em atividades de risco sem treinamento válido configura responsabilidade civil e criminal.`,
        affectedEmpIds, hardBlockedEmpIds.length * 50000 + (affectedEmpIds.length - hardBlockedEmpIds.length) * 15000,
        'Afastar colaboradores bloqueados de atividades de risco até regularização dos treinamentos.',
        'CLT Art. 157 / NR-1 / Código Penal Art. 132',
      );
    }
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
