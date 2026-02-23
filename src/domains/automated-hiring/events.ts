/**
 * Automated Hiring Workflow — Event Bus
 *
 * Internal pub/sub for hiring workflow domain events.
 */
import type { HiringDomainEvent, HiringEventName } from './types';

type HiringHandler = (event: HiringDomainEvent) => void | Promise<void>;

const handlers = new Map<HiringEventName, Set<HiringHandler>>();

export function onHiringEvent(name: HiringEventName, handler: HiringHandler): () => void {
  if (!handlers.has(name)) handlers.set(name, new Set());
  handlers.get(name)!.add(handler);
  return () => { handlers.get(name)?.delete(handler); };
}

export async function emitHiringEvent(event: HiringDomainEvent): Promise<void> {
  const set = handlers.get(event.event_name);
  if (!set) return;
  const promises: Promise<void>[] = [];
  for (const h of set) {
    const r = h(event);
    if (r instanceof Promise) promises.push(r);
  }
  if (promises.length) await Promise.allSettled(promises);
}

export function buildHiringEvent<T extends Record<string, unknown>>(
  eventName: HiringEventName,
  workflowId: string,
  tenantId: string,
  payload: T,
): HiringDomainEvent<T> {
  return {
    event_name: eventName,
    workflow_id: workflowId,
    tenant_id: tenantId,
    payload,
    occurred_at: new Date().toISOString(),
  };
}

export function resetHiringHandlers(): void {
  handlers.clear();
}
