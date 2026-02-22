/**
 * SecurityEventCollector — Captures security events from the Security Kernel.
 */

import type { SecurityEvent, SecurityEventType } from './types';
import { getMetricsCollector } from './metrics-collector';

const MAX_EVENTS = 500;

class SecurityEventCollector {
  private events: SecurityEvent[] = [];
  private listeners = new Set<() => void>();

  record(event: Omit<SecurityEvent, 'id' | 'timestamp'>) {
    const secEvent: SecurityEvent = {
      ...event,
      id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };

    this.events.push(secEvent);
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);

    getMetricsCollector().increment('security.events_total', {
      type: event.type,
      result: event.result,
    });

    if (event.result === 'denied') {
      getMetricsCollector().increment('security.denied_total', { type: event.type });
    }

    this.notify();
  }

  getEvents(opts?: {
    type?: SecurityEventType;
    since?: number;
    limit?: number;
    result?: SecurityEvent['result'];
  }): SecurityEvent[] {
    let result = [...this.events];
    if (opts?.type) result = result.filter(e => e.type === opts.type);
    if (opts?.result) result = result.filter(e => e.result === opts.result);
    if (opts?.since) result = result.filter(e => e.timestamp >= opts.since!);
    result.sort((a, b) => b.timestamp - a.timestamp);
    if (opts?.limit) result = result.slice(0, opts.limit);
    return result;
  }

  getStats(windowMs = 3_600_000) {
    const since = Date.now() - windowMs;
    const recent = this.events.filter(e => e.timestamp >= since);

    const byType: Record<string, number> = {};
    let denied = 0;
    let flagged = 0;

    for (const e of recent) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      if (e.result === 'denied') denied++;
      if (e.result === 'flagged') flagged++;
    }

    return {
      total: recent.length,
      denied,
      flagged,
      by_type: byType,
      window_ms: windowMs,
    };
  }

  clear() {
    this.events = [];
    this.notify();
  }

  onUpdate(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }
}

let _collector: SecurityEventCollector | null = null;
export function getSecurityEventCollector(): SecurityEventCollector {
  if (!_collector) _collector = new SecurityEventCollector();
  return _collector;
}

export { SecurityEventCollector };
