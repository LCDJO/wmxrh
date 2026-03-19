/**
 * useAdaptiveOnboarding — React hook for the Adaptive Onboarding Engine.
 *
 * Provides flow resolution, progress tracking, and experience hints
 * for the current tenant's onboarding journey.
 */

import { useState, useCallback, useMemo } from 'react';
import { createAdaptiveOnboardingEngine } from '@/domains/adaptive-onboarding';
import { initializeProgress } from '@/domains/adaptive-onboarding/onboarding-progress-tracker';
import type {
  AdaptiveOnboardingEngineAPI,
  OnboardingFlow,
  OnboardingProgress,
  OnboardingStep,
  OnboardingHint,
  TenantSetupConfig,
  RoleBootstrapPlan,
  ModuleSetupOption,
  FlowResolverContext,
} from '@/domains/adaptive-onboarding/types';
import type { PlanTier } from '@/domains/platform-experience/types';

let engineInstance: AdaptiveOnboardingEngineAPI | null = null;

function getEngine(): AdaptiveOnboardingEngineAPI {
  if (!engineInstance) {
    engineInstance = createAdaptiveOnboardingEngine();
  }
  return engineInstance;
}

interface UseAdaptiveOnboardingOptions {
  tenantId: string;
  planTier: PlanTier;
  allowedModules?: string[];
  userRole?: string;
  config?: TenantSetupConfig;
}

export function useAdaptiveOnboarding({ tenantId, planTier, allowedModules, userRole, config }: UseAdaptiveOnboardingOptions) {
  const engine = getEngine();

  const [flow, setFlow] = useState<OnboardingFlow>(() => {
    const ctx: FlowResolverContext = { planTier, allowedModules, userRole, config };
    return engine.flowResolver.resolveFlow(tenantId, ctx);
  });

  const [progress, setProgress] = useState<OnboardingProgress>(() => {
    return initializeProgress(tenantId, flow);
  });

  const currentStep = useMemo(() => {
    return flow.steps.find(s => s.id === progress.current_step_id) ?? null;
  }, [flow, progress.current_step_id]);

  const nextStep = useMemo(() => {
    return engine.flowResolver.getNextStep(flow);
  }, [flow, engine]);

  const hints = useMemo((): OnboardingHint[] => {
    if (!currentStep) return [];
    return engine.experienceHints.getHintsForStep(currentStep.id, planTier);
  }, [currentStep, planTier, engine]);

  const suggestedRoles = useMemo((): RoleBootstrapPlan => {
    return engine.roleBootstrapper.suggestRoles(planTier);
  }, [planTier, engine]);

  const availableModules = useMemo((): ModuleSetupOption[] => {
    return engine.moduleWizard.getAvailableModules(planTier);
  }, [planTier, engine]);

  const recommendedModules = useMemo((): ModuleSetupOption[] => {
    return engine.moduleWizard.getRecommendedModules(planTier);
  }, [planTier, engine]);

  const completeStep = useCallback((stepId: string) => {
    engine.progressTracker.markStepCompleted(tenantId, stepId);
    const updated = engine.progressTracker.getProgress(tenantId);
    if (updated) {
      setProgress({ ...updated });
      setFlow({ ...updated.flow });

      // Auto-advance to next step
      const next = engine.flowResolver.getNextStep(updated.flow);
      if (next) {
        engine.progressTracker.setCurrentStep(tenantId, next.id);
        setProgress(prev => ({ ...prev, current_step_id: next.id }));
      }
    }
  }, [tenantId, engine]);

  const skipStep = useCallback((stepId: string) => {
    engine.progressTracker.markStepSkipped(tenantId, stepId);
    const updated = engine.progressTracker.getProgress(tenantId);
    if (updated) {
      setProgress({ ...updated });
      setFlow({ ...updated.flow });

      const next = engine.flowResolver.getNextStep(updated.flow);
      if (next) {
        engine.progressTracker.setCurrentStep(tenantId, next.id);
        setProgress(prev => ({ ...prev, current_step_id: next.id }));
      }
    }
  }, [tenantId, engine]);

  const goToStep = useCallback((stepId: string) => {
    engine.progressTracker.setCurrentStep(tenantId, stepId);
    setProgress(prev => ({ ...prev, current_step_id: stepId }));
  }, [tenantId, engine]);

  const dismissHint = useCallback((hintId: string) => {
    engine.experienceHints.dismissHint(hintId);
  }, [engine]);

  return {
    flow,
    progress,
    currentStep,
    nextStep,
    hints,
    suggestedRoles,
    availableModules,
    recommendedModules,
    completeStep,
    skipStep,
    goToStep,
    dismissHint,
    isCompleted: flow.completion_pct >= 100,
    completionPct: flow.completion_pct,
  };
}
