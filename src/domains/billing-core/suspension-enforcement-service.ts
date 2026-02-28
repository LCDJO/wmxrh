/**
 * SuspensionEnforcementService
 *
 * Enforces automatic suspension when a tenant's grace period expires:
 *   1. Blocks access to ALL paid modules
 *   2. Optionally maintains read-only access for configured modules
 *   3. Emits suspension events for downstream reactors
 *
 * Read-only policy: tenants can configure which modules retain read-only
 * access during suspension (e.g., reports, dashboards for data export).
 */

import type { ModulePlanSyncAPI } from './module-plan-sync-service';
import type { PlanLifecycleManagerAPI, PlanRegistryAPI, PlanStatus } from '@/domains/platform-experience/types';
import { emitBillingEvent } from './billing-events';

// ── Types ────────────────────────────────────────────────────

export type SuspensionReason =
  | 'grace_period_expired'
  | 'manual'
  | 'fraud_detected'
  | 'terms_violation';

export type ModuleAccessMode = 'full' | 'read_only' | 'blocked';

export interface SuspensionPolicy {
  /** Modules that retain read-only access during suspension */
  read_only_modules: string[];
  /** Whether to allow data export during suspension */
  allow_data_export: boolean;
  /** Maximum days a tenant can remain suspended before forced cancellation */
  max_suspension_days: number;
  /** Notify tenant N days before forced cancellation */
  cancellation_warning_days: number;
}

export interface SuspensionState {
  tenant_id: string;
  is_suspended: boolean;
  reason: SuspensionReason | null;
  suspended_at: number | null;
  grace_period_expired_at: number | null;
  /** Per-module access mode during suspension */
  module_access: Record<string, ModuleAccessMode>;
  /** Estimated forced cancellation date (if applicable) */
  forced_cancellation_at: number | null;
  days_suspended: number;
}

export interface SuspensionEligibility {
  eligible: boolean;
  reason: string;
  tenant_status: PlanStatus;
  grace_period_ends_at: number | null;
  grace_period_expired: boolean;
  days_overdue: number;
}

export interface SuspensionEnforcementAPI {
  /** Check if a tenant is eligible for automatic suspension */
  checkSuspensionEligibility(tenantId: string, gracePeriodEndsAt: string | null): SuspensionEligibility;

  /** Execute suspension: block paid modules, keep read-only where configured */
  enforceSuspension(tenantId: string, reason: SuspensionReason, policy?: Partial<SuspensionPolicy>): SuspensionState;

  /** Get current suspension state for a tenant */
  getSuspensionState(tenantId: string): SuspensionState;

  /** Resolve module access mode for a suspended tenant */
  getModuleAccessMode(tenantId: string, moduleKey: string): ModuleAccessMode;

  /** Lift suspension (on payment or manual reactivation) */
  liftSuspension(tenantId: string): void;

  /** Get the default suspension policy */
  getDefaultPolicy(): SuspensionPolicy;

  /** Override policy for a specific tenant */
  setTenantPolicy(tenantId: string, policy: Partial<SuspensionPolicy>): void;

  /** Check if forced cancellation is due */
  checkForcedCancellation(tenantId: string): { shouldCancel: boolean; daysSuspended: number; maxDays: number };
}

// ── Default policy ───────────────────────────────────────────

const DEFAULT_SUSPENSION_POLICY: SuspensionPolicy = {
  read_only_modules: [
    'audit',          // Always allow audit log viewing
    'settings',       // Allow settings access for payment updates
  ],
  allow_data_export: true,
  max_suspension_days: 90,
  cancellation_warning_days: 15,
};

// ── Free modules that are never blocked ──────────────────────

const ALWAYS_ACCESSIBLE_MODULES = new Set([
  'settings',  // Needed for payment method updates
]);

// ── Factory ──────────────────────────────────────────────────

