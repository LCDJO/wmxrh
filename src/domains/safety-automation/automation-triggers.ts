/**
 * Safety Automation Engine — Automation Triggers
 *
 * Consumes domain events from other Bounded Contexts and converts them
 * into SafetySignals that feed the rule engine → action orchestrator pipeline.
 *
 * Events consumed:
 *   - OperationalRiskScoreCalculated  → risk_score_degraded
 *   - TrainingExpiredRisk             → training_expired
 *   - MedicalExamExpired              → exam_overdue
 *   - EmployeeOperationBlocked        → compliance_violation
 *   - RiskExposureUpdated             → occupational_risk
 *
 * Threshold rules:
 *   If score_risco > threshold → auto-create safety workflow
 */

import type {
  SafetySignalSource,
  SafetySignalSeverity,
  SafetySignal,
  SafetyExecutionRecord,
} from './types';
import { createSignal, processSignal, type SignalProcessorDeps } from './signal-processor';

// ═══════════════════════════════════════════════════════
// DOMAIN EVENT SHAPES (from external Bounded Contexts)
// ═══════════════════════════════════════════════════════

export interface OperationalRiskScoreCalculatedEvent {
  type: 'OperationalRiskScoreCalculated';
  tenant_id: string;
  company_id: string;
  employee_id: string;
  employee_name?: string;
  previous_score: number;
  current_score: number;
  risk_factors: string[];
  calculated_at: string;
}

export interface TrainingExpiredRiskEvent {
  type: 'TrainingExpiredRisk';
  tenant_id: string;
  company_id: string;
  employee_id: string;
  employee_name?: string;
  nr_codigo: number;
  training_name: string;
  expired_at: string;
}

export interface MedicalExamExpiredEvent {
  type: 'MedicalExamExpired';
  tenant_id: string;
  company_id: string;
  employee_id: string;
  employee_name?: string;
  exam_type: string;
  expired_at: string;
  days_overdue: number;
}

export interface EmployeeOperationBlockedEvent {
  type: 'EmployeeOperationBlocked';
  tenant_id: string;
  company_id: string;
  employee_id: string;
  employee_name?: string;
  operation: string;
  reason: string;
  blocked_by: string;
}

export interface RiskExposureUpdatedEvent {
  type: 'RiskExposureUpdated';
  tenant_id: string;
  company_id: string;
  employee_id: string;
  employee_name?: string;
  agent_type: string;
  risk_level: number;
  generates_hazard_pay: boolean;
  exposure_id: string;
}

export type SafetyDomainEvent =
  | OperationalRiskScoreCalculatedEvent
  | TrainingExpiredRiskEvent
  | MedicalExamExpiredEvent
  | EmployeeOperationBlockedEvent
  | RiskExposureUpdatedEvent;

// ═══════════════════════════════════════════════════════
// WORKFLOW TYPE MAPPING
// ═══════════════════════════════════════════════════════

export type SafetyWorkflowType =
  | 'nr_expirada'
  | 'exame_vencido'
  | 'risco_critico'
  | 'falta_epi'
  | 'treinamento_obrigatorio';

const EVENT_TO_WORKFLOW_TYPE: Record<SafetyDomainEvent['type'], SafetyWorkflowType> = {
  OperationalRiskScoreCalculated: 'risco_critico',
  TrainingExpiredRisk: 'treinamento_obrigatorio',
  MedicalExamExpired: 'exame_vencido',
  EmployeeOperationBlocked: 'risco_critico',
  RiskExposureUpdated: 'risco_critico',
};

const EVENT_TO_SIGNAL_SOURCE: Record<SafetyDomainEvent['type'], SafetySignalSource> = {
  OperationalRiskScoreCalculated: 'risk_score_degraded',
  TrainingExpiredRisk: 'training_expired',
  MedicalExamExpired: 'exam_overdue',
  EmployeeOperationBlocked: 'compliance_violation',
  RiskExposureUpdated: 'occupational_risk',
};

// ═══════════════════════════════════════════════════════
// THRESHOLD CONFIGURATION
// ═══════════════════════════════════════════════════════

export interface SafetyThresholdConfig {
  /** Risk score above which a workflow is auto-created (0-100) */
  risk_score_threshold: number;
  /** Days overdue for exam before auto-triggering (0 = immediate) */
  exam_overdue_days_threshold: number;
  /** Risk level that triggers immediate workflow on exposure update */
  risk_exposure_level_threshold: number;
}

