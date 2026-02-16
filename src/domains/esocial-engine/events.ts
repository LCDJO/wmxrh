/**
 * eSocial Engine — Internal Event Bus
 *
 * Lightweight pub/sub for decoupling from HR Core.
 * Other bounded contexts emit domain events; this engine subscribes.
 *
 * Pattern: Observer with typed events.
 * No external dependencies — pure TypeScript.
 */

import type { InboundDomainEvent, InboundEventName } from './types';

type EventHandler = (event: InboundDomainEvent) => void | Promise<void>;

const handlers = new Map<InboundEventName, Set<EventHandler>>();

/**
 * Subscribe to an inbound domain event.
 * Returns unsubscribe function.
 */
export function onESocialEvent(
  eventName: InboundEventName,
  handler: EventHandler,
): () => void {
  if (!handlers.has(eventName)) {
    handlers.set(eventName, new Set());
  }
  handlers.get(eventName)!.add(handler);
  return () => {
    handlers.get(eventName)?.delete(handler);
  };
}

/**
 * Emit a domain event into the eSocial engine.
 * Called by HR Core, Compensation, Health, etc.
 */
export async function emitToESocial(event: InboundDomainEvent): Promise<void> {
  const eventHandlers = handlers.get(event.event_name);
  if (!eventHandlers) return;

  const promises: Promise<void>[] = [];
  for (const handler of eventHandlers) {
    const result = handler(event);
    if (result instanceof Promise) promises.push(result);
  }
  if (promises.length > 0) {
    await Promise.allSettled(promises);
  }
}

/**
 * Convenience: build an InboundDomainEvent with proper shape.
 */
export function createDomainEvent<T extends Record<string, unknown>>(
  eventName: InboundEventName,
  tenantId: string,
  entityType: string,
  entityId: string,
  payload: T,
  companyId?: string | null,
): InboundDomainEvent<T> {
  return {
    event_name: eventName,
    tenant_id: tenantId,
    company_id: companyId ?? null,
    entity_type: entityType,
    entity_id: entityId,
    payload,
    occurred_at: new Date().toISOString(),
  };
}

/** Reset all handlers (useful for testing) */
export function resetESocialHandlers(): void {
  handlers.clear();
}
