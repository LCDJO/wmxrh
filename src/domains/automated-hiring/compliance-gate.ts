/**
 * Automated Hiring Workflow — Compliance Gate
 *
 * Final blocker evaluation before employee activation.
 * Cross-checks all domains to build a compliance verdict.
 *
 * Blocking rules (CLT / NR / eSocial):
 * 1. ASO admissional obrigatório (NR-7)
 * 2. CBO válido para eSocial S-2200
 * 3. Treinamentos NR obrigatórios agendados (NR-1)
 * 4. EPIs obrigatórios entregues (NR-6)
 * 5. Termos obrigatórios assinados
 * 6. Dados cadastrais completos para eSocial
 * 7. Contrato de trabalho configurado
 */
import type {
  HiringWorkflow,
  ComplianceGateResult,
  ComplianceBlocker,
  ComplianceBlockerSeverity,
} from './types';

interface ComplianceContext {
  workflow: HiringWorkflow;
  hasAsoAdmissional: boolean;
  asoResult: 'apto' | 'inapto' | 'pending';
  hasCbo: boolean;
  requiredTrainings: string[];
  scheduledTrainings: string[];
  requiredEpis: string[];
  deliveredEpis: string[];
  requiredAgreements: string[];
  signedAgreements: string[];
  hasCompleteAddress: boolean;
  hasCompleteDocuments: boolean;
  hasContract: boolean;
  salaryBelowFloor: boolean;
  pisoSalarial: number | null;
}

function item(
  severity: ComplianceBlockerSeverity,
  code: string,
  message: string,
  step: string,
  legalBasis?: string,
): ComplianceBlocker {
  return { code, severity, message, step: step as any, legal_basis: legalBasis ?? null };
}

export function evaluateComplianceGate(ctx: ComplianceContext): ComplianceGateResult {
  const blockers: ComplianceBlocker[] = [];
  const warnings: ComplianceBlocker[] = [];

  // ── 1. ASO Admissional ──
  if (!ctx.hasAsoAdmissional) {
    blockers.push(item('blocker', 'NO_ASO', 'ASO admissional não realizado', 'health_exam', 'NR-7 / CLT Art. 168'));
  } else if (ctx.asoResult === 'inapto') {
    blockers.push(item('blocker', 'ASO_INAPTO', 'Colaborador inapto no ASO admissional', 'health_exam', 'NR-7'));
  }

  // ── 2. CBO ──
  if (!ctx.hasCbo) {
    blockers.push(item('blocker', 'NO_CBO', 'CBO não atribuído — obrigatório para eSocial S-2200', 'position_mapping', 'Portaria 397/2002'));
  }

  // ── 3. Treinamentos NR ──
  const missingTrainings = ctx.requiredTrainings.filter(t => !ctx.scheduledTrainings.includes(t));
  if (missingTrainings.length > 0) {
    warnings.push(item('warning', 'MISSING_TRAININGS',
      `${missingTrainings.length} treinamento(s) NR ainda não agendado(s)`, 'nr_training', 'NR-1 item 1.7'));
  }

  // ── 4. EPIs ──
  const missingEpis = ctx.requiredEpis.filter(e => !ctx.deliveredEpis.includes(e));
  if (missingEpis.length > 0) {
    blockers.push(item('blocker', 'MISSING_EPIS',
      `${missingEpis.length} EPI(s) obrigatório(s) não entregue(s)`, 'epi_assignment', 'NR-6'));
  }

  // ── 5. Termos ──
  const missingAgreements = ctx.requiredAgreements.filter(a => !ctx.signedAgreements.includes(a));
  if (missingAgreements.length > 0) {
    blockers.push(item('blocker', 'MISSING_AGREEMENTS',
      `${missingAgreements.length} termo(s) obrigatório(s) pendente(s) de assinatura`, 'agreements'));
  }

  // ── 6. Cadastro ──
  if (!ctx.hasCompleteAddress) {
    blockers.push(item('blocker', 'INCOMPLETE_ADDRESS', 'Endereço incompleto para eSocial', 'address'));
  }
  if (!ctx.hasCompleteDocuments) {
    blockers.push(item('blocker', 'INCOMPLETE_DOCS', 'Documentação incompleta (CTPS/PIS obrigatórios)', 'documents', 'CLT Art. 13'));
  }

  // ── 7. Contrato ──
  if (!ctx.hasContract) {
    blockers.push(item('blocker', 'NO_CONTRACT', 'Contrato de trabalho não configurado', 'contract_setup', 'CLT Art. 29'));
  }

  // ── 8. Salário abaixo do piso ──
  if (ctx.salaryBelowFloor && ctx.pisoSalarial) {
    warnings.push(item('warning', 'SALARY_BELOW_FLOOR',
      `Salário abaixo do piso salarial (R$ ${ctx.pisoSalarial.toFixed(2)})`, 'contract_setup', 'CLT Art. 7, IV'));
  }

  return {
    can_activate: blockers.length === 0,
    blockers,
    warnings,
    evaluated_at: new Date().toISOString(),
  };
}
