/**
 * IdentityOrchestrator — Unified identity state for the POSL.
 *
 * Bridges the Security Kernel's identity services into a single
 * snapshot that any part of the platform can query.
 *
 * SECURITY: This is a READ-ONLY facade. It does NOT create or
 * modify identity — it only reads from the Security Kernel.
 */

import type { IdentityOrchestratorAPI, IdentitySnapshot, GlobalEventKernelAPI } from './types';

type IdentityChangeHandler = (snapshot: IdentitySnapshot) => void;

export function createIdentityOrchestrator(events: GlobalEventKernelAPI): IdentityOrchestratorAPI {
  let currentSnapshot: IdentitySnapshot = emptySnapshot();
  const listeners = new Set<IdentityChangeHandler>();

  function emptySnapshot(): IdentitySnapshot {
    return {
      user_id: null,
      email: null,
      is_authenticated: false,
      is_platform_admin: false,
      is_tenant_admin: false,
      current_tenant_id: null,
      current_scope: null,
      roles: [],
      impersonating: false,
      phase: 'idle',
    };
  }

  function snapshot(): IdentitySnapshot {
    return { ...currentSnapshot };
  }

  async function refresh(): Promise<void> {
    // In production, this reads from Security Kernel's buildSecurityContext
    // For now, we emit an event that the app shell can respond to
    events.emit('identity:refresh_requested', 'IdentityOrchestrator', {});
  }

  function onIdentityChange(handler: IdentityChangeHandler): () => void {
    listeners.add(handler);
    return () => listeners.delete(handler);
  }

  // Listen for identity updates from the Security Kernel
  events.on<Partial<IdentitySnapshot>>('identity:updated', (event) => {
    currentSnapshot = { ...currentSnapshot, ...event.payload };
    listeners.forEach(fn => {
      try { fn(currentSnapshot); } catch (err) { console.error('[IdentityOrchestrator] listener error:', err); }
    });
  });

  return { snapshot, refresh, onIdentityChange };
}
