/**
 * Automated Hiring — Etapa 9: Envio eSocial (S-2200)
 *
 * Generates the S-2200 event payload, submits to the eSocial gateway,
 * and handles the response lifecycle:
 *   - accepted → activate employee
 *   - rejected → keep blocked with error details
 *
 * Rules:
 * - S-2200 must be submitted BEFORE the employee's first day
 * - All compliance checks (Etapa 8) must pass first
 * - Protocol number must be stored for audit
 *
 * Integrations:
 * - Government Integration Gateway (eSocial webservice)
 * - eSocial Governance & Monitoring Center
 * - Employee Master Record Engine (activation)
 * - Safety Automation Engine (rejection alert)
 */

import type {
  HiringWorkflow,
  ComplianceBlocker,
  ESocialSubmissionResult,
} from './types';
import { HIRING_EVENTS } from './types';
import { emitHiringEvent, buildHiringEvent } from './events';
import type { ESocialS2200Payload } from './integration-adapters';
import { buildS2200Payload } from './integration-adapters';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export type ESocialSubmissionStatus = 'pending' | 'submitted' | 'accepted' | 'rejected' | 'error';

export interface ESocialEtapaInput {
  /** S-2200 payload data */
  s2200_data: ESocialS2200Payload;
  /** Tenant's eSocial certificate is valid */
  certificate_valid: boolean;
  /** eSocial environment */
  ambiente: 'producao' | 'producao_restrita';
  /** Employer registration (CNPJ raiz) */
  cnpj_raiz: string;
  /** eSocial employer registration ID */
  nr_recibo_anterior: string | null;
}

export interface ESocialSubmissionRecord {
  submission_id: string;
  event_type: 'S-2200';
  layout_version: string;
  status: ESocialSubmissionStatus;
  protocol: string | null;
  receipt_number: string | null;
  submitted_at: string | null;
  response_at: string | null;
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  payload_hash: string;
}

export interface ESocialEtapaResult {
  valid: boolean;
  blockers: ComplianceBlocker[];
  warnings: ComplianceBlocker[];
  submission: ESocialSubmissionRecord;
  can_activate: boolean;
  evaluated_at: string;
}

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

function mkBlocker(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'blocker', message: msg, legal_basis: basis ?? null, step: 'esocial_submission' };
}

function mkWarning(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'warning', message: msg, legal_basis: basis ?? null, step: 'esocial_submission' };
}

function hashPayload(payload: unknown): string {
  // Simple deterministic hash for payload tracking
  const str = JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ═══════════════════════════════════════════════
//  Engine
// ═══════════════════════════════════════════════

/**
 * Validate pre-submission requirements and build the S-2200 event.
 */
export function prepareESocialSubmission(input: ESocialEtapaInput): ESocialEtapaResult {
  const blockers: ComplianceBlocker[] = [];
  const warnings: ComplianceBlocker[] = [];

  // ── 1. Certificate validation ──
  if (!input.certificate_valid) {
    blockers.push(mkBlocker(
      'ESOCIAL_CERT_INVALID',
      'Certificado digital eSocial (A1/A3) inválido ou expirado — envio impossível',
      'Resolução CGSN 140/2018',
    ));
  }

  // ── 2. CNPJ ──
  if (!input.cnpj_raiz) {
    blockers.push(mkBlocker('ESOCIAL_NO_CNPJ', 'CNPJ raiz do empregador não informado'));
  }

  // ── 3. Build S-2200 ──
  const s2200 = buildS2200Payload(input.s2200_data);

  // ── 4. Validate required S-2200 fields ──
  const p = s2200.payload;
  if (!p.cpfTrab) blockers.push(mkBlocker('S2200_NO_CPF', 'CPF do trabalhador ausente no payload S-2200'));
  if (!p.nmTrab) blockers.push(mkBlocker('S2200_NO_NAME', 'Nome do trabalhador ausente no payload S-2200'));
  if (!p.dtNascto) blockers.push(mkBlocker('S2200_NO_BIRTH', 'Data de nascimento ausente no payload S-2200'));
  if (!p.codCBO) blockers.push(mkBlocker('S2200_NO_CBO', 'CBO ausente no payload S-2200', 'Portaria 397/2002'));
  if (!p.dtAdm) blockers.push(mkBlocker('S2200_NO_HIRE_DATE', 'Data de admissão ausente no payload S-2200'));
  if (!p.vrSalFx || p.vrSalFx <= 0) blockers.push(mkBlocker('S2200_NO_SALARY', 'Salário ausente ou inválido no payload S-2200'));

  // ── 5. Environment warning ──
  if (input.ambiente === 'producao_restrita') {
    warnings.push(mkWarning('ESOCIAL_RESTRICTED_ENV', 'Envio para ambiente de produção restrita (homologação)'));
  }

  const submission: ESocialSubmissionRecord = {
    submission_id: crypto.randomUUID(),
    event_type: 'S-2200',
    layout_version: s2200.layout_version,
    status: blockers.length === 0 ? 'pending' : 'error',
    protocol: null,
    receipt_number: null,
    submitted_at: null,
    response_at: null,
    error_code: blockers.length > 0 ? blockers[0].code : null,
    error_message: blockers.length > 0 ? blockers.map(b => b.message).join('; ') : null,
    retry_count: 0,
    payload_hash: hashPayload(s2200.payload),
  };

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
    submission,
    can_activate: false,
    evaluated_at: new Date().toISOString(),
  };
}

