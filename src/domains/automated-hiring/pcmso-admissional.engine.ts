/**
 * Automated Hiring — Etapa 3: PCMSO (Exame Admissional)
 *
 * Manages the mandatory admissional health exam (ASO) step.
 *
 * Rules (NR-7 / CLT Art. 168):
 * - ASO admissional MUST be performed BEFORE employee starts work
 * - Result must be "apto" (fit) to proceed
 * - "inapto" (unfit) blocks the entire hiring process
 * - "apto_com_restricao" allows advancement with warnings
 *
 * Integrations:
 * - PCMSO module (exam scheduling & results)
 * - Occupational Intelligence (risk-based additional exams)
 * - Safety Automation Engine (inapto → trigger alert)
 */

import type { HiringWorkflow, ComplianceBlocker } from './types';
import type { ExameObrigatorio } from './analise-legal-cargo.engine';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export type AsoResultado = 'apto' | 'inapto' | 'apto_com_restricao';

export interface ExameAdmissionalInput {
  /** Was the ASO exam performed? */
  exame_realizado: boolean;
  /** ASO result */
  resultado: AsoResultado | null;
  /** Date the exam was performed */
  data_exame: string | null;
  /** Name of the examining physician */
  medico_nome: string | null;
  /** CRM of the examining physician */
  medico_crm: string | null;
  /** Restrictions noted (if apto_com_restricao) */
  restricoes: string | null;
  /** Additional exams from Etapa 2 */
  exames_complementares: ExameComplementarResult[];
  /** Risk grade from Etapa 2 (determines exam periodicity) */
  grau_risco: number;
}

export interface ExameComplementarResult {
  tipo: string;
  descricao: string;
  realizado: boolean;
  resultado: 'normal' | 'alterado' | 'pendente';
  data_exame: string | null;
  observacao: string | null;
}

export interface PcmsoEtapaResult {
  valid: boolean;
  blockers: ComplianceBlocker[];
  warnings: ComplianceBlocker[];
  aso_status: 'pendente' | 'apto' | 'inapto' | 'apto_com_restricao';
  exames_pendentes: string[];
  proxima_periodicidade_meses: number;
  evaluated_at: string;
}

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

function mkBlocker(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'blocker', message: msg, legal_basis: basis ?? null, step: 'health_exam' };
}

function mkWarning(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'warning', message: msg, legal_basis: basis ?? null, step: 'health_exam' };
}

// ═══════════════════════════════════════════════
//  Engine
// ═══════════════════════════════════════════════

