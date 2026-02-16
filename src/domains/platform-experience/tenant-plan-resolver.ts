/**
 * TenantPlanResolver — Resolve o snapshot de plano efetivo de um tenant
 */

import type {
  TenantPlanResolverAPI,
  TenantPlanSnapshot,
  PlanRegistryAPI,
  PlanLifecycleManagerAPI,
} from './types';
import type { ModuleKey } from '@/domains/platform/platform-modules';

export function createTenantPlanResolver(
  planRegistry: PlanRegistryAPI,
  lifecycleManager: PlanLifecycleManagerAPI
): TenantPlanResolverAPI {
  // In-memory tenant → planId mapping (would be DB-backed in production)
  const tenantPlans = new Map<string, { planId: string; addons: string[]; billing_cycle: 'monthly' | 'quarterly' | 'annual' | 'custom' }>();

  function getSnapshot(tenantId: string): TenantPlanSnapshot {
    const binding = tenantPlans.get(tenantId);
    const planId = binding?.planId ?? 'free';
    const plan = planRegistry.get(planId);
    const status = lifecycleManager.currentStatus(tenantId);

    const activeModules = plan?.included_modules ?? [];
    const addonModules = binding?.addons ?? [];
    const effectiveFeatures = plan?.enabled_features ?? [];

    return {
      tenant_id: tenantId,
      plan_id: planId,
      plan_tier: plan?.tier ?? 'free',
      status,
      active_modules: activeModules,
      addon_modules: addonModules,
      effective_features: effectiveFeatures,
      usage: {
        current_users: 0,
        max_users: plan?.max_users ?? null,
        current_companies: 0,
        max_companies: plan?.max_companies ?? null,
        current_employees: 0,
        max_employees: plan?.max_employees ?? null,
        storage_used_mb: 0,
        storage_quota_mb: plan?.storage_quota_mb ?? null,
      },
      trial_ends_at: null,
      billing_cycle: binding?.billing_cycle ?? 'monthly',
      next_billing_at: null,
      resolved_at: Date.now(),
    };
  }

  return {
    resolve: getSnapshot,

    isModuleAccessible(tenantId, moduleKey: ModuleKey | string) {
      const snap = getSnapshot(tenantId);
      if (snap.status === 'suspended' || snap.status === 'cancelled') return false;
      return snap.active_modules.includes(moduleKey) || snap.addon_modules.includes(moduleKey);
    },

    isFeatureAccessible(tenantId, featureKey) {
      const snap = getSnapshot(tenantId);
      if (snap.status === 'suspended' || snap.status === 'cancelled') return false;
      return snap.effective_features.includes(featureKey);
    },

    isWithinLimits(tenantId) {
      const snap = getSnapshot(tenantId);
      const violations: string[] = [];
      const u = snap.usage;
      if (u.max_users !== null && u.current_users > u.max_users) violations.push('max_users');
      if (u.max_companies !== null && u.current_companies > u.max_companies) violations.push('max_companies');
      if (u.max_employees !== null && u.current_employees > u.max_employees) violations.push('max_employees');
      if (u.storage_quota_mb !== null && u.storage_used_mb > u.storage_quota_mb) violations.push('storage_quota');
      return { within: violations.length === 0, violations };
    },

    getEffectiveModules(tenantId) {
      const snap = getSnapshot(tenantId);
      return [...new Set([...snap.active_modules, ...snap.addon_modules])];
    },
  };
}
