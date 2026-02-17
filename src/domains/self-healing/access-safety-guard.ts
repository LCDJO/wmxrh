/**
 * AccessSafetyGuard — Temporarily blocks sensitive permissions when
 * critical incidents are detected in related modules.
 *
 * Integrated with the Security Kernel's permission pipeline via
 * GlobalEventKernel events. When a critical incident hits a module
 * tagged with sensitive actions, those actions are blocked until
 * the incident is resolved or the guard TTL expires.
 *
 * SAFETY: This guard only ADDS restrictions. It never grants access
 * and never touches tenant data.
 */

import type { GlobalEventKernelAPI } from '@/domains/platform-os/types';

// ── Configuration ───────────────────────────────────────────────

export interface SafetyBlockRule {
  /** Module ID pattern (exact match or '*' suffix for prefix) */
  module_pattern: string;
  /** Permissions to block when this module has a critical incident */
  blocked_permissions: string[];
  /** How long the block persists (ms). Auto-lifts after TTL. */
  ttl_ms: number;
}

interface ActiveBlock {
  rule: SafetyBlockRule;
  module_id: string;
  incident_id: string;
  blocked_at: number;
  expires_at: number;
  timer: ReturnType<typeof setTimeout>;
}

// ── Default rules ───────────────────────────────────────────────

const DEFAULT_RULES: SafetyBlockRule[] = [
  {
    module_pattern: 'billing*',
    blocked_permissions: ['billing.refund', 'plan.manage', 'billing.write_off'],
    ttl_ms: 10 * 60_000, // 10 min
  },
  {
    module_pattern: 'payroll*',
    blocked_permissions: ['payroll.execute', 'payroll.approve', 'payroll.reverse'],
    ttl_ms: 15 * 60_000,
  },
  {
    module_pattern: 'identity*',
    blocked_permissions: ['identity.impersonate', 'identity.role_assign', 'identity.mfa_disable'],
    ttl_ms: 5 * 60_000,
  },
];

// ── Guard ───────────────────────────────────────────────────────

export class AccessSafetyGuard {
  private rules: SafetyBlockRule[];
  private activeBlocks = new Map<string, ActiveBlock>();
  private disposers: Array<() => void> = [];

  constructor(
    private events: GlobalEventKernelAPI,
    customRules?: SafetyBlockRule[],
  ) {
    this.rules = customRules ?? [...DEFAULT_RULES];
  }

  /** Start listening for critical incidents */
  start(): void {
    // When an incident is detected with critical severity, evaluate blocking rules
    this.disposers.push(
      this.events.on('self_healing:incident_detected', (evt) => {
        const p = evt.payload as { id: string; severity: string; title: string };
        if (p.severity === 'critical') {
          this.onCriticalIncident(p.id, p.title);
        }
      }),
    );

    // When recovery completes successfully, lift blocks early
    this.disposers.push(
      this.events.on('self_healing:recovery_completed', (evt) => {
        const p = evt.payload as { incident_id: string; status: string };
        if (p.status === 'recovered') {
          this.liftBlocksForIncident(p.incident_id);
        }
      }),
    );
  }

  stop(): void {
    this.disposers.forEach(fn => fn());
    this.disposers = [];
    // Clear all timers
    for (const block of this.activeBlocks.values()) {
      clearTimeout(block.timer);
    }
    this.activeBlocks.clear();
  }

  // ── Query API (used by Security Kernel pipeline) ──────────────

  /** Returns true if the given permission is currently blocked */
  isBlocked(permission: string): boolean {
    const now = Date.now();
    for (const block of this.activeBlocks.values()) {
      if (block.expires_at > now && block.rule.blocked_permissions.includes(permission)) {
        return true;
      }
    }
    return false;
  }

  /** Get all currently active blocks */
  getActiveBlocks(): Array<{
    module_id: string;
    incident_id: string;
    blocked_permissions: string[];
    blocked_at: number;
    expires_at: number;
  }> {
    const now = Date.now();
    return [...this.activeBlocks.values()]
      .filter(b => b.expires_at > now)
      .map(b => ({
        module_id: b.module_id,
        incident_id: b.incident_id,
        blocked_permissions: b.rule.blocked_permissions,
        blocked_at: b.blocked_at,
        expires_at: b.expires_at,
      }));
  }

  // ── Rule management ───────────────────────────────────────────

  addRule(rule: SafetyBlockRule): void {
    this.rules.push(rule);
  }

  listRules(): SafetyBlockRule[] {
    return [...this.rules];
  }

  // ── Private ───────────────────────────────────────────────────

  private onCriticalIncident(incidentId: string, title: string): void {
    // Extract module name from incident title (format: "... : {module}")
    const moduleId = this.extractModuleFromTitle(title);
    if (!moduleId) return;

    for (const rule of this.rules) {
      if (!this.matchesPattern(moduleId, rule.module_pattern)) continue;

      const blockKey = `${rule.module_pattern}:${incidentId}`;
      if (this.activeBlocks.has(blockKey)) continue;

      const now = Date.now();
      const block: ActiveBlock = {
        rule,
        module_id: moduleId,
        incident_id: incidentId,
        blocked_at: now,
        expires_at: now + rule.ttl_ms,
        timer: setTimeout(() => {
          this.activeBlocks.delete(blockKey);
          this.events.emit('self_healing:safety_block_expired', 'AccessSafetyGuard', {
            module_id: moduleId, incident_id: incidentId,
            permissions: rule.blocked_permissions,
          });
        }, rule.ttl_ms),
      };

      this.activeBlocks.set(blockKey, block);

      this.events.emit('self_healing:safety_block_engaged', 'AccessSafetyGuard', {
        module_id: moduleId,
        incident_id: incidentId,
        blocked_permissions: rule.blocked_permissions,
        ttl_ms: rule.ttl_ms,
      }, { priority: 'critical' });
    }
  }

  private liftBlocksForIncident(incidentId: string): void {
    for (const [key, block] of this.activeBlocks.entries()) {
      if (block.incident_id === incidentId) {
        clearTimeout(block.timer);
        this.activeBlocks.delete(key);
        this.events.emit('self_healing:safety_block_lifted', 'AccessSafetyGuard', {
          module_id: block.module_id, incident_id: incidentId,
          permissions: block.rule.blocked_permissions,
          reason: 'incident_recovered',
        });
      }
    }
  }

  private matchesPattern(moduleId: string, pattern: string): boolean {
    if (pattern.endsWith('*')) {
      return moduleId.startsWith(pattern.slice(0, -1));
    }
    return moduleId === pattern;
  }

  private extractModuleFromTitle(title: string): string | null {
    // Titles follow pattern "Label: module_id"
    const match = title.match(/:\s*(.+)$/);
    return match?.[1]?.trim() ?? null;
  }
}
