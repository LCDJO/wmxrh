/**
 * Safety Automation Engine — Public API
 *
 * Bounded Context: Automação Inteligente de Segurança do Trabalho
 *
 * Transforms safety risk signals into automated corrective/preventive actions
 * by orchestrating across Occupational Risk, NR Training, Labor Compliance,
 * Employee Agreement, Workforce Intelligence and HR Core.
 */

// Types
export type {
  SafetySignal,
  SafetySignalSource,
  SafetySignalSeverity,
  SafetyAutomationRule,
  SafetyRuleCondition,
  SafetyRuleStatus,
  SafetyAction,
  SafetyActionType,
  SafetyActionConfig,
  CreateTaskConfig,
  RequireTrainingConfig,
  RequireExamConfig,
  RequireAgreementConfig,
  NotifyConfig,
  BlockEmployeeConfig,
  EscalateConfig,
  InspectionConfig,
  LogEventConfig,
  UpdateRiskScoreConfig,
  SafetyExecutionRecord,
  ActionExecutionResult,
  ExecutionStatus,
  SafetyAutomationDashboard,
  SafetySignalReceiverPort,
  SafetyActionExecutorPort,
  ActionContext,
} from './types';

// Events
export {
  emitSafetyEvent,
  onSafetyEvent,
} from './events';
export type {
  SafetyAutomationEvent,
  SafetySignalReceivedEvent,
  SafetyRuleMatchedEvent,
  SafetyActionExecutedEvent,
  SafetyExecutionCompletedEvent,
  SafetyEscalationTriggeredEvent,
  SafetyEmployeeBlockedEvent,
} from './events';

// Rule Engine
export {
  matchSignalToRules,
  evaluateAllRules,
  resetCooldowns,
} from './rule-engine';

// Action Orchestrator
export { executeActions } from './action-orchestrator';

// Action Executor (concrete implementation)
export { createSafetyActionExecutor } from './action-executor';

// Signal Processor (main entry point)
export { createSignal, processSignal } from './signal-processor';
export type { SignalProcessorDeps } from './signal-processor';

// Default Rules
export { getDefaultSafetyRules } from './default-rules';

// Automation Triggers
export {
  handleDomainEvent,
  handleDomainEvents,
  getDefaultThresholds,
} from './automation-triggers';
export type {
  OperationalRiskScoreCalculatedEvent,
  TrainingExpiredRiskEvent,
  MedicalExamExpiredEvent,
  EmployeeOperationBlockedEvent,
  RiskExposureUpdatedEvent,
  SafetyDomainEvent,
  SafetyWorkflowType,
  SafetyThresholdConfig,
  SafetyWorkflowPayload,
  AutomationTriggerDeps,
  TriggerResult,
} from './automation-triggers';

// Escalation Engine
export {
  runEscalationScan,
  getEscalationSummary,
} from './escalation-engine';
export type {
  EscalationPolicy,
  EscalationResult,
} from './escalation-engine';

// Playbook Engine
export {
  matchPlaybooks,
  executePlaybook,
  processSignalWithPlaybooks,
  getDefaultPlaybooks,
} from './playbook-engine';
export type {
  SafetyPlaybook,
  PlaybookMatchResult,
  PlaybookExecutionResult,
} from './playbook-engine';

// Workforce Intelligence Bridge
export {
  startWorkforceIntelligenceBridge,
  scanOverdueWorkflows,
  getRecentSafetyInsights,
} from './workforce-intelligence-bridge';
export type {
  SafetyInsight,
  SafetyInsightType,
} from './workforce-intelligence-bridge';

// Occupational Risk Integration
export {
  recalculateEmployeeRiskScore,
  onSafetyTaskCompleted,
  batchRecalculateRiskScores,
} from './occupational-risk-integration';
export type {
  RiskScoreFactors,
  RiskRecalculationResult,
} from './occupational-risk-integration';

// Security Layer
export {
  checkSafetyAccess,
  logSecurityEvent,
  startSecurityEventBridge,
  guardedSafetyOperation,
} from './security-layer';
export type {
  SafetyAccessLevel,
  SafetyAccessResult,
  SafetyAuditEntry,
} from './security-layer';

// Audit Log (Legal Compliance)
export {
  logSafetyAuditAction,
  fetchSafetyAuditLog,
  startAuditLogBridge,
} from './audit-log.service';
export type {
  SafetyAuditLogEntry,
} from './audit-log.service';
