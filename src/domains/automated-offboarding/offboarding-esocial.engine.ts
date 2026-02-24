/**
 * Offboarding eSocial Integration — Etapa 5
 *
 * Generates and tracks the S-2299 (Desligamento) event for the eSocial government system.
 *
 * Flow:
 *   1. Build S-2299 payload from offboarding workflow + rescission data
 *   2. Validate payload via layout mapper
 *   3. Persist envelope to esocial_events
 *   4. Track status: accepted → allow finalization, rejected → block
 *
 * Status Gate:
 *   - 'accepted'  → workflow can proceed to completion
 *   - 'rejected'  → workflow is BLOCKED until correction + re-submission
 *   - 'pending'   → workflow waits (async polling)
 *
 * ╔════════════════════════════════════════════════════════════╗
 * ║  SECURITY: tenant_id is ALWAYS derived from the workflow  ║
 * ║  record — never from frontend input.                      ║
 * ╚════════════════════════════════════════════════════════════╝
 */

import { supabase } from '@/integrations/supabase/client';
import { generateFromDomainEvent } from '@/domains/esocial-engine/event-generator';
import { validateEnvelope } from '@/domains/esocial-engine/transmission-controller';
import type { InboundDomainEvent, ESocialEnvelope, TransmissionStatus } from '@/domains/esocial-engine/types';
import type { OffboardingWorkflow, OffboardingType, AvisoPrevioType } from './types';
import type { RescissionResult } from './rescission-calculator.engine';

// ── Types ──

export type ESocialOffboardingStatus = 'not_sent' | 'pending' | 'accepted' | 'rejected' | 'error';

export interface ESocialSubmissionResult {
  success: boolean;
  envelope_id?: string;
  status: ESocialOffboardingStatus;
  validation_errors?: Array<{ field: string; message: string; code: string }>;
  error?: string;
}

export interface ESocialStatusCheckResult {
  status: ESocialOffboardingStatus;
  receipt_number?: string;
  error_message?: string;
  error_code?: string;
  can_finalize: boolean;
  blocking_reason?: string;
  last_checked_at: string;
}

// ── Motivo de Desligamento → Tabela 19 eSocial ──

const OFFBOARDING_TYPE_TO_ESOCIAL_MOTIVO: Record<OffboardingType, string> = {
  sem_justa_causa: '02',    // Rescisão sem justa causa, por iniciativa do empregador
  justa_causa: '01',        // Rescisão com justa causa, por iniciativa do empregador
  pedido_demissao: '07',    // Pedido de demissão
  termino_contrato: '05',   // Rescisão por término do contrato a termo
};

const AVISO_PREVIO_TO_ESOCIAL: Record<AvisoPrevioType, string> = {
  trabalhado: 'trabalhado',
  indenizado: 'indenizado',
  nao_aplicavel: 'dispensado',
};

// ── Engine ──

/**
 * Generate and submit S-2299 event for an offboarding workflow.
 *
 * Steps:
 *   1. Map workflow data → InboundDomainEvent
 *   2. Generate ESocialEnvelope via event-generator
 *   3. Validate via transmission-controller
 *   4. Persist to esocial_events
 *   5. Update workflow with esocial_event_id and status
 */
