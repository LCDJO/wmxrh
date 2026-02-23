/**
 * Automated Hiring — Etapa 8: Validação Final
 *
 * Comprehensive pre-activation checklist that cross-validates
 * all previous steps before allowing eSocial submission.
 *
 * Checklist:
 * 1. Exame admissional = apto (Etapa 3)
 * 2. Treinamentos pré-atividade concluídos (Etapa 4)
 * 3. EPIs entregues + termo assinado (Etapa 5)
 * 4. Termos obrigatórios assinados (Etapa 6)
 * 5. Fleet compliance (Etapa 7, se aplicável)
 * 6. Salário dentro do piso (Etapa 2)
 * 7. Categoria eSocial válida (Etapa 1)
 * 8. Dados cadastrais completos para S-2200
 *
 * Result: can_activate = true → status = 'ready_for_esocial'
 */

import type { HiringWorkflow, ComplianceBlocker, ComplianceGateResult } from './types';
import type { PcmsoEtapaResult } from './pcmso-admissional.engine';
import type { NrTrainingEtapaResult } from './nr-training-admission.engine';
import type { EpiEtapaResult } from './epi-delivery.engine';
import type { AgreementEtapaResult } from './agreements-admission.engine';
import type { FleetEtapaResult } from './fleet-admission.engine';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export interface ValidacaoFinalInput {
  workflow: HiringWorkflow;

  // ── Step results ──
  pcmso: PcmsoEtapaResult | null;
  nr_training: NrTrainingEtapaResult | null;
  epi: EpiEtapaResult | null;
  agreements: AgreementEtapaResult | null;
  fleet: FleetEtapaResult | null;

  // ── Supplementary checks ──
  salario_proposto: number;
  piso_salarial: number;
  esocial_category_valid: boolean;
  cbo_code: string | null;

  // ── Cadastral completeness ──
  has_complete_personal_data: boolean;
  has_complete_address: boolean;
  has_complete_documents: boolean;
  has_contract: boolean;
}

export interface ValidacaoFinalCheckItem {
  code: string;
  label: string;
  passed: boolean;
  blocker: ComplianceBlocker | null;
}

export interface ValidacaoFinalResult {
  can_activate: boolean;
  checklist: ValidacaoFinalCheckItem[];
  blockers: ComplianceBlocker[];
  warnings: ComplianceBlocker[];
  score: number; // 0-100 completeness
  evaluated_at: string;
}

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

function mkBlocker(code: string, msg: string, step: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'blocker', message: msg, legal_basis: basis ?? null, step: step as any };
}

function mkWarning(code: string, msg: string, step: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'warning', message: msg, legal_basis: basis ?? null, step: step as any };
}

function check(code: string, label: string, passed: boolean, blocker?: ComplianceBlocker): ValidacaoFinalCheckItem {
  return { code, label, passed, blocker: passed ? null : (blocker ?? null) };
}

// ═══════════════════════════════════════════════
//  Engine
// ═══════════════════════════════════════════════

