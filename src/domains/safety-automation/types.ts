/**
 * Safety Automation Engine — Domain Types
 *
 * Bounded Context: Automação Inteligente de Segurança do Trabalho
 *
 * Transforms safety risk signals into automated corrective/preventive actions
 * by orchestrating across:
 *   - Occupational Risk Engine (CNAE/risk analysis)
 *   - NR Training Lifecycle (mandatory trainings)
 *   - Labor Compliance (PCMSO/PGR)
 *   - Employee Agreement Engine (digital signatures)
 *   - Workforce Intelligence (risk scoring)
 *   - HR Core (employee status)
 */

// ═══════════════════════════════════════════════════════
// SIGNAL SOURCES — Inputs that trigger automation
// ═══════════════════════════════════════════════════════

export type SafetySignalSource =
  | 'occupational_risk'     // New/changed risk exposure
  | 'training_expired'      // NR training expired or overdue
  | 'exam_overdue'          // Periodic health exam overdue
  | 'compliance_violation'  // Compliance rule violation detected
  | 'incident_reported'     // Workplace accident or near-miss
  | 'risk_score_degraded'   // Workforce risk score dropped
  | 'epi_expired'           // PPE validity expired
  | 'pgr_outdated'          // PGR program needs review
  | 'employee_transferred'  // Employee moved to different risk zone
  | 'cnae_updated';         // Company CNAE changed

export type SafetySignalSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export interface SafetySignal {
  id: string;
  tenant_id: string;
  company_id: string | null;
  source: SafetySignalSource;
  severity: SafetySignalSeverity;
  /** Entity that originated the signal */
  entity_type: 'employee' | 'company' | 'department' | 'position';
  entity_id: string;
  /** Human-readable description */
  title: string;
  description: string;
  /** Structured payload from originating domain */
  payload: Record<string, unknown>;
  /** Whether this signal has been processed */
  processed: boolean;
  processed_at: string | null;
  /** Linked automation rule (if matched) */
  matched_rule_id: string | null;
  created_at: string;
}

// ═══════════════════════════════════════════════════════
// AUTOMATION RULES — Declarative IF/THEN rules
// ═══════════════════════════════════════════════════════

export type SafetyRuleStatus = 'active' | 'draft' | 'disabled';

