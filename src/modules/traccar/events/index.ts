/**
 * Traccar Module — Event Handlers
 *
 * Reacts to cross-module events (e.g., fleet compliance triggers,
 * employee assignments) and emits traccar-specific events.
 */
import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';
import { TRACCAR_EVENTS } from '../manifest';

export function registerTraccarEventHandlers(sandbox: SandboxContext): () => void {
  const unsubscribers: Array<() => void> = [];

  // Listen for tracking event ingestion to evaluate speed policies
  const offIngested = sandbox.on(TRACCAR_EVENTS.TRACKING_EVENT_INGESTED, (payload) => {
    const { speed, device_id, tenant_id } = payload as Record<string, unknown>;
    if (typeof speed === 'number' && speed > 100) {
      sandbox.emit(TRACCAR_EVENTS.SPEED_VIOLATION_DETECTED, {
        device_id,
        tenant_id,
        speed,
        threshold: 100,
        severity: speed > 130 ? 'critical' : 'high',
      });
    }
  });
  unsubscribers.push(offIngested);

  return () => {
    unsubscribers.forEach(fn => fn());
  };
}
