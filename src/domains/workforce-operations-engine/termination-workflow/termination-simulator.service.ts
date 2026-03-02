/**
 * TerminationSimulator — Simulação de Rescisão com LegalRiskScore
 *
 * Features:
 *   - Aviso prévio: trabalhado, indenizado, reversão
 *   - LegalRiskScore pré-confirmação (0-100)
 *   - Análise de fatores de risco jurídico
 *   - Integração com RescissionCalculator existente
 */

import {
  calculateRescission,
  calculateAvisoPrevioDays,
  calculateProportionalMonths,
  type RescissionInput,
  type RescissionResult,
} from '@/domains/automated-offboarding/rescission-calculator.engine';
import type { OffboardingType, AvisoPrevioType } from '@/domains/automated-offboarding/types';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type RiskLevel = 'baixo' | 'moderado' | 'alto' | 'critico';

export interface LegalRiskFactor {
  code: string;
  description: string;
  severity: RiskLevel;
  weight: number;
  legal_basis: string | null;
  recommendation: string;
}

export interface LegalRiskScore {
  score: number;               // 0-100 (100 = sem risco)
  level: RiskLevel;
  factors: LegalRiskFactor[];
  blocking_factors: LegalRiskFactor[];
  summary: string;
  can_proceed: boolean;
  computed_at: string;
}

export interface TerminationSimulationInput {
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  offboarding_type: OffboardingType;
  aviso_previo_type: AvisoPrevioType;
  salario_base: number;
  data_admissao: string;
  data_desligamento: string;
  dias_trabalhados_mes: number;
  dias_no_mes: number;
  ferias_vencidas_periodos: number;
  saldo_fgts: number;
  dependentes_irrf?: number;
  acordo_mutuo?: boolean;
  descontos_diversos?: number;
  // Context for risk scoring
  has_pending_lawsuits?: boolean;
  is_pregnant?: boolean;
  is_cipeiro?: boolean;            // Membro CIPA
  is_union_representative?: boolean;
  is_accident_leave?: boolean;     // Afastamento por acidente
  is_sick_leave?: boolean;
  months_since_accident?: number;
  has_pending_epis?: boolean;
  has_pending_trainings?: boolean;
  has_pending_medical_exams?: boolean;
  justa_causa_evidence_count?: number;
  disciplinary_warnings_count?: number;
  motivo?: string;
  justa_causa_motivo?: string;
  justa_causa_artigo?: string;
}

export interface TerminationSimulationResult {
  rescission: RescissionResult;
  risk_score: LegalRiskScore;
  aviso_previo_days: number;
  aviso_previo_type: AvisoPrevioType;
  meses_ferias_proporcionais: number;
  meses_13_proporcional: number;
  anos_servico: number;
  scenarios: TerminationScenario[];
}

export interface TerminationScenario {
  type: AvisoPrevioType;
  label: string;
  aviso_previo_days: number;
  rescission: RescissionResult;
  cost_difference: number;
}

// ══════════════════════════════════════════════
// LEGAL RISK SCORER
// ══════════════════════════════════════════════