export interface SafetyAutomationRule {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  /** Signal sources this rule listens to */
  trigger_sources: SafetySignalSource[];
  /** Minimum severity to match */
  min_severity: SafetySignalSeverity;
  /** Additional conditions (JSONLogic-style) */
  conditions: SafetyRuleCondition[];
  /** Actions to execute when triggered */
  actions: SafetyAction[];
  /** Rule priority (lower = higher priority) */
  priority: number;
  status: SafetyRuleStatus;
  /** Cooldown: don't re-trigger for same entity within N hours */
  cooldown_hours: number;
  /** Stats */
  trigger_count: number;
  last_triggered_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafetyRuleCondition {
  field: string;             // e.g. "payload.grau_risco", "severity"
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

// ═══════════════════════════════════════════════════════
// ACTIONS — What the engine does in response
// ═══════════════════════════════════════════════════════

export type SafetyActionType =
  | 'create_task'            // Create corrective action task for manager
  | 'require_training'       // Trigger NR training assignment
  | 'require_exam'           // Require health exam (ASO)
  | 'require_agreement'      // Request signature on safety term
  | 'notify_manager'         // Send notification to direct manager
  | 'notify_safety_team'     // Notify SESMT/safety engineers
  | 'block_employee'         // Soft/hard block from risk activities
  | 'escalate'               // Escalate to higher management
  | 'update_risk_score'      // Recalculate workforce risk score
  | 'create_inspection'      // Schedule safety inspection
  | 'log_event';             // Record event in audit trail

export interface SafetyAction {
  type: SafetyActionType;
  /** Action-specific configuration */
  config: SafetyActionConfig;
  /** Delay in hours before executing (0 = immediate) */
  delay_hours: number;
  /** Whether failure of this action blocks subsequent ones */
  is_blocking: boolean;
}

export type SafetyActionConfig =
  | CreateTaskConfig
  | RequireTrainingConfig
  | RequireExamConfig
  | RequireAgreementConfig
  | NotifyConfig
  | BlockEmployeeConfig
  | EscalateConfig
  | InspectionConfig
  | LogEventConfig
  | UpdateRiskScoreConfig;

export interface CreateTaskConfig {
  type: 'create_task';
  title_template: string;       // Supports {{employee_name}}, {{signal_title}} etc.
  description_template: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  due_in_days: number;
  assign_to: 'direct_manager' | 'safety_engineer' | 'rh_admin' | 'specific_user';
  assignee_id?: string;         // Only if assign_to = 'specific_user'
}

export interface RequireTrainingConfig {
  type: 'require_training';
  nr_number: number;
  training_name: string;
  due_in_days: number;
  blocking_level: 'none' | 'warning' | 'soft_block' | 'hard_block';
}

export interface RequireExamConfig {
  type: 'require_exam';
  exam_type: 'admissional' | 'periodico' | 'retorno' | 'mudanca_funcao' | 'demissional';
  due_in_days: number;
}

export interface RequireAgreementConfig {
  type: 'require_agreement';
  template_slug: string;       // Agreement template to send
  is_mandatory: boolean;
}

export interface NotifyConfig {
  type: 'notify_manager' | 'notify_safety_team';
  message_template: string;
  channels: ('in_app' | 'email')[];
}

export interface BlockEmployeeConfig {
  type: 'block_employee';
  blocking_level: 'warning' | 'soft_block' | 'hard_block';
  reason_template: string;
}

export interface EscalateConfig {
  type: 'escalate';
  escalation_level: 1 | 2 | 3;
  message_template: string;
}

export interface InspectionConfig {
  type: 'create_inspection';
  inspection_type: 'routine' | 'incident' | 'corrective';
  due_in_days: number;
}

export interface LogEventConfig {
  type: 'log_event';
  event_category: string;
  event_message_template: string;
}

export interface UpdateRiskScoreConfig {
  type: 'update_risk_score';
  recalculate_scope: 'employee' | 'department' | 'company';
}

// ═══════════════════════════════════════════════════════
// EXECUTION TRACKING
// ═══════════════════════════════════════════════════════

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface SafetyExecutionRecord {
  id: string;
  tenant_id: string;
  signal_id: string;
  rule_id: string;
  /** Ordered list of action execution results */
  action_results: ActionExecutionResult[];
  status: ExecutionStatus;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  /** Total execution time in ms */
  duration_ms: number | null;
  created_at: string;
}

export interface ActionExecutionResult {
  action_type: SafetyActionType;
  status: ExecutionStatus;
  /** ID of the created entity (task, training assignment, etc.) */
  created_entity_id: string | null;
  error: string | null;
  executed_at: string;
}

// ═══════════════════════════════════════════════════════
// DASHBOARD / READ MODELS
// ═══════════════════════════════════════════════════════

export interface SafetyAutomationDashboard {
  total_signals_24h: number;
  total_signals_7d: number;
  signals_by_severity: Record<SafetySignalSeverity, number>;
  signals_by_source: Record<string, number>;
  total_rules_active: number;
  total_executions_24h: number;
  execution_success_rate: number; // 0-100
  top_triggered_rules: { rule_id: string; rule_name: string; count: number }[];
  pending_tasks_count: number;
  blocked_employees_count: number;
}

// ═══════════════════════════════════════════════════════
// SERVICE PORTS (Domain API)
// ═══════════════════════════════════════════════════════

/** Inbound port: receives safety signals from other domains */
export interface SafetySignalReceiverPort {
  receiveSignal(signal: Omit<SafetySignal, 'id' | 'processed' | 'processed_at' | 'matched_rule_id' | 'created_at'>): SafetySignal;
}

/** Outbound port: executes actions on external domains */
export interface SafetyActionExecutorPort {
  createTask(tenantId: string, config: CreateTaskConfig, context: ActionContext): Promise<string | null>;
  requireTraining(tenantId: string, employeeId: string, config: RequireTrainingConfig): Promise<string | null>;
  requireExam(tenantId: string, employeeId: string, config: RequireExamConfig): Promise<string | null>;
  requireAgreement(tenantId: string, employeeId: string, config: RequireAgreementConfig): Promise<string | null>;
  notifyUsers(tenantId: string, config: NotifyConfig, context: ActionContext): Promise<void>;
  blockEmployee(tenantId: string, employeeId: string, config: BlockEmployeeConfig): Promise<void>;
  escalate(tenantId: string, config: EscalateConfig, context: ActionContext): Promise<void>;
  scheduleInspection(tenantId: string, config: InspectionConfig, context: ActionContext): Promise<string | null>;
  updateRiskScore(tenantId: string, entityId: string, config: UpdateRiskScoreConfig): Promise<void>;
}

export interface ActionContext {
  signal: SafetySignal;
  employee_name?: string;
  company_name?: string;
  department_name?: string;
}
