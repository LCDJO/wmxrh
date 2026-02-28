/**
 * ModuleAccessResolver — Resolve acesso a módulos com base no plano do tenant
 */

import type {
  ModuleAccessResolverAPI,
  ModuleAccessResult,
  TenantPlanResolverAPI,
  PlanRegistryAPI,
  UpgradePrompt,
  PlanTier,
} from './types';
import type { ModuleKey } from '@/domains/platform/platform-modules';

const TIER_ORDER: PlanTier[] = ['free', 'starter', 'professional', 'enterprise', 'custom'];

export function createModuleAccessResolver(
  tenantPlanResolver: TenantPlanResolverAPI,
  planRegistry: PlanRegistryAPI
): ModuleAccessResolverAPI {
  function findMinimumPlanForModule(moduleKey: ModuleKey | string): PlanTier | undefined {
    for (const plan of planRegistry.list().sort((a, b) => a.display_order - b.display_order)) {
      if (plan.included_modules.includes(moduleKey)) return plan.tier;
    }
    return undefined;
  }

  return {
    check(tenantId, moduleKey) {
      const snap = tenantPlanResolver.resolve(tenantId);

      if (snap.status === 'suspended') {
        return { module_key: moduleKey, accessible: false, reason: 'denied_suspended', access_mode: 'blocked' };
      }

      if (snap.active_modules.includes(moduleKey)) {
        return { module_key: moduleKey, accessible: true, reason: snap.status === 'trial' ? 'trial' : 'plan_included' };
      }

      if (snap.addon_modules.includes(moduleKey)) {
        return { module_key: moduleKey, accessible: true, reason: 'addon' };
      }

      const requiredPlan = findMinimumPlanForModule(moduleKey);
      return {
        module_key: moduleKey,
        accessible: false,
        reason: 'denied_plan',
        required_plan: requiredPlan,
      };
    },

    checkAll(tenantId) {
      const allModules = new Set<string>();
      for (const plan of planRegistry.list()) {
        plan.included_modules.forEach(m => allModules.add(m));
        plan.addon_modules.forEach(m => allModules.add(m));
      }
      return [...allModules].map(m => this.check(tenantId, m));
    },

    getAccessibleModules(tenantId) {
      return this.checkAll(tenantId).filter(r => r.accessible).map(r => r.module_key);
    },

    getDeniedModules(tenantId) {
      return this.checkAll(tenantId).filter(r => !r.accessible);
    },

    getUpgradePrompt(tenantId, moduleKey): UpgradePrompt | null {
      const result = this.check(tenantId, moduleKey);
      if (result.accessible || !result.required_plan) return null;

      const snap = tenantPlanResolver.resolve(tenantId);
      const targetPlan = planRegistry.getByTier(result.required_plan);
      const currentPlan = planRegistry.get(snap.plan_id);

      const priceDiff = (targetPlan?.pricing.monthly_brl ?? 0) - (currentPlan?.pricing.monthly_brl ?? 0);

      return {
        current_plan: snap.plan_tier,
        required_plan: result.required_plan,
        module_key: moduleKey,
        module_label: String(moduleKey),
        price_diff_brl: priceDiff,
        message: `Faça upgrade para o plano ${result.required_plan} para acessar este módulo.`,
      };
    },
  };
}
