/**
 * PlanRegistry — Catálogo imutável de planos SaaS
 */

import type { PlanDefinition, PlanRegistryAPI, PlanTier } from './types';
import type { ModuleKey } from '@/domains/platform/platform-modules';

export function createPlanRegistry(): PlanRegistryAPI {
  const plans = new Map<string, PlanDefinition>();

  return {
    register(plan) {
      plans.set(plan.id, { ...plan });
    },

    get(planId) {
      return plans.get(planId) ?? null;
    },

    getByTier(tier: PlanTier) {
      for (const p of plans.values()) {
        if (p.tier === tier) return p;
      }
      return null;
    },

    list() {
      return [...plans.values()];
    },

    listPublic() {
      return [...plans.values()].filter(p => p.is_public).sort((a, b) => a.display_order - b.display_order);
    },

    isModuleIncluded(planId: string, moduleKey: ModuleKey | string) {
      const plan = plans.get(planId);
      if (!plan) return false;
      return plan.included_modules.includes(moduleKey) || plan.addon_modules.includes(moduleKey);
    },

    isFeatureEnabled(planId: string, featureKey: string) {
      const plan = plans.get(planId);
      if (!plan) return false;
      return plan.enabled_features.includes(featureKey);
    },
  };
}
