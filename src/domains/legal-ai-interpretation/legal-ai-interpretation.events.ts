/**
 * Legal AI Interpretation Engine — Domain Events
 */

export type EventHandler = (...args: unknown[]) => void;
const handlers = new Map<string, Set<EventHandler>>();

export const legalAiEvents = {
  INTERPRETATION_GENERATED: 'legal_ai.interpretation_generated',
  POSITION_IMPACT_ANALYZED: 'legal_ai.position_impact_analyzed',
  ACTION_PLAN_CREATED: 'legal_ai.action_plan_created',
  ACTION_PLAN_APPROVED: 'legal_ai.action_plan_approved',
  WORKFLOW_GENERATED: 'legal_ai.workflow_generated',
  WORKFLOW_EXECUTED: 'legal_ai.workflow_executed',
  SUMMARY_PUBLISHED: 'legal_ai.summary_published',
  HUMAN_REVIEW_REQUIRED: 'legal_ai.human_review_required',
} as const;

export function emitLegalAiEvent(event: string, payload?: unknown): void {
  const fns = handlers.get(event);
  if (fns) fns.forEach(fn => { try { fn(payload); } catch (e) { console.error(`[LegalAI Event] ${event}:`, e); } });
}

export function onLegalAiEvent(event: string, handler: EventHandler): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  return () => { handlers.get(event)?.delete(handler); };
}
