/**
 * Workforce Intelligence — Domain Events
 *
 * Events emitted when the insight generation engine runs.
 * Follows the project's event-driven architecture pattern.
 */

export type WorkforceIntelligenceEventType =
  | 'WorkforceInsightCreated'
  | 'RiskScoreUpdated';

export interface WorkforceInsightCreatedEvent {
  type: 'WorkforceInsightCreated';
  tenant_id: string;
  insight_id: string;
  insight_type: string;
  severity: string;
  description: string;
  dados_origem_json: Record<string, unknown>;
  created_at: string;
}

export interface RiskScoreUpdatedEvent {
  type: 'RiskScoreUpdated';
  tenant_id: string;
  previous_score: number | null;
  new_score: number;
  risk_count: number;
  critical_count: number;
  financial_exposure: number;
  updated_at: string;
}

export type WorkforceIntelligenceEvent =
  | WorkforceInsightCreatedEvent
  | RiskScoreUpdatedEvent;

/** Simple in-memory event bus for domain events */
type EventHandler = (event: WorkforceIntelligenceEvent) => void;
const handlers: EventHandler[] = [];

export function onWorkforceEvent(handler: EventHandler): () => void {
  handlers.push(handler);
  return () => {
    const idx = handlers.indexOf(handler);
    if (idx >= 0) handlers.splice(idx, 1);
  };
}

export function emitWorkforceEvent(event: WorkforceIntelligenceEvent): void {
  for (const h of handlers) {
    try { h(event); } catch (e) { console.error('[WorkforceEvent] handler error:', e); }
  }
}
