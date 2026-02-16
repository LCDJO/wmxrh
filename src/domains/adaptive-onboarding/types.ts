/**
 * Adaptive Onboarding Engine — Core Types
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
 *
 * SECURITY CONTRACT:
 *   All onboarding actions are SUGGESTIVE. The system proposes
 *   configurations, but the TenantAdmin MUST confirm each action.
 *   No data is written without explicit user approval.
 */

import type { PlanTier } from '@/domains/platform-experience/types';
import type { ModuleKey } from '@/domains/platform/platform-modules';

// ══════════════════════════════════════════════════════════════════
// Onboarding Flow
// ══════════════════════════════════════════════════════════════════

export type OnboardingPhase =
  | 'welcome'
  | 'company_setup'
  | 'role_setup'
  | 'module_activation'
  | 'team_invite'
  | 'compliance_check'
  | 'review'
  | 'completed';

export type StepStatus = 'pending' | 'active' | 'completed' | 'skipped';

export interface OnboardingStep {
  id: string;
  phase: OnboardingPhase;
  order: number;
  title: string;
  description: string;
  icon?: string;
  /** Whether this step is mandatory for the tenant's plan */
  is_mandatory: boolean;
  /** Estimated time in minutes */
  estimated_minutes: number;
  /** Route to navigate to for this step */
  route?: string;
  /** Dependencies — IDs of steps that must be completed first */
  depends_on: string[];
  /** Whether step is relevant for the tenant's plan tier */
  applies_to_tiers: PlanTier[];
  /** Modules that must be active for this step to appear */
  requires_modules?: string[];
  /** Roles that can see this step (empty = all) */
  allowed_roles?: string[];
  status: StepStatus;
}

export interface OnboardingFlow {
  tenant_id: string;
  plan_tier: PlanTier;
  steps: OnboardingStep[];
  current_phase: OnboardingPhase;
  completion_pct: number;
  estimated_total_minutes: number;
  started_at: number;
  completed_at: number | null;
}

// ══════════════════════════════════════════════════════════════════
// Tenant Setup
// ══════════════════════════════════════════════════════════════════

export interface TenantSetupConfig {
  tenant_name: string;
  document?: string;
  industry?: string;
  cnae?: string;
  employee_count_estimate?: number;
  primary_use_case?: 'hr_management' | 'payroll' | 'compliance' | 'full_suite';
}

export interface TenantSetupResult {
  tenant_id: string;
  company_created: boolean;
  departments_suggested: string[];
  compliance_requirements: string[];
}

// ══════════════════════════════════════════════════════════════════
// Role Bootstrapper
// ══════════════════════════════════════════════════════════════════

export interface BootstrapRole {
  name: string;
  slug: string;
  description: string;
  permissions: string[];
  is_recommended: boolean;
}

export interface RoleBootstrapPlan {
  plan_tier: PlanTier;
  roles: BootstrapRole[];
  reason: string;
}

// ══════════════════════════════════════════════════════════════════
// Module Setup
// ══════════════════════════════════════════════════════════════════

export interface ModuleSetupOption {
  module_key: ModuleKey | string;
  label: string;
  description: string;
  included_in_plan: boolean;
  recommended: boolean;
  requires_setup: boolean;
  setup_steps?: string[];
}

// ══════════════════════════════════════════════════════════════════
// Progress Tracking
// ══════════════════════════════════════════════════════════════════

export interface OnboardingProgress {
  tenant_id: string;
  flow: OnboardingFlow;
  completed_steps: string[];
  skipped_steps: string[];
  current_step_id: string | null;
  last_activity_at: number;
}

// ══════════════════════════════════════════════════════════════════
// Experience Hints
// ══════════════════════════════════════════════════════════════════

export interface OnboardingHint {
  id: string;
  step_id: string;
  title: string;
  description: string;
  type: 'tip' | 'warning' | 'recommendation' | 'compliance';
  priority: number;
  dismissed: boolean;
}

// ══════════════════════════════════════════════════════════════════
// Engine API
// ══════════════════════════════════════════════════════════════════

export interface FlowResolverContext {
  planTier: PlanTier;
  allowedModules?: string[];
  userRole?: string;
  config?: TenantSetupConfig;
}

export interface OnboardingFlowResolverAPI {
  resolveFlow(tenantId: string, ctx: FlowResolverContext): OnboardingFlow;
  getStepsForPhase(flow: OnboardingFlow, phase: OnboardingPhase): OnboardingStep[];
  getNextStep(flow: OnboardingFlow): OnboardingStep | null;
}

export interface TenantSetupOrchestratorAPI {
  suggestSetup(planTier: PlanTier, config: TenantSetupConfig): TenantSetupResult;
}

export interface RoleBootstrapperAPI {
  suggestRoles(planTier: PlanTier): RoleBootstrapPlan;
}

export interface ModuleSetupWizardAPI {
  getAvailableModules(planTier: PlanTier): ModuleSetupOption[];
  getRecommendedModules(planTier: PlanTier): ModuleSetupOption[];
}

export interface OnboardingProgressTrackerAPI {
  getProgress(tenantId: string): OnboardingProgress | null;
  markStepCompleted(tenantId: string, stepId: string): void;
  markStepSkipped(tenantId: string, stepId: string): void;
  setCurrentStep(tenantId: string, stepId: string): void;
  reset(tenantId: string): void;
}

export interface ExperienceHintsServiceAPI {
  getHintsForStep(stepId: string, planTier: PlanTier): OnboardingHint[];
  dismissHint(hintId: string): void;
}

export interface AdaptiveOnboardingEngineAPI {
  flowResolver: OnboardingFlowResolverAPI;
  tenantSetup: TenantSetupOrchestratorAPI;
  roleBootstrapper: RoleBootstrapperAPI;
  moduleWizard: ModuleSetupWizardAPI;
  progressTracker: OnboardingProgressTrackerAPI;
  experienceHints: ExperienceHintsServiceAPI;
}