export function runValidacaoFinal(input: ValidacaoFinalInput): ValidacaoFinalResult {
  const checklist: ValidacaoFinalCheckItem[] = [];
  const blockers: ComplianceBlocker[] = [];
  const warnings: ComplianceBlocker[] = [];

  // ── 1. Exame Admissional ──
  const asoOk = input.pcmso !== null && input.pcmso.valid && input.pcmso.aso_status === 'apto';
  const asoAptoComRestricao = input.pcmso?.aso_status === 'apto_com_restricao';

  if (!asoOk && !asoAptoComRestricao) {
    const b = mkBlocker('FINAL_ASO_FAIL', 'Exame admissional não aprovado ou não realizado', 'health_exam', 'NR-7 / CLT Art. 168');
    blockers.push(b);
    checklist.push(check('aso', 'Exame Admissional (ASO)', false, b));
  } else {
    checklist.push(check('aso', 'Exame Admissional (ASO)', true));
    if (asoAptoComRestricao) {
      warnings.push(mkWarning('FINAL_ASO_RESTRICAO', 'Colaborador apto com restrições — verificar compatibilidade', 'health_exam', 'NR-7'));
    }
  }

  // ── 2. Treinamentos NR ──
  const trainingOk = input.nr_training !== null && input.nr_training.valid;
  if (!trainingOk) {
    const pendingCount = input.nr_training?.pre_activity_pending ?? 0;
    const b = mkBlocker('FINAL_TRAINING_FAIL', `${pendingCount || 'N'} treinamento(s) pré-atividade pendente(s)`, 'nr_training', 'NR-1, item 1.7');
    blockers.push(b);
    checklist.push(check('training', 'Treinamentos NR Obrigatórios', false, b));
  } else {
    checklist.push(check('training', 'Treinamentos NR Obrigatórios', true));
  }

  // ── 3. EPI ──
  const epiOk = input.epi !== null && input.epi.valid;
  if (!epiOk && input.epi !== null && input.epi.requirements.length > 0) {
    const b = mkBlocker('FINAL_EPI_FAIL', `${input.epi.pending_count} EPI(s) pendente(s) ou termo não assinado`, 'epi_assignment', 'NR-6');
    blockers.push(b);
    checklist.push(check('epi', 'Entrega de EPI + Termo Assinado', false, b));
  } else {
    checklist.push(check('epi', 'Entrega de EPI + Termo Assinado', true));
  }

  // ── 4. Termos Obrigatórios ──
  const agreementsOk = input.agreements !== null && input.agreements.valid;
  if (!agreementsOk) {
    const pendingCount = input.agreements?.pending_count ?? 0;
    const b = mkBlocker('FINAL_AGREEMENTS_FAIL', `${pendingCount || 'N'} termo(s) obrigatório(s) pendente(s)`, 'agreements');
    blockers.push(b);
    checklist.push(check('agreements', 'Termos Obrigatórios Assinados', false, b));
  } else {
    checklist.push(check('agreements', 'Termos Obrigatórios Assinados', true));
  }

  // ── 5. Fleet (condicional) ──
  if (input.fleet && !input.fleet.skipped) {
    if (!input.fleet.valid) {
      const b = mkBlocker('FINAL_FLEET_FAIL', 'Compliance de frota não atendido (CNH/termos)', 'compliance_gate');
      blockers.push(b);
      checklist.push(check('fleet', 'Compliance de Frota', false, b));
    } else {
      checklist.push(check('fleet', 'Compliance de Frota', true));
    }
  }

  // ── 6. Salário ≥ Piso ──
  const salaryOk = input.salario_proposto >= input.piso_salarial;
  if (!salaryOk) {
    const b = mkBlocker(
      'FINAL_SALARY_BELOW_FLOOR',
      `Salário proposto (R$ ${input.salario_proposto.toFixed(2)}) abaixo do piso (R$ ${input.piso_salarial.toFixed(2)})`,
      'contract_setup',
      'CLT Art. 7º, IV / CCT',
    );
    blockers.push(b);
    checklist.push(check('salary', 'Salário ≥ Piso Salarial', false, b));
  } else {
    checklist.push(check('salary', 'Salário ≥ Piso Salarial', true));
  }

  // ── 7. Categoria eSocial ──
  if (!input.esocial_category_valid) {
    const b = mkBlocker('FINAL_ESOCIAL_CAT', 'Categoria eSocial inválida ou não informada', 'personal_data', 'Layout S-2200');
    blockers.push(b);
    checklist.push(check('esocial_cat', 'Categoria eSocial Válida', false, b));
  } else {
    checklist.push(check('esocial_cat', 'Categoria eSocial Válida', true));
  }

  // ── 8. CBO ──
  if (!input.cbo_code) {
    const b = mkBlocker('FINAL_NO_CBO', 'CBO não atribuído — obrigatório para S-2200', 'position_mapping', 'Portaria 397/2002');
    blockers.push(b);
    checklist.push(check('cbo', 'CBO Válido', false, b));
  } else {
    checklist.push(check('cbo', 'CBO Válido', true));
  }

  // ── 9. Dados cadastrais ──
  if (!input.has_complete_personal_data) {
    const b = mkBlocker('FINAL_PERSONAL_DATA', 'Dados pessoais incompletos', 'personal_data', 'CLT Art. 29');
    blockers.push(b);
    checklist.push(check('personal_data', 'Dados Pessoais Completos', false, b));
  } else {
    checklist.push(check('personal_data', 'Dados Pessoais Completos', true));
  }

  if (!input.has_complete_address) {
    const b = mkBlocker('FINAL_ADDRESS', 'Endereço incompleto para eSocial', 'address');
    blockers.push(b);
    checklist.push(check('address', 'Endereço Completo', false, b));
  } else {
    checklist.push(check('address', 'Endereço Completo', true));
  }

  if (!input.has_complete_documents) {
    const b = mkBlocker('FINAL_DOCS', 'Documentação incompleta (CTPS/PIS)', 'documents', 'CLT Art. 13');
    blockers.push(b);
    checklist.push(check('documents', 'Documentação Completa', false, b));
  } else {
    checklist.push(check('documents', 'Documentação Completa', true));
  }

  if (!input.has_contract) {
    const b = mkBlocker('FINAL_CONTRACT', 'Contrato de trabalho não configurado', 'contract_setup', 'CLT Art. 29');
    blockers.push(b);
    checklist.push(check('contract', 'Contrato de Trabalho Configurado', false, b));
  } else {
    checklist.push(check('contract', 'Contrato de Trabalho Configurado', true));
  }

  // ── Score ──
  const passed = checklist.filter(c => c.passed).length;
  const score = Math.round((passed / checklist.length) * 100);

  return {
    can_activate: blockers.length === 0,
    checklist,
    blockers,
    warnings,
    score,
    evaluated_at: new Date().toISOString(),
  };
}

/**
 * Apply Etapa 8 to workflow — advances to ready_for_esocial if all checks pass.
 */
export function applyValidacaoFinalToWorkflow(
  workflow: HiringWorkflow,
  input: ValidacaoFinalInput,
): { workflow: HiringWorkflow; result: ValidacaoFinalResult } {
  const result = runValidacaoFinal(input);
  const now = new Date().toISOString();

  const complianceStep = workflow.steps.find(s => s.step === 'compliance_gate')!;

  if (result.can_activate) {
    complianceStep.status = 'completed';
    complianceStep.completed_at = now;
    complianceStep.error_message = null;
    complianceStep.metadata = {
      ...complianceStep.metadata,
      checklist_score: result.score,
      checklist_items: result.checklist.length,
      checklist_passed: result.checklist.filter(c => c.passed).length,
      warnings_count: result.warnings.length,
      validated_at: now,
    };

    // Advance to eSocial submission
    workflow.current_step = 'esocial_submission';
    workflow.status = 'ready_for_esocial';
    const esocialStep = workflow.steps.find(s => s.step === 'esocial_submission')!;
    esocialStep.status = 'in_progress';
    esocialStep.started_at = now;
  } else {
    complianceStep.status = 'blocked';
    complianceStep.error_message = `${result.blockers.length} pendência(s) impedem a ativação`;
    complianceStep.metadata = {
      ...complianceStep.metadata,
      checklist_score: result.score,
      blockers: result.blockers.map(b => ({ code: b.code, message: b.message, step: b.step })),
    };

    workflow.status = 'blocked';
  }

  workflow.updated_at = now;
  return { workflow, result };
}
