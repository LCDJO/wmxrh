/**
 * GovernanceCoreEngine — In-Process Event Bus
 *
 * Pub/sub for domain events within the governance bounded context.
 * Handlers are invoked after events are persisted (append-only guarantee).
 */

import type { GovernanceDomainEvent } from './governance-domain-event';

type EventHandler = (event: GovernanceDomainEvent) => void | Promise<void>;

const handlers = new Map<string, Set<EventHandler>>();
const wildcardHandlers = new Set<EventHandler>();

/** Subscribe to a specific event type. Returns unsubscribe fn. */
export function onGovernanceEvent(eventType: string, handler: EventHandler): () => void {
  if (!handlers.has(eventType)) handlers.set(eventType, new Set());
  handlers.get(eventType)!.add(handler);
  return () => { handlers.get(eventType)?.delete(handler); };
}

/** Subscribe to ALL governance events. */
export function onAnyGovernanceEvent(handler: EventHandler): () => void {
  wildcardHandlers.add(handler);
  return () => { wildcardHandlers.delete(handler); };
}

/** Dispatch events (called by the repository after successful append). */
export async function dispatchGovernanceEvents(events: GovernanceDomainEvent[]): Promise<void> {
  for (const event of events) {
    const specific = handlers.get(event.event_type);
    const all = [...(specific ?? []), ...wildcardHandlers];
    const promises: Promise<void>[] = [];
    for (const h of all) {
      const r = h(event);
      if (r instanceof Promise) promises.push(r);
    }
    if (promises.length) await Promise.allSettled(promises);
  }
}

/** Reset (testing) */
export function resetGovernanceEventBus(): void {
  handlers.clear();
  wildcardHandlers.clear();
}
