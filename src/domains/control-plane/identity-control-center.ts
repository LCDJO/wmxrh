/**
 * IdentityControlCenter — Identity summary for the Control Plane.
 * Reads from IdentityOrchestrator (POSL) — no direct security checks.
 */

import type { PlatformRuntimeAPI } from '@/domains/platform-os/types';
import type { IdentityControlSummary, IdentityEvent } from './types';

export class IdentityControlCenter {
  private recentEvents: IdentityEvent[] = [];
  private unsub: (() => void) | null = null;

  constructor(private runtime: PlatformRuntimeAPI) {}

  start(): void {
    this.unsub = this.runtime.identity.onIdentityChange((snap) => {
      this.recentEvents.push({
        type: snap.is_impersonating ? 'impersonation_change' : 'identity_change',
        user_id: snap.user_id ?? 'anonymous',
        timestamp: Date.now(),
        details: `phase=${snap.phase}, tenant=${snap.current_tenant_id ?? 'none'}`,
      });
      if (this.recentEvents.length > 50) this.recentEvents.shift();
    });
  }

  stop(): void {
    this.unsub?.();
    this.unsub = null;
  }

  getSummary(): IdentityControlSummary {
    const snap = this.runtime.identity.snapshot();
    return {
      total_active_users_estimate: snap.is_authenticated ? 1 : 0,
      active_impersonations: snap.is_impersonating ? 1 : 0,
      high_risk_users: snap.risk_level === 'high' || snap.risk_level === 'critical' ? 1 : 0,
      recent_identity_events: this.recentEvents.slice(-20),
    };
  }
}
