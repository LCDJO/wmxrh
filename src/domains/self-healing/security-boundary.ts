/**
 * SelfHealingSecurityBoundary — Runtime guard for the Self-Healing layer.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SECURITY INVARIANT — IMMUTABLE RULE                            ║
 * ║                                                                  ║
 * ║  SelfHealingEngine / RecoveryOrchestrator MUST NEVER:            ║
 * ║   1. Alter user roles (user_roles, custom_roles)                 ║
 * ║   2. Alter permissions or RLS policies                           ║
 * ║   3. Alter tenant plans (saas_plans, experience_profiles)        ║
 * ║                                                                  ║
 * ║  Any attempt to exceed this boundary throws                      ║
 * ║  SelfHealingSecurityViolation — a non-catchable error.           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { RecoveryActionType } from './types';

// ── Allowed operations whitelist ───────────────────────────────

const ALLOWED_ACTIONS: ReadonlySet<RecoveryActionType> = new Set([
  'module_restart',
  'module_deactivate',
  'circuit_break',
  'cache_clear',
  'sandbox_reset',
  'access_graph_rebuild',
  'rate_limit_engage',
  'route_isolate',
  'widget_disable',
  'escalate',
]);

// ── Forbidden target patterns ──────────────────────────────────

const FORBIDDEN_TARGETS: ReadonlyArray<RegExp> = [
  /^(user_roles|custom_roles|role)/i,
  /^(permissions|rls_polic)/i,
  /^(saas_plans|experience_profiles|billing|subscription)/i,
];

// ── Error class ────────────────────────────────────────────────

export class SelfHealingSecurityViolation extends Error {
  readonly code = 'SELF_HEALING_SECURITY_VIOLATION' as const;

  constructor(action: string, target: string, reason: string) {
    super(
      `[SECURITY] SelfHealingEngine attempted forbidden operation: ` +
      `action="${action}" target="${target}" — ${reason}. ` +
      `Self-healing may ONLY operate on logical infrastructure.`,
    );
    this.name = 'SelfHealingSecurityViolation';
  }
}

// ── Guard function ─────────────────────────────────────────────

/**
 * Validates that a recovery action is within the allowed boundary.
 * MUST be called before every action execution.
 *
 * @throws SelfHealingSecurityViolation if the action is forbidden.
 */
export function assertAllowedAction(actionType: string, targetModule: string): void {
  // 1. Action type must be in whitelist
  if (!ALLOWED_ACTIONS.has(actionType as RecoveryActionType)) {
    throw new SelfHealingSecurityViolation(
      actionType,
      targetModule,
      `Action type "${actionType}" is not in the allowed whitelist`,
    );
  }

  // 2. Target must not match forbidden patterns
  for (const pattern of FORBIDDEN_TARGETS) {
    if (pattern.test(targetModule)) {
      throw new SelfHealingSecurityViolation(
        actionType,
        targetModule,
        `Target "${targetModule}" matches forbidden pattern ${pattern}`,
      );
    }
  }
}

/**
 * Check if an action would be allowed (non-throwing version).
 */
export function isAllowedAction(actionType: string, targetModule: string): boolean {
  try {
    assertAllowedAction(actionType, targetModule);
    return true;
  } catch {
    return false;
  }
}
