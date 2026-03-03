/**
 * Architecture Risk — Domain Events
 *
 * Events:
 *   1. ArchitectureRiskCalculated    → risk score computed for a module
 *   2. CriticalDependencyDetected    → critical dependency found
 *   3. CircularDependencyBlocked     → circular dependency cycle blocked
 *   4. RefactorSuggestionGenerated   → refactor suggestion emitted
 */

type EventHandler<T = ArchitectureRiskDomainEvent> = (event: T) => void;

const globalHandlers = new Set<EventHandler>();
const typedHandlers = new Map<ArchitectureRiskEventType, Set<EventHandler<any>>>();

// ── Event Types ──

export type ArchitectureRiskEventType =
  | 'ArchitectureRiskCalculated'
  | 'CriticalDependencyDetected'
  | 'CircularDependencyBlocked'
  | 'RefactorSuggestionGenerated';

// ── Payloads ──

export interface ArchitectureRiskCalculatedPayload {
  type: 'ArchitectureRiskCalculated';
  timestamp: number;
  module_key: string;
  risk_score: number;
  risk_level: string;
  factors: { factor: string; weight: number; score: number }[];
}

export interface CriticalDependencyDetectedPayload {
  type: 'CriticalDependencyDetected';
  timestamp: number;
  from_module: string;
  to_module: string;
  dependency_risk_score: number;
  is_blocking: boolean;
  reason: string;
}

export interface CircularDependencyBlockedPayload {
  type: 'CircularDependencyBlocked';
  timestamp: number;
  cycle: string[];
  severity: 'warning' | 'critical';
  blocking_edges: { from: string; to: string }[];
}

export interface RefactorSuggestionGeneratedPayload {
  type: 'RefactorSuggestionGenerated';
  timestamp: number;
  module_key: string;
  category: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimated_effort: string;
}

// ── Union ──

export type ArchitectureRiskDomainEvent =
  | ArchitectureRiskCalculatedPayload
  | CriticalDependencyDetectedPayload
  | CircularDependencyBlockedPayload
  | RefactorSuggestionGeneratedPayload;

// ── Bus ──

export function onArchitectureRiskEvent(listener: EventHandler): () => void {
  globalHandlers.add(listener);
  return () => { globalHandlers.delete(listener); };
}

export function onArchitectureRiskEventType<T extends ArchitectureRiskDomainEvent>(
  type: T['type'],
  listener: EventHandler<T>,
): () => void {
  if (!typedHandlers.has(type)) typedHandlers.set(type, new Set());
  typedHandlers.get(type)!.add(listener);
  return () => { typedHandlers.get(type)?.delete(listener); };
}

export function emitArchitectureRiskEvent(event: ArchitectureRiskDomainEvent): void {
  for (const l of globalHandlers) {
    try { l(event); } catch { /* swallow */ }
  }
  const typed = typedHandlers.get(event.type);
  if (typed) {
    for (const l of typed) {
      try { l(event); } catch { /* swallow */ }
    }
  }
  eventLog.unshift(event);
  if (eventLog.length > MAX_LOG) eventLog.pop();
}

// ── Log ──

const MAX_LOG = 100;
const eventLog: ArchitectureRiskDomainEvent[] = [];

export function getArchitectureRiskEventLog(): ReadonlyArray<ArchitectureRiskDomainEvent> {
  return eventLog;
}

export function clearArchitectureRiskEventLog(): void {
  eventLog.length = 0;
}

export const __DOMAIN_CATALOG = {
  domain: 'Architecture Risk',
  color: 'hsl(0 72% 51%)',
  events: [
    { name: 'ArchitectureRiskCalculated', description: 'Score de risco calculado para um módulo' },
    { name: 'CriticalDependencyDetected', description: 'Dependência crítica detectada' },
    { name: 'CircularDependencyBlocked', description: 'Ciclo de dependência circular bloqueado' },
    { name: 'RefactorSuggestionGenerated', description: 'Sugestão de refatoração gerada' },
  ],
};
