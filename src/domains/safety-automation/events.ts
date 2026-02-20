/**
 * Safety Automation Engine — Domain Events
 *
 * Events emitted by the Safety Automation Engine that other
 * domains can subscribe to for cross-cutting concerns.
 */

import type {
  SafetySignalSource,
  SafetySignalSeverity,
  SafetyActionType,
  ExecutionStatus,
} from './types';

// ═══════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════

export type SafetyAutomationEvent =
  | SafetySignalReceivedEvent
  | SafetyRuleMatchedEvent
  | SafetyActionExecutedEvent
  | SafetyExecutionCompletedEvent
  | SafetyEscalationTriggeredEvent
  | SafetyEmployeeBlockedEvent;

export interface SafetySignalReceivedEvent {
  type: 'SafetySignalReceived';
  timestamp: number;
  tenant_id: string;
  signal_id: string;
  source: SafetySignalSource;
  severity: SafetySignalSeverity;
  entity_type: string;
  entity_id: string;
}

export interface SafetyRuleMatchedEvent {
  type: 'SafetyRuleMatched';
  timestamp: number;
  tenant_id: string;
  signal_id: string;
  rule_id: string;
  rule_name: string;
  action_count: number;
}

export interface SafetyActionExecutedEvent {
  type: 'SafetyActionExecuted';
  timestamp: number;
  tenant_id: string;
  signal_id: string;
  rule_id: string;
  action_type: SafetyActionType;
  status: ExecutionStatus;
  created_entity_id: string | null;
}

export interface SafetyExecutionCompletedEvent {
  type: 'SafetyExecutionCompleted';
  timestamp: number;
  tenant_id: string;
  execution_id: string;
  signal_id: string;
  rule_id: string;
  status: ExecutionStatus;
  actions_total: number;
  actions_succeeded: number;
  actions_failed: number;
  duration_ms: number;
}

export interface SafetyEscalationTriggeredEvent {
  type: 'SafetyEscalationTriggered';
  timestamp: number;
  tenant_id: string;
  signal_id: string;
  escalation_level: number;
  reason: string;
}

export interface SafetyEmployeeBlockedEvent {
  type: 'SafetyEmployeeBlocked';
  timestamp: number;
  tenant_id: string;
  employee_id: string;
  blocking_level: string;
  reason: string;
  signal_id: string;
}

// ═══════════════════════════════════════════════════════
// EVENT BUS (in-memory for domain layer)
// ═══════════════════════════════════════════════════════

type SafetyEventHandler = (event: SafetyAutomationEvent) => void;

const handlers: SafetyEventHandler[] = [];

export function onSafetyEvent(handler: SafetyEventHandler): () => void {
  handlers.push(handler);
  return () => {
    const idx = handlers.indexOf(handler);
    if (idx >= 0) handlers.splice(idx, 1);
  };
}

export function emitSafetyEvent(event: SafetyAutomationEvent): void {
  if (import.meta.env.DEV) {
    console.log(`[SafetyAutomation] Event: ${event.type}`, event);
  }
  for (const handler of handlers) {
    try {
      handler(event);
    } catch (err) {
      console.error(`[SafetyAutomation] Event handler error:`, err);
    }
  }
}
