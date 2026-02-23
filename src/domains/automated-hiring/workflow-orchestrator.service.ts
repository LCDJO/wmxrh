/**
 * Automated Hiring Workflow — Orchestrator Service
 *
 * State-machine that drives the admission workflow through its steps.
 * Pure orchestration logic — all I/O is delegated to adapters.
 */
import type {
  HiringWorkflow,
  HiringStep,
  HiringStepState,
  HiringWorkflowStatus,
  CreateHiringWorkflowDTO,
  AdvanceStepDTO,
  CancelWorkflowDTO,
  ComplianceGateResult,
  StepStatus,
} from './types';
import { HIRING_STEPS, HIRING_EVENTS } from './types';
import { validateStep } from './step-validators';
import { evaluateComplianceGate } from './compliance-gate';
import { emitHiringEvent, buildHiringEvent } from './events';

// ═══════════════════════════════════════════════
//  Workflow Factory
// ═══════════════════════════════════════════════

function buildInitialSteps(): HiringStepState[] {
  return HIRING_STEPS.map((step, i) => ({
    step,
    status: (i === 0 ? 'in_progress' : 'pending') as StepStatus,
    started_at: i === 0 ? new Date().toISOString() : null,
    completed_at: null,
    error_message: null,
    metadata: {},
  }));
}

