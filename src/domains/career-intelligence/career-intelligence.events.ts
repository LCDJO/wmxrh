/**
 * Career Intelligence — Domain Events
 */

type EventHandler = (payload: Record<string, unknown>) => void;
const handlers = new Map<string, EventHandler[]>();

export const careerIntelligenceEvents = {
  POSITION_CREATED: 'career:position_created',
  POSITION_UPDATED: 'career:position_updated',
  PATH_CREATED: 'career:path_created',
  COMPLIANCE_ANALYZED: 'career:compliance_analyzed',
  RISK_ALERT_CREATED: 'career:risk_alert_created',
  RISK_ALERT_RESOLVED: 'career:risk_alert_resolved',
  SALARY_BELOW_BENCHMARK: 'career:salary_below_benchmark',
} as const;

export function emitCareerEvent(event: string, payload: Record<string, unknown>): void {
  const fns = handlers.get(event) || [];
  fns.forEach(fn => fn(payload));
}

export function onCareerEvent(event: string, handler: EventHandler): () => void {
  if (!handlers.has(event)) handlers.set(event, []);
  handlers.get(event)!.push(handler);
  return () => {
    const arr = handlers.get(event);
    if (arr) handlers.set(event, arr.filter(h => h !== handler));
  };
}