export function validateExameAdmissional(input: ExameAdmissionalInput): PcmsoEtapaResult {
  const blockers: ComplianceBlocker[] = [];
  const warnings: ComplianceBlocker[] = [];

  // ── 1. Exame realizado? ──
  if (!input.exame_realizado) {
    blockers.push(mkBlocker(
      'ASO_NOT_PERFORMED',
      'ASO admissional não realizado — exame é obrigatório antes do início das atividades',
      'NR-7, item 7.5.3 / CLT Art. 168',
    ));

    return {
      valid: false,
      blockers,
      warnings,
      aso_status: 'pendente',
      exames_pendentes: ['ASO Admissional'],
      proxima_periodicidade_meses: input.grau_risco >= 3 ? 12 : 24,
      evaluated_at: new Date().toISOString(),
    };
  }

  // ── 2. Data do exame ──
  if (!input.data_exame) {
    blockers.push(mkBlocker('ASO_NO_DATE', 'Data do exame admissional não informada', 'NR-7'));
  }

  // ── 3. Médico responsável ──
  if (!input.medico_nome || !input.medico_crm) {
    warnings.push(mkWarning('ASO_NO_PHYSICIAN', 'Dados do médico examinador incompletos (nome/CRM)', 'NR-7'));
  }

  // ── 4. Resultado do ASO ──
  if (!input.resultado) {
    blockers.push(mkBlocker('ASO_NO_RESULT', 'Resultado do ASO não registrado', 'NR-7'));
  } else if (input.resultado === 'inapto') {
    blockers.push(mkBlocker(
      'ASO_INAPTO',
      'Colaborador considerado INAPTO no exame admissional — processo de admissão bloqueado',
      'NR-7, item 7.5.3 / CLT Art. 168',
    ));
  } else if (input.resultado === 'apto_com_restricao') {
    warnings.push(mkWarning(
      'ASO_RESTRICAO',
      `Colaborador apto com restrições: ${input.restricoes || 'não especificadas'} — avaliar compatibilidade com o cargo`,
      'NR-7',
    ));
  }

  // ── 5. Exames complementares pendentes ──
  const examesPendentes: string[] = [];
  for (const ec of input.exames_complementares) {
    if (!ec.realizado) {
      examesPendentes.push(ec.descricao);
    } else if (ec.resultado === 'alterado') {
      warnings.push(mkWarning(
        `EXAM_ALTERED_${ec.tipo.toUpperCase()}`,
        `Exame complementar "${ec.descricao}" com resultado alterado — avaliar com médico do trabalho`,
        'NR-7',
      ));
    }
  }

  if (examesPendentes.length > 0) {
    blockers.push(mkBlocker(
      'COMPLEMENTARY_EXAMS_PENDING',
      `${examesPendentes.length} exame(s) complementar(es) pendente(s): ${examesPendentes.join(', ')}`,
      'NR-7',
    ));
  }

  const asoStatus: PcmsoEtapaResult['aso_status'] =
    !input.resultado ? 'pendente' : input.resultado;

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
    aso_status: asoStatus,
    exames_pendentes: examesPendentes,
    proxima_periodicidade_meses: input.grau_risco >= 3 ? 12 : 24,
    evaluated_at: new Date().toISOString(),
  };
}

/**
 * Derive complementary exam inputs from Etapa 2 results.
 */
export function buildComplementaryExamChecklist(
  examesObrigatorios: ExameObrigatorio[],
): ExameComplementarResult[] {
  return examesObrigatorios
    .filter(e => e.tipo === 'admissional' && e.descricao !== 'ASO Admissional')
    .map(e => ({
      tipo: e.tipo,
      descricao: e.descricao,
      realizado: false,
      resultado: 'pendente' as const,
      data_exame: null,
      observacao: null,
    }));
}

/**
 * Apply Etapa 3 to workflow state machine.
 */
export function applyPcmsoToWorkflow(
  workflow: HiringWorkflow,
  input: ExameAdmissionalInput,
): { workflow: HiringWorkflow; result: PcmsoEtapaResult } {
  const result = validateExameAdmissional(input);
  const now = new Date().toISOString();

  const healthStep = workflow.steps.find(s => s.step === 'health_exam')!;

  if (result.valid) {
    healthStep.status = 'completed';
    healthStep.completed_at = now;
    healthStep.error_message = null;
    healthStep.metadata = {
      aso_status: result.aso_status,
      data_exame: input.data_exame,
      medico_crm: input.medico_crm,
      restricoes: input.restricoes,
      exames_complementares_ok: input.exames_complementares.filter(e => e.realizado).length,
      proxima_periodicidade_meses: result.proxima_periodicidade_meses,
      validated_at: now,
    };

    // Advance to NR training
    workflow.current_step = 'nr_training';
    workflow.status = 'exams_pending'; // Exams done, moving to SST
    const nrStep = workflow.steps.find(s => s.step === 'nr_training')!;
    nrStep.status = 'in_progress';
    nrStep.started_at = now;
  } else {
    healthStep.status = 'blocked';
    healthStep.error_message = result.blockers.map(b => b.message).join('; ');

    // If inapto, block the entire process
    if (result.aso_status === 'inapto') {
      workflow.status = 'blocked';
    } else {
      workflow.status = 'exams_pending';
    }
  }

  workflow.updated_at = now;
  return { workflow, result };
}