export function createSuspensionEnforcementService(
  planLifecycle: PlanLifecycleManagerAPI,
  planRegistry: PlanRegistryAPI,
  modulePlanSync?: ModulePlanSyncAPI,
): SuspensionEnforcementAPI {
  const suspensionStates = new Map<string, SuspensionState>();
  const tenantPolicies = new Map<string, SuspensionPolicy>();

  function getPolicy(tenantId: string): SuspensionPolicy {
    return tenantPolicies.get(tenantId) ?? { ...DEFAULT_SUSPENSION_POLICY };
  }

  function buildModuleAccessMap(
    tenantId: string,
    policy: SuspensionPolicy,
  ): Record<string, ModuleAccessMode> {
    const accessMap: Record<string, ModuleAccessMode> = {};

    // Get all modules from all plans to build complete map
    for (const plan of planRegistry.list()) {
      for (const mod of plan.included_modules) {
        const key = String(mod);

        if (ALWAYS_ACCESSIBLE_MODULES.has(key)) {
          accessMap[key] = 'read_only';
        } else if (policy.read_only_modules.includes(key)) {
          accessMap[key] = 'read_only';
        } else {
          accessMap[key] = 'blocked';
        }
      }
    }

    return accessMap;
  }

  return {
    checkSuspensionEligibility(tenantId, gracePeriodEndsAt) {
      const status = planLifecycle.currentStatus(tenantId);
      const now = Date.now();

      if (status === 'suspended') {
        return {
          eligible: false,
          reason: 'Tenant já está suspenso',
          tenant_status: status,
          grace_period_ends_at: gracePeriodEndsAt ? new Date(gracePeriodEndsAt).getTime() : null,
          grace_period_expired: true,
          days_overdue: 0,
        };
      }

      if (status !== 'past_due') {
        return {
          eligible: false,
          reason: `Status "${status}" não é elegível para suspensão automática`,
          tenant_status: status,
          grace_period_ends_at: null,
          grace_period_expired: false,
          days_overdue: 0,
        };
      }

      if (!gracePeriodEndsAt) {
        return {
          eligible: true,
          reason: 'Grace period não configurado — suspensão imediata',
          tenant_status: status,
          grace_period_ends_at: null,
          grace_period_expired: true,
          days_overdue: 0,
        };
      }

      const graceEnd = new Date(gracePeriodEndsAt).getTime();
      const expired = now >= graceEnd;
      const daysOverdue = expired ? Math.floor((now - graceEnd) / 86400000) : 0;

      return {
        eligible: expired,
        reason: expired
          ? `Grace period expirou há ${daysOverdue} dia(s)`
          : `Grace period ativo até ${new Date(graceEnd).toLocaleDateString('pt-BR')}`,
        tenant_status: status,
        grace_period_ends_at: graceEnd,
        grace_period_expired: expired,
        days_overdue: daysOverdue,
      };
    },

    enforceSuspension(tenantId, reason, policyOverrides?) {
      const policy = {
        ...getPolicy(tenantId),
        ...policyOverrides,
      };

      // 1. Transition lifecycle to suspended
      const canTransition = planLifecycle.canTransition(tenantId, 'suspend');
      if (canTransition.allowed) {
        planLifecycle.transition(tenantId, 'suspend', 'current', `Auto-suspension: ${reason}`);
      }

      // 2. Build per-module access map
      const moduleAccess = buildModuleAccessMap(tenantId, policy);

      // 3. Deactivate blocked modules via sync service
      if (modulePlanSync) {
        // Deactivate all first, then the sync layer will respect read_only via getModuleAccessMode
        modulePlanSync.deactivateAllModules(tenantId);
      }

      const now = Date.now();
      const state: SuspensionState = {
        tenant_id: tenantId,
        is_suspended: true,
        reason,
        suspended_at: now,
        grace_period_expired_at: now,
        module_access: moduleAccess,
        forced_cancellation_at: now + policy.max_suspension_days * 86400000,
        days_suspended: 0,
      };

      suspensionStates.set(tenantId, state);

      // 4. Emit events
      emitBillingEvent({
        type: 'TenantSuspended',
        timestamp: now,
        tenant_id: tenantId,
        reason,
        read_only_modules: policy.read_only_modules,
        forced_cancellation_at: state.forced_cancellation_at,
      });

      return state;
    },

    getSuspensionState(tenantId) {
      const existing = suspensionStates.get(tenantId);
      if (existing) {
        // Recalculate days_suspended
        return {
          ...existing,
          days_suspended: existing.suspended_at
            ? Math.floor((Date.now() - existing.suspended_at) / 86400000)
            : 0,
        };
      }

      return {
        tenant_id: tenantId,
        is_suspended: false,
        reason: null,
        suspended_at: null,
        grace_period_expired_at: null,
        module_access: {},
        forced_cancellation_at: null,
        days_suspended: 0,
      };
    },

    getModuleAccessMode(tenantId, moduleKey) {
      const state = suspensionStates.get(tenantId);
      if (!state?.is_suspended) return 'full';

      // Settings always accessible (read_only) so tenant can update payment
      if (ALWAYS_ACCESSIBLE_MODULES.has(moduleKey)) return 'read_only';

      return state.module_access[moduleKey] ?? 'blocked';
    },

    liftSuspension(tenantId) {
      const state = suspensionStates.get(tenantId);
      if (!state?.is_suspended) return;

      suspensionStates.delete(tenantId);

      emitBillingEvent({
        type: 'TenantReactivated',
        timestamp: Date.now(),
        tenant_id: tenantId,
        was_suspended_days: state.suspended_at
          ? Math.floor((Date.now() - state.suspended_at) / 86400000)
          : 0,
      });
    },

    getDefaultPolicy() {
      return { ...DEFAULT_SUSPENSION_POLICY };
    },

    setTenantPolicy(tenantId, policy) {
      const current = getPolicy(tenantId);
      tenantPolicies.set(tenantId, { ...current, ...policy });
    },

    checkForcedCancellation(tenantId) {
      const state = suspensionStates.get(tenantId);
      const policy = getPolicy(tenantId);

      if (!state?.is_suspended || !state.suspended_at) {
        return { shouldCancel: false, daysSuspended: 0, maxDays: policy.max_suspension_days };
      }

      const daysSuspended = Math.floor((Date.now() - state.suspended_at) / 86400000);

      return {
        shouldCancel: daysSuspended >= policy.max_suspension_days,
        daysSuspended,
        maxDays: policy.max_suspension_days,
      };
    },
  };
}
