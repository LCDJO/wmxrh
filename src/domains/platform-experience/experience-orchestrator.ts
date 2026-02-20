/**
 * ExperienceOrchestrator — Adapta UI e navegação com base no plano do tenant
 */

import type {
  ExperienceOrchestratorAPI,
  ExperienceProfile,
  ModuleAccessResolverAPI,
  TenantPlanResolverAPI,
  UpgradePrompt,
} from './types';

export function createExperienceOrchestrator(
  tenantPlanResolver: TenantPlanResolverAPI,
  moduleAccessResolver: ModuleAccessResolverAPI
): ExperienceOrchestratorAPI {
  // Module → route path mapping (simplified; would be driven by ModuleOrchestrator in production)
  const MODULE_ROUTES: Record<string, string[]> = {
    employees: ['/employees', '/employee'],
    departments: ['/departments'],
    positions: ['/positions'],
    companies: ['/companies'],
    company_groups: ['/company-groups'],
    compensation: ['/compensation'],
    benefits: ['/benefits'],
    health: ['/health'],
    compliance: ['/compliance'],
    esocial: ['/esocial'],
    labor_rules: ['/labor-rules', '/labor-compliance', '/labor-dashboard'],
    agreements: ['/agreements'],
    payroll_simulation: ['/payroll-simulation'],
    workforce_intelligence: ['/workforce-intelligence', '/strategic-intelligence'],
    audit: ['/audit'],
    iam: ['/iam'],
    settings: ['/settings'],
  };

  function resolveProfile(tenantId: string): ExperienceProfile {
    const snap = tenantPlanResolver.resolve(tenantId);
    const allAccess = moduleAccessResolver.checkAll(tenantId);

    const visible: string[] = [];
    const hidden: string[] = [];
    const locked: { path: string; upgrade_prompt: UpgradePrompt }[] = [];

    for (const access of allAccess) {
      const routes = MODULE_ROUTES[access.module_key as string] ?? [];
      if (access.accessible) {
        visible.push(...routes);
      } else {
        const prompt = moduleAccessResolver.getUpgradePrompt(tenantId, access.module_key);
        if (prompt) {
          routes.forEach(path => locked.push({ path, upgrade_prompt: prompt }));
        } else {
          hidden.push(...routes);
        }
      }
    }

    return {
      tenant_id: tenantId,
      plan_tier: snap.plan_tier,
      visible_navigation: visible,
      hidden_navigation: hidden,
      locked_navigation: locked,
      available_widgets: snap.effective_features.filter(f => f.startsWith('widget:')),
      ui_features: snap.effective_features.reduce((acc, f) => {
        if (f.startsWith('ui:')) acc[f] = true;
        return acc;
      }, {} as Record<string, boolean>),
      resolved_at: Date.now(),
    };
  }

  return {
    resolveProfile,

    isNavigationVisible(tenantId, path) {
      const profile = resolveProfile(tenantId);
      return profile.visible_navigation.some(p => path.startsWith(p));
    },

    isNavigationLocked(tenantId, path) {
      const profile = resolveProfile(tenantId);
      return profile.locked_navigation.some(l => path.startsWith(l.path));
    },

    getUpgradePromptForPath(tenantId, path) {
      const profile = resolveProfile(tenantId);
      const entry = profile.locked_navigation.find(l => path.startsWith(l.path));
      return entry?.upgrade_prompt ?? null;
    },

    getAvailableWidgets(tenantId) {
      return resolveProfile(tenantId).available_widgets;
    },

    getUIFeature(tenantId, featureKey) {
      return resolveProfile(tenantId).ui_features[featureKey] ?? false;
    },
  };
}
