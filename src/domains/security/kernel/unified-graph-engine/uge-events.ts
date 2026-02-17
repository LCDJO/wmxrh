/**
 * UGE Domain Events
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Events emitted by the Unified Graph Engine lifecycle:           ║
 * ║                                                                  ║
 * ║  1. GraphComposed           → new snapshot composed              ║
 * ║  2. RiskScoreUpdated        → risk assessment recalculated       ║
 * ║  3. AccessAnomalyDetected   → anomaly found during analysis      ║
 * ║                                                                  ║
 * ║  READ-ONLY: These events are informational only.                ║
 * ║  They NEVER trigger permission mutations.                        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type {
  GraphDomain,
  RiskLevel,
  RiskSignal,
  UnifiedGraphSnapshot,
} from './types';

// ════════════════════════════════════
// EVENT TYPES
// ════════════════════════════════════

export type UGEEventType =
  | 'GraphComposed'
  | 'RiskScoreUpdated'
  | 'AccessAnomalyDetected';

// ── GraphComposed ──

export interface GraphComposedPayload {
  type: 'GraphComposed';
  timestamp: number;
  version: number;
  domains: readonly GraphDomain[];
  nodeCount: number;
  edgeCount: number;
  compositionTimeMs: number;
}

// ── RiskScoreUpdated ──

export interface RiskScoreUpdatedPayload {
  type: 'RiskScoreUpdated';
  timestamp: number;
  previousLevel: RiskLevel | null;
  currentLevel: RiskLevel;
  signalCount: number;
  criticalSignals: number;
  highSignals: number;
  userScoreCount: number;
}

// ── AccessAnomalyDetected ──

export type AnomalyKind =
  | 'orphan_nodes'
  | 'excessive_permissions'
  | 'cross_domain_leak'
  | 'role_overlap'
  | 'unused_role'
  | 'privilege_escalation_path';

export interface AccessAnomalyDetectedPayload {
  type: 'AccessAnomalyDetected';
  timestamp: number;
  anomalyKind: AnomalyKind;
  severity: RiskLevel;
  title: string;
  detail: string;
  affectedNodeUids: string[];
  relatedSignals: string[];
}

// ── Union ──

export type UGEDomainEvent =
  | GraphComposedPayload
  | RiskScoreUpdatedPayload
  | AccessAnomalyDetectedPayload;

// ════════════════════════════════════
// EVENT BUS (synchronous, in-memory)
// ════════════════════════════════════

type UGEEventListener<T extends UGEDomainEvent = UGEDomainEvent> = (event: T) => void;

const globalListeners = new Set<UGEEventListener>();
const typedListeners = new Map<UGEEventType, Set<UGEEventListener<any>>>();

/** Subscribe to ALL UGE domain events. */
export function onUGEEvent(listener: UGEEventListener): () => void {
  globalListeners.add(listener);
  return () => { globalListeners.delete(listener); };
}

/** Subscribe to a specific UGE event type. */
export function onUGEEventType<T extends UGEDomainEvent>(
  type: T['type'],
  listener: UGEEventListener<T>,
): () => void {
  if (!typedListeners.has(type)) typedListeners.set(type, new Set());
  typedListeners.get(type)!.add(listener);
  return () => { typedListeners.get(type)?.delete(listener); };
}

/** Emit a UGE domain event. */
export function emitUGEEvent(event: UGEDomainEvent): void {
  for (const l of globalListeners) {
    try { l(event); } catch { /* swallow */ }
  }
  const typed = typedListeners.get(event.type);
  if (typed) {
    for (const l of typed) {
      try { l(event); } catch { /* swallow */ }
    }
  }
  // Auto-log
  eventLog.unshift(event);
  if (eventLog.length > MAX_LOG) eventLog.pop();
}

// ════════════════════════════════════
// EVENT LOG (debugging)
// ════════════════════════════════════

const MAX_LOG = 50;
const eventLog: UGEDomainEvent[] = [];

export function getUGEEventLog(): ReadonlyArray<UGEDomainEvent> {
  return eventLog;
}

export function clearUGEEventLog(): void {
  eventLog.length = 0;
}

export const __DOMAIN_CATALOG = {
  domain: 'Unified Graph',
  color: 'hsl(330 55% 48%)',
  events: [
    { name: 'GraphComposed', description: 'Grafo unificado composto' },
    { name: 'RiskScoreUpdated', description: 'Score de risco atualizado (UGE)' },
    { name: 'AccessAnomalyDetected', description: 'Anomalia de acesso detectada' },
  ],
};
