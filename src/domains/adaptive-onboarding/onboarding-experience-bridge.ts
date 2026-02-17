/**
 * OnboardingAwareExperienceOrchestrator
 *
 * Wraps the base ExperienceOrchestrator to add onboarding-awareness:
 *
 *   1. Modules whose setup step is NOT completed → hidden from navigation
 *   2. Features gated by onboarding steps → unlocked as steps complete
 *   3. Widgets gated by onboarding progress → resolved only when step is done
 *
 * CONTRACT:
 *   This decorator does NOT modify the underlying ExperienceOrchestrator.
 *   It reads onboarding progress and applies additional filtering.
 *
 * ┌──────────────────────┐     ┌──────────────────────┐
 * │  ExperienceOrchestrator │──▶│  OnboardingAware      │
 * │  (plan-based gating)   │    │  (progress-based)     │
 * └──────────────────────┘     └──────────────────────┘
 */

import type {
  ExperienceOrchestratorAPI,
  ExperienceProfile,
  UpgradePrompt,
} from '@/domains/platform-experience/types';
import type {
  OnboardingProgressTrackerAPI,
  OnboardingProgress,
  OnboardingStep,
} from '@/domains/adaptive-onboarding/types';

// ── Step → Module mapping ───────────────────────────────────────
// Maps onboarding step IDs to the modules they unlock

const STEP_UNLOCKS_MODULE: Record<string, string[]> = {
  create_company: ['companies'],
  setup_departments: ['departments'],
  setup_company_groups: ['company_groups'],
  configure_roles_basic: ['positions'],
  configure_roles: ['positions', 'iam'],
  configure_advanced_iam: ['iam'],
  activate_modules: [], // meta-step — doesn't unlock a specific module
  activate_analytics: ['intelligence', 'workforce_intelligence'],
  activate_esocial: ['esocial'],
  invite_users: [], // no module gating
  compliance_check: ['compliance'],
  configure_health_programs: ['health'],
  add_employees: ['employees'],
};

// ── Step → Feature flag mapping ─────────────────────────────────
// Maps onboarding steps to feature flags that unlock when the step completes

const STEP_UNLOCKS_FEATURE: Record<string, string[]> = {
  create_company: ['ui:company_dashboard', 'ui:company_selector'],
  setup_departments: ['ui:department_tree', 'ui:department_budget'],
  configure_roles: ['ui:role_matrix', 'ui:permission_editor'],
  configure_advanced_iam: ['ui:impersonation', 'ui:access_graph'],
  activate_modules: ['ui:module_marketplace'],
  activate_analytics: ['ui:workforce_dashboard', 'ui:strategic_kpis'],
  activate_esocial: ['ui:esocial_panel', 'ui:esocial_events'],
  compliance_check: ['ui:compliance_alerts', 'ui:compliance_dashboard'],
  configure_health_programs: ['ui:health_exams', 'ui:pcmso_panel'],
  add_employees: ['ui:employee_list', 'ui:employee_profile'],
  invite_users: ['ui:team_management'],
};

// ── Step → Navigation paths ─────────────────────────────────────
// Maps modules to their navigation paths (for hiding)

const MODULE_NAVIGATION: Record<string, string[]> = {
  companies: ['/companies'],
  departments: ['/departments'],
  positions: ['/positions'],
  employees: ['/employees', '/employee'],
  compensation: ['/compensation'],
  benefits: ['/benefits'],
  compliance: ['/compliance'],
  health: ['/health'],
  esocial: ['/esocial'],
  intelligence: ['/workforce-intelligence', '/strategic-intelligence'],
  audit: ['/audit'],
  iam: ['/iam'],
  company_groups: ['/company-groups'],
};

// ── Step → Widget gating ────────────────────────────────────────

const STEP_UNLOCKS_WIDGET: Record<string, string[]> = {
  create_company: ['widget:company_overview'],
  add_employees: ['widget:headcount_kpi', 'widget:recent_hires'],
  configure_roles: ['widget:active_users'],
  compliance_check: ['widget:compliance_status'],
  activate_analytics: ['widget:kpi_strip', 'widget:quick_reports'],
  activate_esocial: ['widget:esocial_status'],
};

// ── Types ────────────────────────────────────────────────────────

export interface OnboardingGateResult {
  /** Module/path/feature is accessible */
  accessible: boolean;
  /** If not accessible, the step that must be completed */
  blocked_by_step?: string;
  /** Human-readable message */
  message?: string;
}

