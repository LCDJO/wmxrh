/**
 * Governance AI — Domain Events
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CRITICAL INVARIANT:                                            ║
 * ║  GovernanceAI NEVER mutates permissions automatically.          ║
 * ║  It only SUGGESTS. All events are informational.                ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Events:
 *  1. GovernanceRiskDetected       → new risk insight detected
 *  2. RoleOptimizationSuggested    → merge/split/remove suggestion
 *  3. PermissionConflictDetected   → SoD or scope conflict found
 */

import type { GovernanceInsight, InsightSeverity } from './types';
import type { RoleOptimizationHint } from './role-optimization-advisor';

// ════════════════════════════════════
// EVENT TYPES
// ════════════════════════════════════

export type GovernanceEventType =
  | 'GovernanceRiskDetected'
  | 'RoleOptimizationSuggested'
  | 'PermissionConflictDetected';

// ── GovernanceRiskDetected ──

export interface GovernanceRiskDetectedPayload {
  type: 'GovernanceRiskDetected';
  timestamp: number;
  severity: InsightSeverity;
  insight_count: number;
  critical_count: number;
  warning_count: number;
  top_insight: {
    id: string;
    category: string;
    title: string;
    severity: InsightSeverity;
    confidence: number;
  } | null;
}

// ── RoleOptimizationSuggested ──

export interface RoleOptimizationSuggestedPayload {
  type: 'RoleOptimizationSuggested';
  timestamp: number;
  hint_type: RoleOptimizationHint['type'];
  affected_roles: Array<{ id: string; label: string }>;
  description: string;
  estimated_reduction: number;
}

// ── PermissionConflictDetected ──

export interface PermissionConflictDetectedPayload {
  type: 'PermissionConflictDetected';
  timestamp: number;
  conflict_category: 'sod_conflict' | 'role_overlap' | 'anomalous_pattern' | 'privilege_escalation';
  severity: InsightSeverity;
  affected_user: { id: string; label: string } | null;
  affected_roles: Array<{ id: string; label: string }>;
  rule: string;
}

// ── Union ──

export type GovernanceDomainEvent =
  | GovernanceRiskDetectedPayload
  | RoleOptimizationSuggestedPayload
  | PermissionConflictDetectedPayload;

// ════════════════════════════════════
// EVENT BUS (synchronous, in-memory)
// ════════════════════════════════════

type GovernanceEventListener<T extends GovernanceDomainEvent = GovernanceDomainEvent> = (event: T) => void;

const globalListeners = new Set<GovernanceEventListener>();
const typedListeners = new Map<GovernanceEventType, Set<GovernanceEventListener<any>>>();

/** Subscribe to ALL governance domain events. */
export function onGovernanceEvent(listener: GovernanceEventListener): () => void {
  globalListeners.add(listener);
  return () => { globalListeners.delete(listener); };
}

/** Subscribe to a specific governance event type. */
export function onGovernanceEventType<T extends GovernanceDomainEvent>(
  type: T['type'],
  listener: GovernanceEventListener<T>,
): () => void {
  if (!typedListeners.has(type)) typedListeners.set(type, new Set());
  typedListeners.get(type)!.add(listener);
  return () => { typedListeners.get(type)?.delete(listener); };
}

/** Emit a governance domain event. */
export function emitGovernanceEvent(event: GovernanceDomainEvent): void {
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
const eventLog: GovernanceDomainEvent[] = [];

export function getGovernanceEventLog(): ReadonlyArray<GovernanceDomainEvent> {
  return eventLog;
}

export function clearGovernanceEventLog(): void {
  eventLog.length = 0;
}

// ════════════════════════════════════
// CONVENIENCE EMITTERS
// ════════════════════════════════════

/** Emit after a heuristic scan completes. */
export function emitRiskDetected(insights: GovernanceInsight[]): void {
  if (insights.length === 0) return;

  const critical = insights.filter(i => i.severity === 'critical');
  const warnings = insights.filter(i => i.severity === 'warning');
  const top = insights[0]; // already sorted by severity

  emitGovernanceEvent({
    type: 'GovernanceRiskDetected',
    timestamp: Date.now(),
    severity: critical.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : 'info',
    insight_count: insights.length,
    critical_count: critical.length,
    warning_count: warnings.length,
    top_insight: top ? {
      id: top.id,
      category: top.category,
      title: top.title,
      severity: top.severity,
      confidence: top.confidence,
    } : null,
  });
}

/** Emit for each optimization hint generated. */
export function emitOptimizationSuggested(hint: RoleOptimizationHint): void {
  emitGovernanceEvent({
    type: 'RoleOptimizationSuggested',
    timestamp: Date.now(),
    hint_type: hint.type,
    affected_roles: hint.roles.map(r => ({ id: r.id, label: r.label })),
    description: hint.description,
    estimated_reduction: hint.estimated_reduction,
  });
}

/** Emit for SoD and permission conflict insights. */
export function emitConflictDetected(insight: GovernanceInsight): void {
  const userEntity = insight.affected_entities.find(e => e.type === 'user');
  const roleEntities = insight.affected_entities.filter(e => e.type === 'role');

  emitGovernanceEvent({
    type: 'PermissionConflictDetected',
    timestamp: Date.now(),
    conflict_category: insight.category as any,
    severity: insight.severity,
    affected_user: userEntity ? { id: userEntity.id, label: userEntity.label } : null,
    affected_roles: roleEntities.map(r => ({ id: r.id, label: r.label })),
    rule: insight.title,
  });
}

export const __DOMAIN_CATALOG = {
  domain: 'Governance AI',
  color: 'hsl(320 60% 50%)',
  events: [
    { name: 'GovernanceRiskDetected', description: 'Risco de governança detectado por IA' },
    { name: 'RoleOptimizationSuggested', description: 'Sugestão de otimização de role' },
    { name: 'PermissionConflictDetected', description: 'Conflito de permissão detectado' },
    { name: 'ComplianceViolation', description: 'Violação de compliance detectada' },
    { name: 'PolicyRecommendation', description: 'Recomendação de política gerada' },
  ],
};
