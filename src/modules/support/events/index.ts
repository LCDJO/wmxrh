import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';
import { SUPPORT_MODULE_EVENTS } from '../manifest';

/**
 * Register event handlers for the support module.
 * Returns a cleanup function to unsubscribe all listeners.
 */
export function registerSupportEventHandlers(sandbox: SandboxContext): () => void {
  const unsubs: Array<() => void> = [];

  // ── AgentAlertTriggered ──
  unsubs.push(
    sandbox.on(SUPPORT_MODULE_EVENTS.AGENT_ALERT_TRIGGERED, (payload) => {
      console.info('[Support] Agent alert triggered', payload);
      // Future: push to notification system, escalation engine, etc.
    }),
  );

  // ── ChatSessionAccepted ──
  unsubs.push(
    sandbox.on(SUPPORT_MODULE_EVENTS.CHAT_SESSION_ACCEPTED, (payload) => {
      console.info('[Support] Chat session accepted by agent', payload);
    }),
  );

  // ── ChatSessionPaused ──
  unsubs.push(
    sandbox.on(SUPPORT_MODULE_EVENTS.CHAT_SESSION_PAUSED, (payload) => {
      console.info('[Support] Chat session paused', payload);
    }),
  );

  // ── ChatSessionClosed ──
  unsubs.push(
    sandbox.on(SUPPORT_MODULE_EVENTS.CHAT_SESSION_CLOSED, (payload) => {
      console.info('[Support] Chat session closed', payload);
    }),
  );

  // ── InternalNoteAdded ──
  unsubs.push(
    sandbox.on(SUPPORT_MODULE_EVENTS.INTERNAL_NOTE_ADDED, (payload) => {
      console.info('[Support] Internal note added', payload);
    }),
  );

  return () => unsubs.forEach((fn) => fn());
}
