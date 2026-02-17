/**
 * ModulePlanSyncService — Sync modules automatically when plan changes
 *
 * When a tenant's plan changes (activate, upgrade, downgrade, suspend, cancel, reactivate):
 *   1. Resolve the new plan's included_modules
 *   2. Enable modules included in the new plan
 *   3. Disable modules NOT included in the new plan (unless they're addons)
 */

import type { ModuleOrchestratorAPI } from '@/domains/platform-os/types';
import type { PlanRegistryAPI, TenantPlanResolverAPI } from '@/domains/platform-experience/types';

export interface ModulePlanSyncAPI {
  /** Sync tenant modules to match their current plan */
  syncModulesForPlan(tenantId: string, planId: string): void;
  /** Deactivate all modules for tenant (suspend/cancel) */
  deactivateAllModules(tenantId: string): void;
}

export function createModulePlanSyncService(
  modules: ModuleOrchestratorAPI,
  planRegistry: PlanRegistryAPI,
): ModulePlanSyncAPI {

  return {
    syncModulesForPlan(tenantId: string, planId: string) {
      const plan = planRegistry.get(planId);
      if (!plan) return;

      const planModules = new Set([
        ...plan.included_modules,
        ...plan.addon_modules,
      ]);

      // 1. Enable modules that should be active
      for (const moduleKey of plan.included_modules) {
        if (!modules.isEnabledForTenant(String(moduleKey), tenantId)) {
          modules.enableForTenant(String(moduleKey), tenantId);
        }
      }

      // 2. Disable modules not in the plan
      const currentModules = modules.listForTenant(tenantId);
      for (const mod of currentModules) {
        if (!planModules.has(mod.key)) {
          modules.disableForTenant(mod.key, tenantId);
        }
      }
    },

    deactivateAllModules(tenantId: string) {
      const currentModules = modules.listForTenant(tenantId);
      for (const mod of currentModules) {
        modules.disableForTenant(mod.key, tenantId);
      }
    },
  };
}
