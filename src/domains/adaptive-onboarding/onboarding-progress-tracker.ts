/**
 * OnboardingProgressTracker — In-memory progress tracker.
 * Future: backed by tenant_onboarding_progress table.
 */

import type { OnboardingProgressTrackerAPI, OnboardingProgress, OnboardingFlow } from './types';

const progressStore = new Map<string, OnboardingProgress>();

export function createOnboardingProgressTracker(): OnboardingProgressTrackerAPI {
  return {
    getProgress(tenantId: string): OnboardingProgress | null {
      return progressStore.get(tenantId) ?? null;
    },

    markStepCompleted(tenantId: string, stepId: string): void {
      const progress = progressStore.get(tenantId);
      if (!progress) return;

      if (!progress.completed_steps.includes(stepId)) {
        progress.completed_steps.push(stepId);
      }

      const step = progress.flow.steps.find(s => s.id === stepId);
      if (step) step.status = 'completed';

      const total = progress.flow.steps.length;
      const done = progress.completed_steps.length + progress.skipped_steps.length;
      progress.flow.completion_pct = Math.round((done / total) * 100);
      progress.last_activity_at = Date.now();

      if (progress.flow.completion_pct >= 100) {
        progress.flow.completed_at = Date.now();
        progress.flow.current_phase = 'completed';
      }
    },

    markStepSkipped(tenantId: string, stepId: string): void {
      const progress = progressStore.get(tenantId);
      if (!progress) return;

      if (!progress.skipped_steps.includes(stepId)) {
        progress.skipped_steps.push(stepId);
      }

      const step = progress.flow.steps.find(s => s.id === stepId);
      if (step) step.status = 'skipped';

      const total = progress.flow.steps.length;
      const done = progress.completed_steps.length + progress.skipped_steps.length;
      progress.flow.completion_pct = Math.round((done / total) * 100);
      progress.last_activity_at = Date.now();
    },

    setCurrentStep(tenantId: string, stepId: string): void {
      const progress = progressStore.get(tenantId);
      if (!progress) return;

      progress.current_step_id = stepId;
      const step = progress.flow.steps.find(s => s.id === stepId);
      if (step) {
        step.status = 'active';
        progress.flow.current_phase = step.phase;
      }
    },

    reset(tenantId: string): void {
      progressStore.delete(tenantId);
    },
  };
}

/** Initialize progress from a resolved flow */
export function initializeProgress(tenantId: string, flow: OnboardingFlow): OnboardingProgress {
  const progress: OnboardingProgress = {
    tenant_id: tenantId,
    flow,
    completed_steps: [],
    skipped_steps: [],
    current_step_id: flow.steps[0]?.id ?? null,
    last_activity_at: Date.now(),
  };

  if (flow.steps[0]) {
    flow.steps[0].status = 'active';
  }

  progressStore.set(tenantId, progress);
  return progress;
}
