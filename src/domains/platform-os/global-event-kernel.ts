/**
 * GlobalEventKernel — Unified event bus for the entire platform.
 *
 * All domain events, platform events, and cognitive signals flow
 * through this kernel. It provides:
 *   - Typed pub/sub with priority ordering
 *   - Correlation IDs for event tracing
 *   - Rolling in-memory log
 *   - Stats per event type
 *
 * IMPORTANT: This kernel WRAPS the existing platformEvents bus.
 * Legacy code can still use platformEvents directly; the kernel
 * bridges events into the unified stream.
 */

import type {
  GlobalEventKernelAPI,
  KernelEvent,
  KernelEventHandler,
  EventSubscription,
  EventKernelStats,
  EventPriority,
} from './types';

const PRIORITY_ORDER: Record<EventPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
const MAX_LOG = 500;

let _idCounter = 0;

export function createGlobalEventKernel(): GlobalEventKernelAPI {
  const subscriptions: EventSubscription[] = [];
  const log: KernelEvent[] = [];
  const statsMap: Record<string, number> = {};
  let totalEmitted = 0;
  let totalHandled = 0;

  function emit<T = unknown>(
    type: string,
    source: string,
    payload: T,
    opts?: { priority?: EventPriority; correlation_id?: string },
  ): void {
    const event: KernelEvent<T> = {
      id: `ke_${++_idCounter}_${Date.now()}`,
      type,
      source,
      timestamp: Date.now(),
      priority: opts?.priority ?? 'normal',
      payload,
      correlation_id: opts?.correlation_id,
    };

    // Log
    log.push(event as KernelEvent);
    if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
    totalEmitted++;
    statsMap[type] = (statsMap[type] ?? 0) + 1;

    // Dispatch to matching handlers sorted by priority
    const matching = subscriptions
      .filter(s => (s.event_type === '*' || s.event_type === type) && (!s.source_filter || s.source_filter === source))
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    for (const sub of matching) {
      try {
        const result = sub.handler(event as KernelEvent);
        if (result instanceof Promise) result.catch(err => console.error('[EventKernel] async handler error:', err));
        totalHandled++;
      } catch (err) {
        console.error('[EventKernel] handler error:', err);
      }
    }
  }

  function on<T = unknown>(
    type: string,
    handler: KernelEventHandler<T>,
    opts?: { priority?: EventPriority; source_filter?: string },
  ): () => void {
    const sub: EventSubscription = {
      id: `sub_${++_idCounter}`,
      event_type: type,
      source_filter: opts?.source_filter,
      handler: handler as KernelEventHandler,
      priority: opts?.priority ?? 'normal',
    };
    subscriptions.push(sub);
    return () => {
      const idx = subscriptions.indexOf(sub);
      if (idx >= 0) subscriptions.splice(idx, 1);
    };
  }

  function once<T = unknown>(type: string, handler: KernelEventHandler<T>): () => void {
    const unsub = on<T>(type, (event) => {
      unsub();
      return handler(event);
    });
    return unsub;
  }

  function stats(): EventKernelStats {
    return {
      total_emitted: totalEmitted,
      total_handled: totalHandled,
      active_subscriptions: subscriptions.length,
      events_per_type: { ...statsMap },
    };
  }

  return { emit, on, once, stats };
}