export async function submitS2299Event(
  workflow: OffboardingWorkflow,
  rescission: RescissionResult,
  employeeData: {
    cpf: string;
    matricula: string;
    company_document: string;
  },
): Promise<ESocialSubmissionResult> {
  try {
    // 1. Build domain event
    const domainEvent: InboundDomainEvent = {
      event_name: 'employee.terminated',
      tenant_id: workflow.tenant_id,
      company_id: workflow.company_id || '',
      entity_type: 'employee',
      entity_id: workflow.employee_id,
      occurred_at: new Date().toISOString(),
      payload: {
        cpf: employeeData.cpf,
        company_document: employeeData.company_document,
        matricula: employeeData.matricula,
        termination_date: workflow.data_desligamento,
        termination_reason_code: OFFBOARDING_TYPE_TO_ESOCIAL_MOTIVO[workflow.offboarding_type] || '02',
        last_effective_date: workflow.last_working_day || workflow.data_desligamento,
        notice_type: AVISO_PREVIO_TO_ESOCIAL[workflow.aviso_previo_type] || 'dispensado',
        notice_start_date: workflow.data_aviso_previo,
        pending_salary_days: rescission.linhas.find(l => l.codigo === 'SALDO_SALARIO')
          ? parseInt(rescission.linhas.find(l => l.codigo === 'SALDO_SALARIO')!.referencia?.split('/')[0] || '0')
          : 0,
        vacation_days: rescission.linhas.find(l => l.codigo === 'FERIAS_PROPORCIONAIS')
          ? parseInt(rescission.linhas.find(l => l.codigo === 'FERIAS_PROPORCIONAIS')!.referencia?.split('/')[0] || '0')
          : 0,
        thirteenth_proportional: rescission.linhas.find(l => l.codigo === 'DECIMO_TERCEIRO_PROP')
          ? parseInt(rescission.linhas.find(l => l.codigo === 'DECIMO_TERCEIRO_PROP')!.referencia?.split('/')[0] || '0')
          : 0,
      },
    };

    // 2. Generate envelope
    const envelope = generateFromDomainEvent(domainEvent);
    if (!envelope) {
      return {
        success: false,
        status: 'error',
        error: 'Falha ao gerar envelope S-2299 — mapper não encontrado',
      };
    }

    // 3. Validate
    const validation = validateEnvelope(envelope);
    if (!validation.valid) {
      return {
        success: false,
        status: 'error',
        validation_errors: validation.errors,
        error: `Validação falhou: ${validation.errors.map(e => e.message).join('; ')}`,
      };
    }

    // 4. Persist to esocial_events
    const { data: eventRow, error: insertError } = await supabase
      .from('esocial_events')
      .insert({
        tenant_id: workflow.tenant_id,
        company_id: workflow.company_id,
        event_type: 'S-2299',
        category: 'nao_periodicos',
        entity_type: 'employee',
        entity_id: workflow.employee_id,
        payload: envelope.payload,
        status: 'pending',
        effective_date: workflow.data_desligamento,
      } as any)
      .select('id')
      .single();

    if (insertError) {
      return {
        success: false,
        status: 'error',
        error: `Falha ao persistir evento S-2299: ${insertError.message}`,
      };
    }

    const envelopeId = (eventRow as any).id;

    // 5. Update workflow with eSocial reference
    await supabase
      .from('offboarding_workflows')
      .update({
        esocial_event_id: envelopeId,
        esocial_status: 'pending',
        status: 'esocial_pending',
      } as any)
      .eq('id', workflow.id)
      .eq('tenant_id', workflow.tenant_id);

    // 6. Audit log
    await supabase.from('offboarding_audit_log').insert({
      tenant_id: workflow.tenant_id,
      workflow_id: workflow.id,
      action: 'esocial_s2299_submitted',
      new_value: {
        esocial_event_id: envelopeId,
        event_type: 'S-2299',
        motivo_esocial: OFFBOARDING_TYPE_TO_ESOCIAL_MOTIVO[workflow.offboarding_type],
      } as any,
    } as any);

    return {
      success: true,
      envelope_id: envelopeId,
      status: 'pending',
    };
  } catch (err) {
    return {
      success: false,
      status: 'error',
      error: `Erro inesperado ao submeter S-2299: ${String(err)}`,
    };
  }
}

/**
 * Check the current eSocial status for an offboarding workflow.
 *
 * Gate logic:
 *   - accepted  → can_finalize: true
 *   - rejected  → can_finalize: false (must correct and resubmit)
 *   - pending   → can_finalize: false (waiting for government response)
 *   - error     → can_finalize: false (system error, may retry)
 */
