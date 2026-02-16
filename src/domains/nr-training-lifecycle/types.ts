/**
 * NR Training Lifecycle Engine — Domain Types
 *
 * Manages the full lifecycle of mandatory NR trainings:
 *   pending → scheduled → completed → (active | expired) → renewal
 *
 * Integrations:
 *   - Occupational Intelligence: CNAE/CBO → required trainings
 *   - HR Core: employee status, function blocking
 *   - Labor Compliance: PCMSO/PGR program linkage
 *   - Workforce Intelligence: risk scoring from training gaps
 *   - Employee Agreement: training acknowledgment terms
 */

// ═══════════════════════════════════════════════════════
// LIFECYCLE STATES
// ═══════════════════════════════════════════════════════

export type TrainingLifecycleStatus =
  | 'pending'       // Criado, aguardando agendamento
  | 'scheduled'     // Agendado com data futura
  | 'in_progress'   // Treinamento em andamento
  | 'completed'     // Concluído com certificado válido
  | 'expired'       // Validade expirou — requer reciclagem
  | 'overdue'       // Prazo de conclusão ultrapassado sem realização
  | 'blocked'       // Colaborador bloqueado por treinamento vencido
  | 'cancelled'     // Cancelado (desligamento, mudança de função)
  | 'waived';       // Dispensado com justificativa técnica

export type TrainingTrigger =
  | 'admission'     // Admissão do colaborador
  | 'role_change'   // Mudança de cargo/função
  | 'cnae_update'   // Atualização do CNAE da empresa
  | 'renewal'       // Reciclagem periódica
  | 'nr_update'     // Atualização da NR (nova exigência)
  | 'incident'      // Pós-acidente ou quase-acidente
  | 'manual';       // Criação manual pelo RH

export type BlockingLevel =
  | 'none'          // Sem bloqueio
  | 'warning'       // Alerta — pode continuar exercendo
  | 'soft_block'    // Bloqueio parcial — restringe atividades de risco
  | 'hard_block';   // Bloqueio total — impedido de exercer função

// ═══════════════════════════════════════════════════════
// CORE ENTITIES
// ═══════════════════════════════════════════════════════

/** Training assignment — links employee to a required NR training */
export interface TrainingAssignment {
  id: string;
  tenant_id: string;
  company_id: string | null;
  company_group_id: string | null;
  employee_id: string;
  /** Reference to NR training catalog (nr-training-mapper) */
  nr_number: number;
  training_name: string;
  cbo_code: string | null;
  /** Current lifecycle status */
  status: TrainingLifecycleStatus;
  /** What triggered this assignment */
  trigger: TrainingTrigger;
  /** Required workload in hours */
  required_hours: number;
  /** Deadline for completion */
  due_date: string | null;
  /** Blocking level if overdue/expired */
  blocking_level: BlockingLevel;
  /** Whether this is a renewal of a previous assignment */
  is_renewal: boolean;
  /** ID of the previous assignment (if renewal) */
  previous_assignment_id: string | null;
  /** Renewal sequence number (1 = first, 2 = second, etc.) */
  renewal_number: number;
  /** Legal basis (e.g. "NR-35, item 35.3.2") */
  legal_basis: string | null;
  /** Validity in months after completion */
  validity_months: number | null;
  /** Waiver justification (if status = waived) */
  waiver_reason: string | null;
  waiver_approved_by: string | null;
  /** Linked employee agreement (training acknowledgment term) */
  agreement_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Training completion record — immutable audit entry */
export interface TrainingCompletion {
  id: string;
  tenant_id: string;
  assignment_id: string;
  employee_id: string;
  /** Completion date */
  completed_at: string;
  /** Expiry date (computed: completed_at + validity_months) */
  expires_at: string | null;
  /** Actual hours completed */
  hours_completed: number;
  /** Instructor/provider info */
  instructor_name: string | null;
  provider_name: string | null;
  /** Certificate data */
  certificate_number: string | null;
  certificate_url: string | null;
  /** Evaluation score (0-100, optional) */
  score: number | null;
  passed: boolean;
  /** Metadata */
  location: string | null;
  methodology: 'presencial' | 'online' | 'hibrido' | null;
  observations: string | null;
  /** Audit: who registered this completion */
  registered_by: string | null;
  created_at: string;
}

/** Audit trail entry for lifecycle transitions */
export interface TrainingLifecycleEvent {
  id: string;
  tenant_id: string;
  assignment_id: string;
  employee_id: string;
  /** Previous status */
  from_status: TrainingLifecycleStatus | null;
  /** New status */
  to_status: TrainingLifecycleStatus;
  /** Who performed this transition */
  performed_by: string | null;
  /** Reason for transition */
  reason: string | null;
  /** Additional metadata */
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ═══════════════════════════════════════════════════════
// DTOs
// ═══════════════════════════════════════════════════════

export interface CreateAssignmentDTO {
  tenant_id: string;
  company_id?: string | null;
  company_group_id?: string | null;
  employee_id: string;
  nr_number: number;
  training_name: string;
  cbo_code?: string | null;
  trigger: TrainingTrigger;
  required_hours: number;
  due_date?: string | null;
  validity_months?: number | null;
  legal_basis?: string | null;
  previous_assignment_id?: string | null;
  renewal_number?: number;
}

export interface RecordCompletionDTO {
  assignment_id: string;
  completed_at: string;
  hours_completed: number;
  instructor_name?: string;
  provider_name?: string;
  certificate_number?: string;
  certificate_url?: string;
  score?: number;
  passed?: boolean;
  location?: string;
  methodology?: 'presencial' | 'online' | 'hibrido';
  observations?: string;
  registered_by?: string;
}

export interface WaiveTrainingDTO {
  assignment_id: string;
  reason: string;
  approved_by: string;
}

export interface ScheduleTrainingDTO {
  assignment_id: string;
  scheduled_date: string;
  instructor_name?: string;
  provider_name?: string;
  location?: string;
}

// ═══════════════════════════════════════════════════════
// READ MODELS
// ═══════════════════════════════════════════════════════

/** Employee training compliance summary */
export interface EmployeeTrainingCompliance {
  employee_id: string;
  employee_name: string;
  total_required: number;
  completed: number;
  pending: number;
  overdue: number;
  expired: number;
  blocked: boolean;
  blocking_trainings: string[];
  compliance_rate: number; // 0-100
  next_expiry_date: string | null;
  next_expiry_training: string | null;
}

/** Company training compliance summary */
export interface CompanyTrainingCompliance {
  company_id: string;
  company_name: string;
  total_employees: number;
  fully_compliant: number;
  partially_compliant: number;
  non_compliant: number;
  blocked_employees: number;
  compliance_rate: number;
  total_overdue: number;
  total_expiring_30d: number;
  financial_exposure: number;
}

/** Training renewal forecast */
export interface RenewalForecast {
  assignment_id: string;
  employee_id: string;
  employee_name: string;
  training_name: string;
  nr_number: number;
  current_expiry: string;
  days_until_expiry: number;
  renewal_urgency: 'normal' | 'soon' | 'urgent' | 'overdue';
  estimated_cost: number;
}

/** Dashboard stats */
export interface TrainingDashboardStats {
  total_assignments: number;
  by_status: Record<TrainingLifecycleStatus, number>;
  compliance_rate: number;
  blocked_employees: number;
  expiring_30d: number;
  expiring_60d: number;
  expiring_90d: number;
  overdue_count: number;
  total_hours_required: number;
  total_hours_completed: number;
  top_pending_nrs: { nr_number: number; count: number }[];
}
