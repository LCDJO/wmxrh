/**
 * Self-Healing Domain Events — Typed event definitions.
 *
 * Canonical events emitted by the Self-Healing layer:
 *
 *  ┌─────────────────────────┬──────────────────────────────────┐
 *  │ Event                   │ Emitted when                     │
 *  ├─────────────────────────┼──────────────────────────────────┤
 *  │ IncidentDetected        │ New incident created             │
 *  │ SelfHealingTriggered    │ Recovery process starts          │
 *  │ CircuitOpened           │ Circuit breaker transitions open │
 *  │ CircuitClosed           │ Circuit breaker closes           │
 *  │ ModuleRecovered         │ Module fully recovered           │
 *  └─────────────────────────┴──────────────────────────────────┘
 */

import type { IncidentSeverity, CircuitState, RecoveryActionType } from './types';

// ── Event payloads ─────────────────────────────────────────────

export interface IncidentDetectedPayload {
  type: 'IncidentDetected';
  incident_id: string;
  title: string;
  severity: IncidentSeverity;
  affected_modules: string[];
  timestamp: number;
}

export interface SelfHealingTriggeredPayload {
  type: 'SelfHealingTriggered';
  incident_id: string;
  severity: IncidentSeverity;
  planned_actions: RecoveryActionType[];
  timestamp: number;
}

export interface CircuitOpenedPayload {
  type: 'CircuitOpened';
  module_id: string;
  failure_count: number;
  previous_state: CircuitState;
  timestamp: number;
}

export interface CircuitClosedPayload {
  type: 'CircuitClosed';
  module_id: string;
  previous_state: CircuitState;
  recovery_duration_ms: number;
  timestamp: number;
}

export interface ModuleRecoveredPayload {
  type: 'ModuleRecovered';
  incident_id: string;
  module_id: string;
  actions_executed: number;
  recovery_duration_ms: number;
  auto_recovered: boolean;
  timestamp: number;
}

// ── Union type ─────────────────────────────────────────────────

export type SelfHealingDomainEvent =
  | IncidentDetectedPayload
  | SelfHealingTriggeredPayload
  | CircuitOpenedPayload
  | CircuitClosedPayload
  | ModuleRecoveredPayload;

export type SelfHealingEventType = SelfHealingDomainEvent['type'];

// ── Event bus (synchronous, in-memory) ─────────────────────────

type Listener<T extends SelfHealingDomainEvent = SelfHealingDomainEvent> = (event: T) => void;

const globalListeners = new Set<Listener>();
const typedListeners = new Map<SelfHealingEventType, Set<Listener<any>>>();

/** Subscribe to ALL self-healing domain events. */
export function onSelfHealingEvent(listener: Listener): () => void {
  globalListeners.add(listener);
  return () => { globalListeners.delete(listener); };
}

/** Subscribe to a specific self-healing event type. */
export function onSelfHealingEventType<T extends SelfHealingDomainEvent>(
  type: T['type'],
  listener: Listener<T>,
): () => void {
  if (!typedListeners.has(type)) typedListeners.set(type, new Set());
  typedListeners.get(type)!.add(listener);
  return () => { typedListeners.get(type)?.delete(listener); };
}

/** Emit a self-healing domain event. */
export function emitSelfHealingEvent(event: SelfHealingDomainEvent): void {
  for (const l of globalListeners) {
    try { l(event); } catch { /* swallow */ }
  }
  const typed = typedListeners.get(event.type);
  if (typed) {
    for (const l of typed) {
      try { l(event); } catch { /* swallow */ }
    }
  }
  eventLog.unshift(event);
  if (eventLog.length > MAX_LOG) eventLog.pop();
}

// ── Event log (debugging) ──────────────────────────────────────

const MAX_LOG = 100;
const eventLog: SelfHealingDomainEvent[] = [];

export function getSelfHealingEventLog(): ReadonlyArray<SelfHealingDomainEvent> {
  return eventLog;
}

export function clearSelfHealingEventLog(): void {
  eventLog.length = 0;
}

// ── Convenience emitters ───────────────────────────────────────

export function emitIncidentDetected(
  incidentId: string, title: string, severity: IncidentSeverity, modules: string[],
): void {
  emitSelfHealingEvent({
    type: 'IncidentDetected',
    incident_id: incidentId,
    title,
    severity,
    affected_modules: modules,
    timestamp: Date.now(),
  });
}

export function emitSelfHealingTriggered(
  incidentId: string, severity: IncidentSeverity, actions: RecoveryActionType[],
): void {
  emitSelfHealingEvent({
    type: 'SelfHealingTriggered',
    incident_id: incidentId,
    severity,
    planned_actions: actions,
    timestamp: Date.now(),
  });
}

export function emitCircuitOpened(
  moduleId: string, failureCount: number, previousState: CircuitState,
): void {
  emitSelfHealingEvent({
    type: 'CircuitOpened',
    module_id: moduleId,
    failure_count: failureCount,
    previous_state: previousState,
    timestamp: Date.now(),
  });
}

export function emitCircuitClosed(
  moduleId: string, previousState: CircuitState, recoveryDurationMs: number,
): void {
  emitSelfHealingEvent({
    type: 'CircuitClosed',
    module_id: moduleId,
    previous_state: previousState,
    recovery_duration_ms: recoveryDurationMs,
    timestamp: Date.now(),
  });
}

export function emitModuleRecovered(
  incidentId: string, moduleId: string,
  actionsExecuted: number, recoveryDurationMs: number, autoRecovered: boolean,
): void {
  emitSelfHealingEvent({
    type: 'ModuleRecovered',
    incident_id: incidentId,
    module_id: moduleId,
    actions_executed: actionsExecuted,
    recovery_duration_ms: recoveryDurationMs,
    auto_recovered: autoRecovered,
    timestamp: Date.now(),
  });
}