export async function checkESocialStatus(
  workflow: OffboardingWorkflow,
): Promise<ESocialStatusCheckResult> {
  const now = new Date().toISOString();

  if (!workflow.esocial_event_id) {
    return {
      status: 'not_sent',
      can_finalize: false,
      blocking_reason: 'Evento S-2299 ainda não foi enviado ao eSocial',
      last_checked_at: now,
    };
  }

  // Fetch current status from esocial_events
  const { data, error } = await supabase
    .from('esocial_events')
    .select('status, receipt_number, error_message')
    .eq('id', workflow.esocial_event_id)
    .single();

  if (error || !data) {
    return {
      status: 'error',
      can_finalize: false,
      blocking_reason: 'Não foi possível consultar o status do evento eSocial',
      error_message: error?.message,
      last_checked_at: now,
    };
  }

  const row = data as any;
  const dbStatus = row.status as string;

  // Map DB status to our domain status
  let status: ESocialOffboardingStatus;
  let canFinalize = false;
  let blockingReason: string | undefined;

  switch (dbStatus) {
    case 'accepted':
      status = 'accepted';
      canFinalize = true;
      break;
    case 'rejected':
      status = 'rejected';
      canFinalize = false;
      blockingReason = `Evento S-2299 REJEITADO pelo eSocial: ${row.error_message || 'motivo não informado'}. Corrija e reenvie antes de finalizar o desligamento.`;
      break;
    case 'error':
      status = 'error';
      canFinalize = false;
      blockingReason = `Erro no processamento do evento S-2299: ${row.error_message || 'erro desconhecido'}. Tente reenviar.`;
      break;
    default:
      // pending, processing, sent
      status = 'pending';
      canFinalize = false;
      blockingReason = 'Aguardando retorno do eSocial. O evento S-2299 foi enviado e está sendo processado.';
  }

  // Sync status back to workflow if changed
  if (workflow.esocial_status !== dbStatus) {
    await supabase
      .from('offboarding_workflows')
      .update({ esocial_status: dbStatus } as any)
      .eq('id', workflow.id)
      .eq('tenant_id', workflow.tenant_id);
  }

  return {
    status,
    receipt_number: row.receipt_number ?? undefined,
    error_message: row.error_message ?? undefined,
    can_finalize: canFinalize,
    blocking_reason: blockingReason,
    last_checked_at: now,
  };
}

/**
 * Gate: Check if workflow can be finalized based on eSocial status.
 *
 * Returns { allowed: true } if S-2299 was accepted.
 * Returns { allowed: false, reason } if blocked.
 */
export async function canFinalizeOffboarding(
  workflow: OffboardingWorkflow,
): Promise<{ allowed: boolean; reason?: string }> {
  const check = await checkESocialStatus(workflow);

  if (check.can_finalize) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: check.blocking_reason || `eSocial status: ${check.status}`,
  };
}

/**
 * Resubmit S-2299 after rejection correction.
 *
 * Creates a new event record (retificação) linked to the original.
 */
export async function resubmitS2299Event(
  workflow: OffboardingWorkflow,
  rescission: RescissionResult,
  employeeData: {
    cpf: string;
    matricula: string;
    company_document: string;
  },
): Promise<ESocialSubmissionResult> {
  // Cancel the old event if it exists
  if (workflow.esocial_event_id) {
    await supabase
      .from('esocial_events')
      .update({ status: 'cancelled' } as any)
      .eq('id', workflow.esocial_event_id)
      .eq('tenant_id', workflow.tenant_id);

    await supabase.from('offboarding_audit_log').insert({
      tenant_id: workflow.tenant_id,
      workflow_id: workflow.id,
      action: 'esocial_s2299_cancelled_for_resubmission',
      new_value: { previous_event_id: workflow.esocial_event_id } as any,
    } as any);
  }

  // Submit new event
  return submitS2299Event(workflow, rescission, employeeData);
}
