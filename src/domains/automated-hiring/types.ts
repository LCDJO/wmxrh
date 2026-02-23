/**
 * Automated Hiring Workflow Engine — Types
 *
 * Bounded Context for end-to-end employee admission automation
 * compliant with Brazilian labor legislation (CLT / eSocial / NRs).
 *
 * Integrations:
 * - Employee Master Record Engine (ficha do trabalhador)
 * - Career & Legal Intelligence Engine (CBO / PCCS)
 * - Occupational Intelligence Engine (CNAE → riscos → NRs)
 * - NR Training Lifecycle Engine (obrigações de treinamento)
 * - EPILifecycleEngine (EPI obrigatório por cargo)
 * - PCMSO / PGR (ASO admissional + riscos ambientais)
 * - Employee Agreement Engine (termos e assinaturas)
 * - Government Integration Gateway / eSocial (S-2200)
 * - Fleet Compliance Engine (habilitação, disciplina)
 * - Safety Automation Engine (playbooks de onboarding SST)
 * - Security Kernel (access control, audit)
 */

// ═══════════════════════════════════════════════
//  Workflow Lifecycle
// ═══════════════════════════════════════════════

/** Ordered admission workflow steps */
export const HIRING_STEPS = [
  'personal_data',
  'documents',
  'address',
  'dependents',
  'position_mapping',
  'occupational_profile',
  'contract_setup',
  'health_exam',
  'nr_training',
  'epi_assignment',
  'agreements',
  'compliance_gate',
  'esocial_submission',
  'activation',
] as const;

export type HiringStep = typeof HIRING_STEPS[number];

export type HiringWorkflowStatus =
  | 'draft'
  | 'validation'
  | 'exams_pending'
  | 'documents_pending'
  | 'sst_pending'
  | 'ready_for_esocial'
  | 'active'
  | 'cancelled'
  | 'blocked';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked' | 'error';

// ═══════════════════════════════════════════════
//  Step State
// ═══════════════════════════════════════════════

export interface HiringStepState {
  step: HiringStep;
  status: StepStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

// ═══════════════════════════════════════════════
//  Workflow Aggregate
// ═══════════════════════════════════════════════

export interface HiringWorkflow {
  id: string;
  tenant_id: string;
  company_id: string;
  employee_id: string | null;
  candidate_name: string;
  candidate_cpf: string;
  status: HiringWorkflowStatus;
  current_step: HiringStep;
  steps: HiringStepState[];
  created_by: string;
  data_inicio: string;
  data_conclusao: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════
//  DTOs
// ═══════════════════════════════════════════════

export interface CreateHiringWorkflowDTO {
  tenant_id: string;
  company_id: string;
  candidate_name: string;
  candidate_cpf: string;
  created_by: string;
  /** Optional: pre-selected position to fast-track step */
  position_id?: string;
}

export interface AdvanceStepDTO {
  workflow_id: string;
  tenant_id: string;
  step: HiringStep;
  payload: Record<string, unknown>;
  performed_by: string;
}

export interface CancelWorkflowDTO {
  workflow_id: string;
  tenant_id: string;
  reason: string;
  cancelled_by: string;
}

// ═══════════════════════════════════════════════
//  Compliance Gate
// ═══════════════════════════════════════════════

export type ComplianceBlockerSeverity = 'blocker' | 'warning' | 'info';

export interface ComplianceBlocker {
  code: string;
  severity: ComplianceBlockerSeverity;
  message: string;
  legal_basis: string | null;
  step: HiringStep;
}

export interface ComplianceGateResult {
  can_activate: boolean;
  blockers: ComplianceBlocker[];
  warnings: ComplianceBlocker[];
  evaluated_at: string;
}

// ═══════════════════════════════════════════════
//  Integration Contracts (Ports)
// ═══════════════════════════════════════════════

export interface OccupationalProfileResult {
  cnae_code: string;
  grau_risco: number;
  cbo_code: string | null;
  applicable_nrs: number[];
  requires_sesmt: boolean;
  requires_cipa: boolean;
  required_epi_categories: string[];
  required_trainings: string[];
  risk_agents: string[];
}

export interface HealthExamRequirement {
  exam_type: 'admissional' | 'periodico' | 'retorno_trabalho';
  description: string;
  legal_basis: string;
  deadline_days: number;
}

export interface ESocialSubmissionResult {
  success: boolean;
  protocol: string | null;
  event_type: string;
  error_code: string | null;
  error_message: string | null;
  submitted_at: string;
}

// ═══════════════════════════════════════════════
//  Events
// ═══════════════════════════════════════════════

export const HIRING_EVENTS = {
  WORKFLOW_CREATED: 'hiring:workflow_created',
  STEP_COMPLETED: 'hiring:step_completed',
  STEP_BLOCKED: 'hiring:step_blocked',
  COMPLIANCE_EVALUATED: 'hiring:compliance_evaluated',
  ESOCIAL_SUBMITTED: 'hiring:esocial_submitted',
  EMPLOYEE_ACTIVATED: 'hiring:employee_activated',
  WORKFLOW_CANCELLED: 'hiring:workflow_cancelled',
} as const;

export type HiringEventName = typeof HIRING_EVENTS[keyof typeof HIRING_EVENTS];

export interface HiringDomainEvent<T = Record<string, unknown>> {
  event_name: HiringEventName;
  workflow_id: string;
  tenant_id: string;
  payload: T;
  occurred_at: string;
}