export const hiringWorkflowOrchestrator = {

  /**
   * Create a new hiring workflow in draft state.
   */
  create(dto: CreateHiringWorkflowDTO): HiringWorkflow {
    const now = new Date().toISOString();
    const workflow: HiringWorkflow = {
      id: crypto.randomUUID(),
      tenant_id: dto.tenant_id,
      company_id: dto.company_id,
      employee_id: null,
      candidate_name: dto.candidate_name,
      candidate_cpf: dto.candidate_cpf,
      status: 'in_progress',
      current_step: 'personal_data',
      steps: buildInitialSteps(),
      created_by: dto.created_by,
      created_at: now,
      updated_at: now,
      completed_at: null,
      cancelled_at: null,
      cancellation_reason: null,
    };

    emitHiringEvent(buildHiringEvent(
      HIRING_EVENTS.WORKFLOW_CREATED, workflow.id, dto.tenant_id,
      { candidate_name: dto.candidate_name },
    ));

    return workflow;
  },

  /**
   * Advance a step: validate → mark complete → move to next.
   */
  advanceStep(workflow: HiringWorkflow, dto: AdvanceStepDTO): HiringWorkflow {
    const stepIndex = HIRING_STEPS.indexOf(dto.step);
    if (stepIndex === -1) throw new Error(`Step desconhecido: ${dto.step}`);

    const stepState = workflow.steps[stepIndex];
    if (stepState.status === 'completed') return workflow; // Idempotent

    // Validate
    const validation = validateStep(dto.step, dto.payload);
    if (!validation.valid) {
      stepState.status = 'error';
      stepState.error_message = validation.errors.map(e => e.message).join('; ');
      workflow.updated_at = new Date().toISOString();

      emitHiringEvent(buildHiringEvent(
        HIRING_EVENTS.STEP_BLOCKED, workflow.id, dto.tenant_id,
        { step: dto.step, errors: validation.errors },
      ));

      return workflow;
    }

    // Mark complete
    const now = new Date().toISOString();
    stepState.status = 'completed';
    stepState.completed_at = now;
    stepState.metadata = { ...stepState.metadata, ...dto.payload };
    stepState.error_message = null;

    // Advance to next step
    const nextIndex = stepIndex + 1;
    if (nextIndex < HIRING_STEPS.length) {
      const nextStep = workflow.steps[nextIndex];
      nextStep.status = 'in_progress';
      nextStep.started_at = now;
      workflow.current_step = HIRING_STEPS[nextIndex];
    }

    workflow.updated_at = now;

    emitHiringEvent(buildHiringEvent(
      HIRING_EVENTS.STEP_COMPLETED, workflow.id, dto.tenant_id,
      { step: dto.step },
    ));

    return workflow;
  },

  /**
   * Run the compliance gate — returns verdict.
   */
  evaluateCompliance(workflow: HiringWorkflow, context: Parameters<typeof evaluateComplianceGate>[0]): ComplianceGateResult {
    const result = evaluateComplianceGate(context);

    emitHiringEvent(buildHiringEvent(
      HIRING_EVENTS.COMPLIANCE_EVALUATED, workflow.id, workflow.tenant_id,
      { can_activate: result.can_activate, blocker_count: result.blockers.length },
    ));

    if (!result.can_activate) {
      workflow.status = 'blocked';
    } else {
      workflow.status = 'pending_esocial';
    }

    workflow.updated_at = new Date().toISOString();
    return result;
  },

  /**
   * Mark eSocial submission result.
   */
  recordESocialResult(workflow: HiringWorkflow, success: boolean, protocol?: string, error?: string): HiringWorkflow {
    const step = workflow.steps.find(s => s.step === 'esocial_submission')!;

    if (success) {
      step.status = 'completed';
      step.completed_at = new Date().toISOString();
      step.metadata = { ...step.metadata, protocol };

      emitHiringEvent(buildHiringEvent(
        HIRING_EVENTS.ESOCIAL_SUBMITTED, workflow.id, workflow.tenant_id,
        { protocol },
      ));
    } else {
      step.status = 'error';
      step.error_message = error ?? 'Falha no envio ao eSocial';
    }

    workflow.updated_at = new Date().toISOString();
    return workflow;
  },

  /**
   * Final activation — only if compliance gate passed + eSocial ok.
   */
  activate(workflow: HiringWorkflow, employeeId: string): HiringWorkflow {
    const complianceStep = workflow.steps.find(s => s.step === 'compliance_gate');
    const esocialStep = workflow.steps.find(s => s.step === 'esocial_submission');

    if (complianceStep?.status !== 'completed' || esocialStep?.status !== 'completed') {
      throw new Error('Não é possível ativar: compliance gate ou eSocial pendente');
    }

    const now = new Date().toISOString();
    const activationStep = workflow.steps.find(s => s.step === 'activation')!;
    activationStep.status = 'completed';
    activationStep.completed_at = now;

    workflow.employee_id = employeeId;
    workflow.status = 'completed';
    workflow.completed_at = now;
    workflow.updated_at = now;

    emitHiringEvent(buildHiringEvent(
      HIRING_EVENTS.EMPLOYEE_ACTIVATED, workflow.id, workflow.tenant_id,
      { employee_id: employeeId },
    ));

    return workflow;
  },

  /**
   * Cancel the workflow.
   */
  cancel(workflow: HiringWorkflow, dto: CancelWorkflowDTO): HiringWorkflow {
    const now = new Date().toISOString();
    workflow.status = 'cancelled';
    workflow.cancelled_at = now;
    workflow.cancellation_reason = dto.reason;
    workflow.updated_at = now;

    emitHiringEvent(buildHiringEvent(
      HIRING_EVENTS.WORKFLOW_CANCELLED, workflow.id, dto.tenant_id,
      { reason: dto.reason },
    ));

    return workflow;
  },

  /**
   * Compute progress percentage.
   */
  getProgress(workflow: HiringWorkflow): { completed: number; total: number; percentage: number } {
    const total = workflow.steps.length;
    const completed = workflow.steps.filter(s => s.status === 'completed').length;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  },

  /**
   * Get current blockers from the workflow step states.
   */
  getActiveBlockers(workflow: HiringWorkflow): { step: HiringStep; message: string }[] {
    return workflow.steps
      .filter(s => s.status === 'error' || s.status === 'blocked')
      .map(s => ({ step: s.step, message: s.error_message ?? 'Pendência não resolvida' }));
  },
};
