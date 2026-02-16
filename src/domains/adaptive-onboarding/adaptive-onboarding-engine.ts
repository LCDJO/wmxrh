/**
 * AdaptiveOnboardingEngine — Aggregate factory wiring all sub-systems.
 */

import type { AdaptiveOnboardingEngineAPI } from './types';
import { createOnboardingFlowResolver } from './onboarding-flow-resolver';
import { createTenantSetupOrchestrator } from './tenant-setup-orchestrator';
import { createRoleBootstrapper } from './role-bootstrapper';
import { createModuleSetupWizard } from './module-setup-wizard';
import { createOnboardingProgressTracker } from './onboarding-progress-tracker';
import { createExperienceHintsService } from './experience-hints.service';

export function createAdaptiveOnboardingEngine(): AdaptiveOnboardingEngineAPI {
  return {
    flowResolver: createOnboardingFlowResolver(),
    tenantSetup: createTenantSetupOrchestrator(),
    roleBootstrapper: createRoleBootstrapper(),
    moduleWizard: createModuleSetupWizard(),
    progressTracker: createOnboardingProgressTracker(),
    experienceHints: createExperienceHintsService(),
  };
}
