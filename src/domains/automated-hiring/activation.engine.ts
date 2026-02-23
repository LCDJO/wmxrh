/**
 * Automated Hiring — Etapa Final: Ativação do Colaborador
 *
 * Completes the hiring workflow by activating the employee record.
 * This is the terminal step — only reachable after:
 *   - Compliance gate passed (Etapa 8)
 *   - eSocial S-2200 accepted (Etapa 9)
 *
 * Actions:
 *   1. Mark workflow activation step as completed
 *   2. Set workflow status = 'active'
 *   3. Link employee_id to workflow
 *   4. Emit EMPLOYEE_ACTIVATED domain event
 *   5. Return activation record for downstream consumers
 *
 * Downstream triggers (via event bus):
 *   - Employee Master Record Engine → status = ativo
 *   - Safety Automation Engine → onboarding SST playbook
 *   - NR Training Lifecycle → activate pending assignments
 *   - Fleet Compliance → enable device tracking (if applicable)
 */

import type { HiringWorkflow, ComplianceBlocker } from './types';
import { HIRING_EVENTS } from './types';
import { emitHiringEvent, buildHiringEvent } from './events';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export interface ActivationInput {
  employee_id: string;
  activated_by: string;
  /** eSocial protocol confirming S-2200 acceptance */
  esocial_protocol: string;
  /** Employee start date (may differ from hire_date in edge cases) */
  data_inicio_efetivo: string;
}

export interface ActivationResult {
  success: boolean;
  blockers: ComplianceBlocker[];
  employee_id: string;
  workflow_id: string;
  esocial_protocol: string;
  activated_at: string;
}

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

function mkBlocker(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'blocker', message: msg, legal_basis: basis ?? null, step: 'activation' };
}

// ═══════════════════════════════════════════════
//  Engine
// ═══════════════════════════════════════════════

/**
 * Validate activation prerequisites and activate the employee.
 */
export function activateEmployee(
  workflow: HiringWorkflow,
  input: ActivationInput,
): { workflow: HiringWorkflow; result: ActivationResult } {
  const blockers: ComplianceBlocker[] = [];
  const now = new Date().toISOString();

  // ── Pre-checks ──
  const complianceStep = workflow.steps.find(s => s.step === 'compliance_gate');
  const esocialStep = workflow.steps.find(s => s.step === 'esocial_submission');

  if (complianceStep?.status !== 'completed') {
    blockers.push(mkBlocker('ACTIVATION_NO_COMPLIANCE', 'Compliance gate não aprovado'));
  }

  if (esocialStep?.status !== 'completed') {
    blockers.push(mkBlocker('ACTIVATION_NO_ESOCIAL', 'eSocial S-2200 não aceito'));
  }

  if (!input.employee_id) {
    blockers.push(mkBlocker('ACTIVATION_NO_EMPLOYEE_ID', 'ID do colaborador não informado'));
  }

  if (!input.esocial_protocol) {
    blockers.push(mkBlocker('ACTIVATION_NO_PROTOCOL', 'Protocolo eSocial não informado'));
  }

  if (workflow.status === 'cancelled') {
    blockers.push(mkBlocker('ACTIVATION_CANCELLED', 'Workflow cancelado — não pode ser ativado'));
  }

  if (workflow.status === 'active') {
    // Idempotent — already activated
    return {
      workflow,
      result: {
        success: true,
        blockers: [],
        employee_id: workflow.employee_id!,
        workflow_id: workflow.id,
        esocial_protocol: input.esocial_protocol,
        activated_at: workflow.data_conclusao ?? now,
      },
    };
  }

  if (blockers.length > 0) {
    return {
      workflow,
      result: {
        success: false,
        blockers,
        employee_id: input.employee_id,
        workflow_id: workflow.id,
        esocial_protocol: input.esocial_protocol,
        activated_at: now,
      },
    };
  }

  // ── Activate ──
  const activationStep = workflow.steps.find(s => s.step === 'activation')!;
  activationStep.status = 'completed';
  activationStep.completed_at = now;
  activationStep.error_message = null;
  activationStep.metadata = {
    employee_id: input.employee_id,
    activated_by: input.activated_by,
    esocial_protocol: input.esocial_protocol,
    data_inicio_efetivo: input.data_inicio_efetivo,
    activated_at: now,
  };

  workflow.employee_id = input.employee_id;
  workflow.status = 'active';
  workflow.data_conclusao = now;
  workflow.updated_at = now;

  // ── Emit event ──
  emitHiringEvent(buildHiringEvent(
    HIRING_EVENTS.EMPLOYEE_ACTIVATED, workflow.id, workflow.tenant_id,
    {
      employee_id: input.employee_id,
      esocial_protocol: input.esocial_protocol,
      data_inicio_efetivo: input.data_inicio_efetivo,
      activated_by: input.activated_by,
    },
  ));

  return {
    workflow,
    result: {
      success: true,
      blockers: [],
      employee_id: input.employee_id,
      workflow_id: workflow.id,
      esocial_protocol: input.esocial_protocol,
      activated_at: now,
    },
  };
}
