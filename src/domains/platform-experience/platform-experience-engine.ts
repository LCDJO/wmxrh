/**
 * PlatformExperienceEngine — Aggregate factory that wires all PXE sub-systems
 */

import type { PlatformExperienceEngineAPI } from './types';
import { createPlanRegistry } from './plan-registry';
import { createPlanLifecycleManager } from './plan-lifecycle-manager';
import { createTenantPlanResolver } from './tenant-plan-resolver';
import { createPaymentPolicyEngine } from './payment-policy-engine';
import { createModuleAccessResolver } from './module-access-resolver';
import { createExperienceOrchestrator } from './experience-orchestrator';

export function createPlatformExperienceEngine(): PlatformExperienceEngineAPI {
  const plans = createPlanRegistry();
  const lifecycle = createPlanLifecycleManager();
  const tenantPlan = createTenantPlanResolver(plans, lifecycle);
  const payment = createPaymentPolicyEngine(tenantPlan, plans);
  const moduleAccess = createModuleAccessResolver(tenantPlan, plans);
  const experience = createExperienceOrchestrator(tenantPlan, moduleAccess);

  return {
    plans,
    lifecycle,
    tenantPlan,
    payment,
    moduleAccess,
    experience,
  };
}