const DEFAULT_THRESHOLDS: SafetyThresholdConfig = {
  risk_score_threshold: 70,
  exam_overdue_days_threshold: 0,
  risk_exposure_level_threshold: 3,
};

// ═══════════════════════════════════════════════════════
// SEVERITY RESOLUTION
// ═══════════════════════════════════════════════════════

function resolveRiskScoreSeverity(score: number): SafetySignalSeverity {
  if (score >= 90) return 'critical';
  if (score >= 80) return 'high';
  if (score >= 70) return 'medium';
  if (score >= 50) return 'low';
  return 'informational';
}

function resolveExamOverdueSeverity(daysOverdue: number): SafetySignalSeverity {
  if (daysOverdue >= 60) return 'critical';
  if (daysOverdue >= 30) return 'high';
  if (daysOverdue >= 7) return 'medium';
  return 'low';
}

function resolveRiskExposureSeverity(riskLevel: number): SafetySignalSeverity {
  if (riskLevel >= 4) return 'critical';
  if (riskLevel >= 3) return 'high';
  if (riskLevel >= 2) return 'medium';
  return 'low';
}

// ═══════════════════════════════════════════════════════
// EVENT → SIGNAL CONVERTERS
// ═══════════════════════════════════════════════════════

function convertToSignal(
  event: SafetyDomainEvent,
  thresholds: SafetyThresholdConfig,
): SafetySignal | null {
  const source = EVENT_TO_SIGNAL_SOURCE[event.type];

  switch (event.type) {
    case 'OperationalRiskScoreCalculated': {
      if (event.current_score < thresholds.risk_score_threshold) return null;
      return createSignal(
        event.tenant_id,
        source,
        resolveRiskScoreSeverity(event.current_score),
        'employee',
        event.employee_id,
        `Score de risco operacional elevado: ${event.current_score}`,
        `Score de risco do colaborador ${event.employee_name ?? event.employee_id} subiu de ${event.previous_score} para ${event.current_score}. Fatores: ${event.risk_factors.join(', ')}`,
        {
          previous_score: event.previous_score,
          current_score: event.current_score,
          risk_factors: event.risk_factors,
          workflow_type: EVENT_TO_WORKFLOW_TYPE[event.type],
        },
        event.company_id,
      );
    }

    case 'TrainingExpiredRisk': {
      return createSignal(
        event.tenant_id,
        source,
        'high',
        'employee',
        event.employee_id,
        `Treinamento NR-${event.nr_codigo} expirado: ${event.training_name}`,
        `O treinamento "${event.training_name}" (NR-${event.nr_codigo}) do colaborador ${event.employee_name ?? event.employee_id} expirou em ${event.expired_at}.`,
        {
          nr_codigo: event.nr_codigo,
          training_name: event.training_name,
          expired_at: event.expired_at,
          workflow_type: EVENT_TO_WORKFLOW_TYPE[event.type],
        },
        event.company_id,
      );
    }

    case 'MedicalExamExpired': {
      if (event.days_overdue < thresholds.exam_overdue_days_threshold) return null;
      return createSignal(
        event.tenant_id,
        source,
        resolveExamOverdueSeverity(event.days_overdue),
        'employee',
        event.employee_id,
        `Exame ${event.exam_type} vencido há ${event.days_overdue} dias`,
        `O exame "${event.exam_type}" do colaborador ${event.employee_name ?? event.employee_id} está vencido há ${event.days_overdue} dias (venceu em ${event.expired_at}).`,
        {
          exam_type: event.exam_type,
          expired_at: event.expired_at,
          days_overdue: event.days_overdue,
          workflow_type: EVENT_TO_WORKFLOW_TYPE[event.type],
        },
        event.company_id,
      );
    }

    case 'EmployeeOperationBlocked': {
      return createSignal(
        event.tenant_id,
        source,
        'high',
        'employee',
        event.employee_id,
        `Operação bloqueada: ${event.operation}`,
        `Operação "${event.operation}" do colaborador ${event.employee_name ?? event.employee_id} foi bloqueada. Motivo: ${event.reason}`,
        {
          operation: event.operation,
          reason: event.reason,
          blocked_by: event.blocked_by,
          workflow_type: EVENT_TO_WORKFLOW_TYPE[event.type],
        },
        event.company_id,
      );
    }

    case 'RiskExposureUpdated': {
      if (event.risk_level < thresholds.risk_exposure_level_threshold) return null;
      return createSignal(
        event.tenant_id,
        source,
        resolveRiskExposureSeverity(event.risk_level),
        'employee',
        event.employee_id,
        `Exposição a risco atualizada: ${event.agent_type} (nível ${event.risk_level})`,
        `Exposição do colaborador ${event.employee_name ?? event.employee_id} ao agente "${event.agent_type}" atualizada para nível ${event.risk_level}.${event.generates_hazard_pay ? ' Gera adicional de periculosidade.' : ''}`,
        {
          agent_type: event.agent_type,
          risk_level: event.risk_level,
          generates_hazard_pay: event.generates_hazard_pay,
          exposure_id: event.exposure_id,
          workflow_type: EVENT_TO_WORKFLOW_TYPE[event.type],
        },
        event.company_id,
      );
    }

    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════
// WORKFLOW CREATION PAYLOAD (for DB persistence)
// ═══════════════════════════════════════════════════════

export interface SafetyWorkflowPayload {
  tenant_id: string;
  company_id: string | null;
  tipo_workflow: SafetyWorkflowType;
  origem_evento: Record<string, unknown>;
  status: 'open';
  prioridade: 'low' | 'medium' | 'high' | 'critical';
  employee_id: string | null;
  description: string;
  metadata: Record<string, unknown>;
}

function severityToPriority(severity: SafetySignalSeverity): SafetyWorkflowPayload['prioridade'] {
  switch (severity) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'medium': return 'medium';
    default: return 'low';
  }
}

function buildWorkflowPayload(
  signal: SafetySignal,
  event: SafetyDomainEvent,
): SafetyWorkflowPayload {
  return {
    tenant_id: signal.tenant_id,
    company_id: signal.company_id,
    tipo_workflow: EVENT_TO_WORKFLOW_TYPE[event.type],
    origem_evento: {
      event_type: event.type,
      signal_id: signal.id,
      ...signal.payload,
    },
    status: 'open',
    prioridade: severityToPriority(signal.severity),
    employee_id: signal.entity_type === 'employee' ? signal.entity_id : null,
    description: signal.description,
    metadata: {
      signal_source: signal.source,
      signal_severity: signal.severity,
      auto_generated: true,
      created_by: 'safety_automation_engine',
    },
  };
}

// ═══════════════════════════════════════════════════════
// AUTOMATION TRIGGER SERVICE
// ═══════════════════════════════════════════════════════

export interface AutomationTriggerDeps extends SignalProcessorDeps {
  /** Persist workflow in the safety_workflows table */
  persistWorkflow(payload: SafetyWorkflowPayload): Promise<string | null>;
}

export interface TriggerResult {
  signal: SafetySignal | null;
  workflow_id: string | null;
  execution: SafetyExecutionRecord | null;
  skipped: boolean;
  skip_reason?: string;
}

/**
 * Main entry point: consume a domain event, evaluate thresholds,
 * create a signal + workflow, and run the automation pipeline.
 */
export async function handleDomainEvent(
  event: SafetyDomainEvent,
  deps: AutomationTriggerDeps,
  thresholds: SafetyThresholdConfig = DEFAULT_THRESHOLDS,
): Promise<TriggerResult> {
  // 1. Convert event → signal (applies threshold checks)
  const signal = convertToSignal(event, thresholds);

  if (!signal) {
    return {
      signal: null,
      workflow_id: null,
      execution: null,
      skipped: true,
      skip_reason: `Event ${event.type} did not meet threshold criteria`,
    };
  }

  // 2. Create workflow in DB
  const workflowPayload = buildWorkflowPayload(signal, event);
  const workflowId = await deps.persistWorkflow(workflowPayload);

  // 3. Process signal through rule engine → action orchestrator
  const execution = await processSignal(signal, deps);

  return {
    signal,
    workflow_id: workflowId,
    execution,
    skipped: false,
  };
}

/**
 * Batch process multiple domain events.
 */
export async function handleDomainEvents(
  events: SafetyDomainEvent[],
  deps: AutomationTriggerDeps,
  thresholds?: SafetyThresholdConfig,
): Promise<TriggerResult[]> {
  const results: TriggerResult[] = [];
  for (const event of events) {
    results.push(await handleDomainEvent(event, deps, thresholds));
  }
  return results;
}

/**
 * Get default threshold configuration.
 */
export function getDefaultThresholds(): SafetyThresholdConfig {
  return { ...DEFAULT_THRESHOLDS };
}