function computeLegalRiskScore(input: TerminationSimulationInput): LegalRiskScore {
  const factors: LegalRiskFactor[] = [];

  // ── Estabilidades Provisórias (BLOCK) ──

  if (input.is_pregnant) {
    factors.push({
      code: 'ESTABILIDADE_GESTANTE',
      description: 'Colaboradora gestante possui estabilidade provisória até 5 meses após o parto.',
      severity: 'critico',
      weight: 40,
      legal_basis: 'ADCT Art. 10, II, "b"',
      recommendation: 'Suspender desligamento. Apenas pedido de demissão é possível com homologação sindical.',
    });
  }

  if (input.is_cipeiro) {
    factors.push({
      code: 'ESTABILIDADE_CIPA',
      description: 'Membro da CIPA possui estabilidade desde a candidatura até 1 ano após o mandato.',
      severity: 'critico',
      weight: 35,
      legal_basis: 'CLT Art. 165 + ADCT Art. 10, II, "a"',
      recommendation: 'Verificar fim do mandato e prazo de estabilidade antes de prosseguir.',
    });
  }

  if (input.is_union_representative) {
    factors.push({
      code: 'ESTABILIDADE_SINDICAL',
      description: 'Dirigente sindical possui estabilidade do registro da candidatura até 1 ano após o mandato.',
      severity: 'critico',
      weight: 35,
      legal_basis: 'CLT Art. 543, §3º',
      recommendation: 'Desligamento apenas via inquérito judicial para apuração de falta grave.',
    });
  }

  if (input.is_accident_leave || (input.months_since_accident !== undefined && input.months_since_accident < 12)) {
    factors.push({
      code: 'ESTABILIDADE_ACIDENTE',
      description: 'Colaborador com estabilidade acidentária (12 meses após alta do INSS).',
      severity: 'critico',
      weight: 35,
      legal_basis: 'CLT Art. 118 + Lei 8.213/91, Art. 118',
      recommendation: 'Aguardar encerramento do período de estabilidade acidentária.',
    });
  }

  if (input.is_sick_leave) {
    factors.push({
      code: 'AFASTAMENTO_DOENCA',
      description: 'Colaborador em afastamento médico. Contrato suspenso.',
      severity: 'alto',
      weight: 25,
      legal_basis: 'CLT Art. 476',
      recommendation: 'Aguardar retorno do afastamento para proceder com desligamento.',
    });
  }

  // ── Justa Causa — Risco Probatório ──

  if (input.offboarding_type === 'justa_causa') {
    const evidenceCount = input.justa_causa_evidence_count ?? 0;
    const warningsCount = input.disciplinary_warnings_count ?? 0;

    if (evidenceCount < 2) {
      factors.push({
        code: 'JUSTA_CAUSA_PROVA_INSUFICIENTE',
        description: `Apenas ${evidenceCount} evidência(s) documentada(s). Risco alto de reversão judicial.`,
        severity: evidenceCount === 0 ? 'critico' : 'alto',
        weight: evidenceCount === 0 ? 30 : 20,
        legal_basis: 'CLT Art. 482 — Ônus da prova é do empregador',
        recommendation: 'Documentar evidências adicionais antes de aplicar justa causa.',
      });
    }

    if (warningsCount < 3) {
      factors.push({
        code: 'JUSTA_CAUSA_GRADACAO_INSUFICIENTE',
        description: `Apenas ${warningsCount} advertência(s)/suspensão(ões). Gradação punitiva pode ser questionada.`,
        severity: warningsCount === 0 ? 'alto' : 'moderado',
        weight: warningsCount === 0 ? 20 : 10,
        legal_basis: 'Princípio da gradação das penas — Jurisprudência TST',
        recommendation: 'Aplicar medidas disciplinares progressivas antes da justa causa.',
      });
    }

    if (!input.justa_causa_artigo) {
      factors.push({
        code: 'JUSTA_CAUSA_SEM_ENQUADRAMENTO',
        description: 'Falta grave sem enquadramento legal específico no Art. 482 da CLT.',
        severity: 'alto',
        weight: 15,
        legal_basis: 'CLT Art. 482',
        recommendation: 'Especificar a alínea do Art. 482 aplicável à falta grave.',
      });
    }
  }

  // ── Pendências SST ──

  if (input.has_pending_medical_exams) {
    factors.push({
      code: 'EXAME_DEMISSIONAL_PENDENTE',
      description: 'Exame demissional obrigatório não realizado.',
      severity: 'alto',
      weight: 15,
      legal_basis: 'NR-7, item 7.5.11 — ASO demissional obrigatório',
      recommendation: 'Agendar exame demissional antes de finalizar desligamento.',
    });
  }

  if (input.has_pending_epis) {
    factors.push({
      code: 'DEVOLUCAO_EPI_PENDENTE',
      description: 'EPIs não devolvidos. Risco de responsabilidade solidária.',
      severity: 'moderado',
      weight: 8,
      legal_basis: 'NR-6, item 6.7.1',
      recommendation: 'Cobrar devolução ou registrar termo de responsabilidade.',
    });
  }

  if (input.has_pending_trainings) {
    factors.push({
      code: 'TREINAMENTOS_NR_PENDENTES',
      description: 'Treinamentos NR obrigatórios não concluídos durante o vínculo.',
      severity: 'moderado',
      weight: 5,
      legal_basis: 'NRs aplicáveis',
      recommendation: 'Registrar pendência no TRCT para resguardo legal.',
    });
  }

  // ── Litígio ──

  if (input.has_pending_lawsuits) {
    factors.push({
      code: 'LITIGIO_ATIVO',
      description: 'Colaborador possui ação trabalhista em andamento contra a empresa.',
      severity: 'alto',
      weight: 20,
      legal_basis: 'Risco processual',
      recommendation: 'Consultar jurídico antes de prosseguir. Desligamento pode agravar litígio.',
    });
  }

  // ── Score Calculation ──

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const score = Math.max(0, Math.round(100 - totalWeight));
  const blockingFactors = factors.filter(f => f.severity === 'critico');

  let level: RiskLevel;
  if (score >= 90) level = 'baixo';
  else if (score >= 70) level = 'moderado';
  else if (score >= 50) level = 'alto';
  else level = 'critico';

  const canProceed = blockingFactors.length === 0 && score >= 50;

  let summary: string;
  if (canProceed && score >= 90) {
    summary = 'Baixo risco jurídico. Desligamento pode prosseguir com segurança.';
  } else if (canProceed) {
    summary = `Risco ${level}. Recomenda-se atenção aos fatores identificados antes de confirmar.`;
  } else {
    summary = `⚠️ BLOQUEIO: ${blockingFactors.length} fator(es) crítico(s) identificado(s). Desligamento NÃO recomendado.`;
  }

  return {
    score,
    level,
    factors,
    blocking_factors: blockingFactors,
    summary,
    can_proceed: canProceed,
    computed_at: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════
// SIMULATOR
// ══════════════════════════════════════════════

export function simulateTermination(input: TerminationSimulationInput): TerminationSimulationResult {
  const avisoPrevioDays = calculateAvisoPrevioDays(input.data_admissao, input.data_desligamento);
  const mesesFerias = calculateProportionalMonths(input.data_admissao, input.data_desligamento);
  const meses13 = calculateProportionalMonths(
    `${new Date(input.data_desligamento).getFullYear()}-01-01`,
    input.data_desligamento
  );

  const diffMs = new Date(input.data_desligamento).getTime() - new Date(input.data_admissao).getTime();
  const anosServico = Math.round((diffMs / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10;

  const baseInput: RescissionInput = {
    offboarding_type: input.offboarding_type,
    salario_base: input.salario_base,
    data_admissao: input.data_admissao,
    data_desligamento: input.data_desligamento,
    aviso_previo_type: input.aviso_previo_type,
    aviso_previo_days: avisoPrevioDays,
    dias_trabalhados_mes: input.dias_trabalhados_mes,
    dias_no_mes: input.dias_no_mes,
    ferias_vencidas_periodos: input.ferias_vencidas_periodos,
    meses_ferias_proporcionais: mesesFerias,
    meses_13_proporcional: meses13,
    saldo_fgts: input.saldo_fgts,
    dependentes_irrf: input.dependentes_irrf,
    acordo_mutuo: input.acordo_mutuo,
    descontos_diversos: input.descontos_diversos,
  };

  // Primary simulation
  const rescission = calculateRescission(baseInput);

  // Risk score
  const riskScore = computeLegalRiskScore(input);

  // Generate comparison scenarios
  const scenarios: TerminationScenario[] = [];

  // Scenario: Trabalhado
  const scenarioTrabalhado = calculateRescission({
    ...baseInput,
    aviso_previo_type: 'trabalhado',
  });
  scenarios.push({
    type: 'trabalhado',
    label: 'Aviso Prévio Trabalhado',
    aviso_previo_days: avisoPrevioDays,
    rescission: scenarioTrabalhado,
    cost_difference: scenarioTrabalhado.valor_liquido - rescission.valor_liquido,
  });

  // Scenario: Indenizado
  const scenarioIndenizado = calculateRescission({
    ...baseInput,
    aviso_previo_type: 'indenizado',
  });
  scenarios.push({
    type: 'indenizado',
    label: 'Aviso Prévio Indenizado',
    aviso_previo_days: avisoPrevioDays,
    rescission: scenarioIndenizado,
    cost_difference: scenarioIndenizado.valor_liquido - rescission.valor_liquido,
  });

  // Scenario: Reversão (justa causa → sem justa causa)
  if (input.offboarding_type === 'justa_causa') {
    const scenarioReversao = calculateRescission({
      ...baseInput,
      offboarding_type: 'sem_justa_causa',
      aviso_previo_type: 'indenizado',
    });
    scenarios.push({
      type: 'indenizado',
      label: '⚠️ Reversão Judicial (Justa Causa → Sem Justa Causa)',
      aviso_previo_days: avisoPrevioDays,
      rescission: scenarioReversao,
      cost_difference: scenarioReversao.valor_liquido - rescission.valor_liquido,
    });
  }

  return {
    rescission,
    risk_score: riskScore,
    aviso_previo_days: avisoPrevioDays,
    aviso_previo_type: input.aviso_previo_type,
    meses_ferias_proporcionais: mesesFerias,
    meses_13_proporcional: meses13,
    anos_servico: anosServico,
    scenarios,
  };
}

// ── Singleton service wrapper ──

export class TerminationSimulatorService {
  simulate(input: TerminationSimulationInput): TerminationSimulationResult {
    return simulateTermination(input);
  }

  computeRiskScore(input: TerminationSimulationInput): LegalRiskScore {
    return computeLegalRiskScore(input);
  }

  /**
   * Quick estimate: just risk score without full rescission calc
   */
  quickRiskAssessment(params: {
    offboarding_type: OffboardingType;
    is_pregnant?: boolean;
    is_cipeiro?: boolean;
    is_union_representative?: boolean;
    is_accident_leave?: boolean;
    months_since_accident?: number;
    has_pending_lawsuits?: boolean;
    justa_causa_evidence_count?: number;
    disciplinary_warnings_count?: number;
  }): LegalRiskScore {
    return computeLegalRiskScore({
      tenant_id: '',
      employee_id: '',
      employee_name: '',
      salario_base: 0,
      data_admissao: '',
      data_desligamento: '',
      dias_trabalhados_mes: 0,
      dias_no_mes: 30,
      ferias_vencidas_periodos: 0,
      saldo_fgts: 0,
      aviso_previo_type: 'nao_aplicavel',
      ...params,
    });
  }
}

let _instance: TerminationSimulatorService | null = null;
export function getTerminationSimulatorService(): TerminationSimulatorService {
  if (!_instance) _instance = new TerminationSimulatorService();
  return _instance;
}
