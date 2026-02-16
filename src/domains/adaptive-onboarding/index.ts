/**
 * Adaptive Onboarding Engine — Barrel Export
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  AdaptiveOnboardingEngine                                       ║
 * ║   ├── OnboardingFlowResolver     ← Determina fluxo por plano   ║
 * ║   ├── TenantSetupOrchestrator    ← Configura tenant auto       ║
 * ║   ├── RoleBootstrapper           ← Cria roles iniciais         ║
 * ║   ├── ModuleSetupWizard          ← Ativa módulos do plano      ║
 * ║   ├── OnboardingProgressTracker  ← Rastreia progresso          ║
 * ║   └── ExperienceHintsService     ← Dicas cognitivas            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

export { createOnboardingFlowResolver } from './onboarding-flow-resolver';
export { createTenantSetupOrchestrator } from './tenant-setup-orchestrator';
export { createRoleBootstrapper } from './role-bootstrapper';
export { createModuleSetupWizard } from './module-setup-wizard';
export { createOnboardingProgressTracker, initializeProgress } from './onboarding-progress-tracker';
export { createExperienceHintsService } from './experience-hints.service';
export { createAdaptiveOnboardingEngine } from './adaptive-onboarding-engine';

export type {
  OnboardingPhase,
  StepStatus,
  OnboardingStep,
  OnboardingFlow,
  FlowResolverContext,
  TenantSetupConfig,
  TenantSetupResult,
  BootstrapRole,
  RoleBootstrapPlan,
  ModuleSetupOption,
  OnboardingProgress,
  OnboardingHint,
  AdaptiveOnboardingEngineAPI,
} from './types';