export interface OnboardingAwareExperienceAPI extends ExperienceOrchestratorAPI {
  /** Check if a module is unlocked by onboarding progress */
  isModuleUnlockedByOnboarding(tenantId: string, moduleKey: string): OnboardingGateResult;
  /** Check if a feature is unlocked by onboarding progress */
  isFeatureUnlockedByOnboarding(tenantId: string, featureKey: string): OnboardingGateResult;
  /** Get all widgets unlocked by current onboarding state */
  getOnboardingUnlockedWidgets(tenantId: string): string[];
  /** Get modules still locked behind incomplete onboarding steps */
  getLockedModules(tenantId: string): Array<{ moduleKey: string; blockedByStep: string; stepTitle: string }>;
  /** Get completion status for the integration */
  getOnboardingIntegrationStatus(tenantId: string): {
    onboarding_complete: boolean;
    unlocked_modules: string[];
    locked_modules: string[];
    unlocked_features: string[];
    locked_features: string[];
  };
}

// ── Factory ─────────────────────────────────────────────────────

export function createOnboardingAwareExperience(
  base: ExperienceOrchestratorAPI,
  progressTracker: OnboardingProgressTrackerAPI,
): OnboardingAwareExperienceAPI {

  function getProgress(tenantId: string): OnboardingProgress | null {
    return progressTracker.getProgress(tenantId);
  }

  function isStepCompleted(tenantId: string, stepId: string): boolean {
    const progress = getProgress(tenantId);
    if (!progress) return false;
    return progress.completed_steps.includes(stepId) ||
           progress.skipped_steps.includes(stepId);
  }

  function getCompletedSteps(tenantId: string): string[] {
    const progress = getProgress(tenantId);
    if (!progress) return [];
    return [...progress.completed_steps, ...progress.skipped_steps];
  }

  function findBlockingStep(tenantId: string, mapping: Record<string, string[]>, target: string): string | null {
    const completed = getCompletedSteps(tenantId);
    for (const [stepId, unlocked] of Object.entries(mapping)) {
      if (unlocked.includes(target) && !completed.includes(stepId)) {
        return stepId;
      }
    }
    return null;
  }

  function getStepTitle(tenantId: string, stepId: string): string {
    const progress = getProgress(tenantId);
    if (!progress) return stepId;
    const step = progress.flow.steps.find(s => s.id === stepId);
    return step?.title ?? stepId;
  }

  // ── Module gating ──

  function isModuleUnlockedByOnboarding(tenantId: string, moduleKey: string): OnboardingGateResult {
    const progress = getProgress(tenantId);
    // If no onboarding in progress, everything is accessible (already onboarded)
    if (!progress) return { accessible: true };
    // If onboarding is complete, everything unlocked
    if (progress.flow.completion_pct >= 100) return { accessible: true };

    const blockingStep = findBlockingStep(tenantId, STEP_UNLOCKS_MODULE, moduleKey);
    if (blockingStep) {
      return {
        accessible: false,
        blocked_by_step: blockingStep,
        message: `Complete "${getStepTitle(tenantId, blockingStep)}" para acessar este módulo.`,
      };
    }
    return { accessible: true };
  }

  // ── Feature gating ──

  function isFeatureUnlockedByOnboarding(tenantId: string, featureKey: string): OnboardingGateResult {
    const progress = getProgress(tenantId);
    if (!progress || progress.flow.completion_pct >= 100) return { accessible: true };

    const blockingStep = findBlockingStep(tenantId, STEP_UNLOCKS_FEATURE, featureKey);
    if (blockingStep) {
      return {
        accessible: false,
        blocked_by_step: blockingStep,
        message: `Complete "${getStepTitle(tenantId, blockingStep)}" para desbloquear esta funcionalidade.`,
      };
    }
    return { accessible: true };
  }

  // ── Widget gating ──

  function getOnboardingUnlockedWidgets(tenantId: string): string[] {
    const completed = getCompletedSteps(tenantId);
    const unlocked: string[] = [];

    for (const [stepId, widgets] of Object.entries(STEP_UNLOCKS_WIDGET)) {
      if (completed.includes(stepId)) {
        unlocked.push(...widgets);
      }
    }
    return unlocked;
  }

  // ── Locked modules list ──

  function getLockedModules(tenantId: string): Array<{ moduleKey: string; blockedByStep: string; stepTitle: string }> {
    const progress = getProgress(tenantId);
    if (!progress || progress.flow.completion_pct >= 100) return [];

    const allModules = new Set<string>();
    for (const modules of Object.values(STEP_UNLOCKS_MODULE)) {
      modules.forEach(m => allModules.add(m));
    }

    const locked: Array<{ moduleKey: string; blockedByStep: string; stepTitle: string }> = [];
    for (const moduleKey of allModules) {
      const result = isModuleUnlockedByOnboarding(tenantId, moduleKey);
      if (!result.accessible && result.blocked_by_step) {
        locked.push({
          moduleKey,
          blockedByStep: result.blocked_by_step,
          stepTitle: getStepTitle(tenantId, result.blocked_by_step),
        });
      }
    }
    return locked;
  }

  // ── Integration status ──

  function getOnboardingIntegrationStatus(tenantId: string) {
    const completed = getCompletedSteps(tenantId);
    const progress = getProgress(tenantId);
    const isComplete = !progress || progress.flow.completion_pct >= 100;

    const unlockedModules: string[] = [];
    const lockedModules: string[] = [];
    const unlockedFeatures: string[] = [];
    const lockedFeatures: string[] = [];

    for (const [stepId, modules] of Object.entries(STEP_UNLOCKS_MODULE)) {
      for (const mod of modules) {
        if (completed.includes(stepId) || isComplete) {
          unlockedModules.push(mod);
        } else {
          lockedModules.push(mod);
        }
      }
    }

    for (const [stepId, features] of Object.entries(STEP_UNLOCKS_FEATURE)) {
      for (const feat of features) {
        if (completed.includes(stepId) || isComplete) {
          unlockedFeatures.push(feat);
        } else {
          lockedFeatures.push(feat);
        }
      }
    }

    return {
      onboarding_complete: isComplete,
      unlocked_modules: [...new Set(unlockedModules)],
      locked_modules: [...new Set(lockedModules)],
      unlocked_features: [...new Set(unlockedFeatures)],
      locked_features: [...new Set(lockedFeatures)],
    };
  }

  // ── Decorated ExperienceOrchestratorAPI ──
  // Wraps base methods to apply onboarding gating on top of plan gating

  function resolveProfile(tenantId: string): ExperienceProfile {
    const baseProfile = base.resolveProfile(tenantId);
    const progress = getProgress(tenantId);

    // If no onboarding or completed, return base profile unchanged
    if (!progress || progress.flow.completion_pct >= 100) return baseProfile;

    // Filter visible navigation: remove paths for unconfigured modules
    const filteredVisible = baseProfile.visible_navigation.filter(path => {
      for (const [moduleKey, paths] of Object.entries(MODULE_NAVIGATION)) {
        if (paths.some(p => path.startsWith(p))) {
          return isModuleUnlockedByOnboarding(tenantId, moduleKey).accessible;
        }
      }
      return true; // Non-module paths are always visible
    });

    // Move onboarding-blocked paths from visible to hidden
    const onboardingHidden = baseProfile.visible_navigation.filter(
      path => !filteredVisible.includes(path),
    );

    // Filter UI features by onboarding progress
    const filteredFeatures: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(baseProfile.ui_features)) {
      if (value) {
        const gate = isFeatureUnlockedByOnboarding(tenantId, key);
        filteredFeatures[key] = gate.accessible;
      } else {
        filteredFeatures[key] = false;
      }
    }

    // Filter widgets
    const unlockedWidgets = getOnboardingUnlockedWidgets(tenantId);
    const filteredWidgets = baseProfile.available_widgets.filter(w =>
      unlockedWidgets.includes(w),
    );

    return {
      ...baseProfile,
      visible_navigation: filteredVisible,
      hidden_navigation: [...baseProfile.hidden_navigation, ...onboardingHidden],
      available_widgets: filteredWidgets,
      ui_features: filteredFeatures,
    };
  }

  return {
    // ── Decorated base methods ──
    resolveProfile,

    isNavigationVisible(tenantId, path) {
      // First check plan-level
      if (!base.isNavigationVisible(tenantId, path)) return false;
      // Then check onboarding-level
      for (const [moduleKey, paths] of Object.entries(MODULE_NAVIGATION)) {
        if (paths.some(p => path.startsWith(p))) {
          return isModuleUnlockedByOnboarding(tenantId, moduleKey).accessible;
        }
      }
      return true;
    },

    isNavigationLocked(tenantId, path) {
      return base.isNavigationLocked(tenantId, path);
    },

    getUpgradePromptForPath(tenantId, path) {
      return base.getUpgradePromptForPath(tenantId, path);
    },

    getAvailableWidgets(tenantId) {
      const baseWidgets = base.getAvailableWidgets(tenantId);
      const unlockedWidgets = getOnboardingUnlockedWidgets(tenantId);
      const progress = getProgress(tenantId);

      if (!progress || progress.flow.completion_pct >= 100) return baseWidgets;
      return baseWidgets.filter(w => unlockedWidgets.includes(w));
    },

    getUIFeature(tenantId, featureKey) {
      if (!base.getUIFeature(tenantId, featureKey)) return false;
      return isFeatureUnlockedByOnboarding(tenantId, featureKey).accessible;
    },

    // ── Onboarding-specific methods ──
    isModuleUnlockedByOnboarding,
    isFeatureUnlockedByOnboarding,
    getOnboardingUnlockedWidgets,
    getLockedModules,
    getOnboardingIntegrationStatus,
  };
}