/**
 * Process the eSocial gateway response.
 */
export function processESocialResponse(
  submission: ESocialSubmissionRecord,
  response: ESocialSubmissionResult,
): ESocialSubmissionRecord {
  const now = new Date().toISOString();

  return {
    ...submission,
    status: response.success ? 'accepted' : 'rejected',
    protocol: response.protocol,
    response_at: now,
    error_code: response.error_code,
    error_message: response.error_message,
    submitted_at: submission.submitted_at ?? response.submitted_at,
  };
}

/**
 * Apply Etapa 9 to workflow state machine.
 */
export function applyESocialToWorkflow(
  workflow: HiringWorkflow,
  input: ESocialEtapaInput,
): { workflow: HiringWorkflow; result: ESocialEtapaResult } {
  const result = prepareESocialSubmission(input);
  const now = new Date().toISOString();

  const esocialStep = workflow.steps.find(s => s.step === 'esocial_submission')!;

  if (result.valid) {
    // Mark as submitted (pending response)
    esocialStep.status = 'in_progress';
    esocialStep.metadata = {
      ...esocialStep.metadata,
      submission_id: result.submission.submission_id,
      payload_hash: result.submission.payload_hash,
      layout_version: result.submission.layout_version,
      ambiente: input.ambiente,
      prepared_at: now,
    };
    result.submission.status = 'submitted';
    result.submission.submitted_at = now;
  } else {
    esocialStep.status = 'error';
    esocialStep.error_message = result.blockers.map(b => b.message).join('; ');
  }

  workflow.updated_at = now;
  return { workflow, result };
}

/**
 * Handle eSocial response and activate or block.
 */
export function handleESocialResponse(
  workflow: HiringWorkflow,
  response: ESocialSubmissionResult,
): HiringWorkflow {
  const now = new Date().toISOString();
  const esocialStep = workflow.steps.find(s => s.step === 'esocial_submission')!;

  if (response.success) {
    // ── Accepted → complete step ──
    esocialStep.status = 'completed';
    esocialStep.completed_at = now;
    esocialStep.error_message = null;
    esocialStep.metadata = {
      ...esocialStep.metadata,
      protocol: response.protocol,
      accepted_at: now,
    };

    // Advance to activation
    workflow.current_step = 'activation';
    const activationStep = workflow.steps.find(s => s.step === 'activation')!;
    activationStep.status = 'in_progress';
    activationStep.started_at = now;

    emitHiringEvent(buildHiringEvent(
      HIRING_EVENTS.ESOCIAL_SUBMITTED, workflow.id, workflow.tenant_id,
      { protocol: response.protocol, status: 'accepted' },
    ));
  } else {
    // ── Rejected → block ──
    esocialStep.status = 'error';
    esocialStep.error_message = `Rejeitado pelo eSocial: ${response.error_code} — ${response.error_message}`;
    esocialStep.metadata = {
      ...esocialStep.metadata,
      error_code: response.error_code,
      error_message: response.error_message,
      rejected_at: now,
      retry_count: ((esocialStep.metadata.retry_count as number) ?? 0) + 1,
    };

    workflow.status = 'blocked';

    emitHiringEvent(buildHiringEvent(
      HIRING_EVENTS.STEP_BLOCKED, workflow.id, workflow.tenant_id,
      { step: 'esocial_submission', error_code: response.error_code },
    ));
  }

  workflow.updated_at = now;
  return workflow;
}
