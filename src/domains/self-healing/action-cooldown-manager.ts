/**
 * ActionCooldownManager — Enforces cooldown between automatic recovery actions.
 *
 * Prevents rapid-fire execution of the same action type on the same module,
 * avoiding resource thrashing and cascading restarts.
 */

import type { RecoveryActionType } from './types';

interface CooldownEntry {
  last_executed_at: number;
  execution_count: number;
}

// Default cooldowns per action type (ms)
const DEFAULT_COOLDOWNS: Record<RecoveryActionType, number> = {
  module_restart:       15_000,   // 15s
  module_deactivate:    60_000,   // 1min
  circuit_break:        10_000,   // 10s
  cache_clear:           5_000,   // 5s
  sandbox_reset:        30_000,   // 30s
  access_graph_rebuild: 60_000,   // 1min
  rate_limit_engage:    20_000,   // 20s
  route_isolate:        30_000,   // 30s
  widget_disable:       15_000,   // 15s
  escalate:            120_000,   // 2min
};

export class ActionCooldownManager {
  private entries = new Map<string, CooldownEntry>();
  private customCooldowns = new Map<string, number>();

  /** Build a unique key for action+module pair. */
  private key(action: RecoveryActionType, moduleId: string): string {
    return `${action}::${moduleId}`;
  }

  /** Check if an action is allowed (not in cooldown). */
  isAllowed(action: RecoveryActionType, moduleId: string): boolean {
    const k = this.key(action, moduleId);
    const entry = this.entries.get(k);
    if (!entry) return true;

    const cooldown = this.customCooldowns.get(k) ?? DEFAULT_COOLDOWNS[action] ?? 10_000;
    return Date.now() - entry.last_executed_at >= cooldown;
  }

  /** Remaining cooldown time in ms. Returns 0 if no cooldown active. */
  remainingMs(action: RecoveryActionType, moduleId: string): number {
    const k = this.key(action, moduleId);
    const entry = this.entries.get(k);
    if (!entry) return 0;

    const cooldown = this.customCooldowns.get(k) ?? DEFAULT_COOLDOWNS[action] ?? 10_000;
    return Math.max(0, cooldown - (Date.now() - entry.last_executed_at));
  }

  /** Record that an action was executed (starts cooldown). */
  record(action: RecoveryActionType, moduleId: string): void {
    const k = this.key(action, moduleId);
    const entry = this.entries.get(k);
    if (entry) {
      entry.last_executed_at = Date.now();
      entry.execution_count++;
    } else {
      this.entries.set(k, { last_executed_at: Date.now(), execution_count: 1 });
    }
  }

  /** Override cooldown for a specific action+module pair. */
  setCooldown(action: RecoveryActionType, moduleId: string, cooldownMs: number): void {
    this.customCooldowns.set(this.key(action, moduleId), cooldownMs);
  }

  /** Get execution stats. */
  getStats(): Array<{ action: string; module: string; count: number; last_at: number }> {
    return Array.from(this.entries.entries()).map(([k, v]) => {
      const [action, module] = k.split('::');
      return { action, module, count: v.execution_count, last_at: v.last_executed_at };
    });
  }

  /** Reset all cooldowns (testing). */
  reset(): void {
    this.entries.clear();
    this.customCooldowns.clear();
  }
}
