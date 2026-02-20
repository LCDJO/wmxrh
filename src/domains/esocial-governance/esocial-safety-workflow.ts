/**
 * eSocial → Safety Automation Workflow Bridge
 *
 * When a critical eSocial error is detected, this module:
 *  1. Creates a SafetySignal in the Safety Automation Engine
 *  2. Notifies HR of the affected company
 *  3. Marks the workflow as high priority
 */

import { createSignal } from '@/domains/safety-automation/signal-processor';
import { emitSafetyEvent } from '@/domains/safety-automation/events';
import { emitEsocialGovEvent, esocialGovernanceEvents } from './esocial-governance.events';
import { dispatchClientComm } from './esocial-monitoring.engine';

// ── Types ──

export interface EsocialCriticalErrorPayload {
  tenant_id: string;
  company_id: string;
  company_name: string;
  evento_codigo: string;
  erro_descricao: string;
  employee_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EsocialWorkflowResult {
  signal_id: string;
  tenant_id: string;
  company_id: string;
  priority: 'alta';
  actions_triggered: string[];
  hr_notified: boolean;
  created_at: string;
}

// ── Main Entry Point ──

/**
 * Triggers an automatic workflow when a critical eSocial error occurs.
 *
 * Steps:
 *  1. Create a safety signal via Safety Automation Engine
 *  2. Dispatch HR notification via Client Communication Engine
 *  3. Emit tracking events for audit trail
 */
export function handleCriticalEsocialError(
  payload: EsocialCriticalErrorPayload,
): EsocialWorkflowResult {
  const {
    tenant_id,
    company_id,
    company_name,
    evento_codigo,
    erro_descricao,
    employee_id,
    metadata,
  } = payload;

  const now = new Date().toISOString();
  const actionsList: string[] = [];

  // 1. Create SafetySignal in the Safety Automation Engine
  const signal = createSignal(
    tenant_id,
    'compliance_violation', // source
    'critical',          // severity → high priority
    employee_id ? 'employee' : 'company',
    employee_id ?? company_id,
    `Erro Crítico eSocial — ${evento_codigo}`,
    `${erro_descricao} (Empresa: ${company_name})`,
    {
      origin: 'esocial_governance',
      evento_codigo,
      company_id,
      company_name,
      ...metadata,
    },
    company_id,
  );
  actionsList.push('safety_signal_created');

  // 2. Notify HR via Client Communication Engine
  dispatchClientComm('critical_error', {
    evento: evento_codigo,
    empresa: company_name,
    company_id,
    descricao: erro_descricao,
  });
  actionsList.push('hr_notified_via_comm_engine');

  // 3. Emit safety event for escalation pipeline
  emitSafetyEvent({
    type: 'SafetyEscalationTriggered',
    timestamp: Date.now(),
    tenant_id,
    signal_id: signal.id,
    escalation_level: 2,
    reason: `Erro crítico eSocial ${evento_codigo}: ${erro_descricao}`,
  });
  actionsList.push('escalation_triggered');

  // 4. Emit governance event for audit trail
  emitEsocialGovEvent(esocialGovernanceEvents.ALERT_GENERATED, {
    type: 'critical_error_workflow',
    tenant_id,
    company_id,
    signal_id: signal.id,
    evento_codigo,
    priority: 'alta',
    created_at: now,
  });
  actionsList.push('audit_event_emitted');

  console.log(
    `[eSocial→SafetyWorkflow] Workflow criado para erro ${evento_codigo} na empresa ${company_name}. Signal: ${signal.id}`,
  );

  return {
    signal_id: signal.id,
    tenant_id,
    company_id,
    priority: 'alta',
    actions_triggered: actionsList,
    hr_notified: true,
    created_at: now,
  };
}

/**
 * Batch-process multiple critical errors (e.g., from a rejected batch).
 */
export function handleCriticalEsocialErrors(
  errors: EsocialCriticalErrorPayload[],
): EsocialWorkflowResult[] {
  return errors.map(handleCriticalEsocialError);
}
