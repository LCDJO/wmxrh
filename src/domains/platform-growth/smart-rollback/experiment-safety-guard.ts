/**
 * ExperimentSafetyGuard — Blocks rollback when active A/B experiments are running.
 *
 * Prevents data contamination by ensuring no automatic rollback
 * occurs while an experiment involving the target landing page is active.
 */
import { abTestingManager } from '../autonomous-marketing/ab-testing-manager';
import type { ExperimentId } from '../autonomous-marketing/types';

class ExperimentSafetyGuard {
  /** Active experiment IDs registered per landing page */
  private pageExperiments = new Map<string, Set<ExperimentId>>();

  /**
   * Register an experiment as active on a landing page (called by AB testing flows).
   */
  registerExperiment(landingPageId: string, experimentId: ExperimentId): void {
    const set = this.pageExperiments.get(landingPageId) ?? new Set();
    set.add(experimentId);
    this.pageExperiments.set(landingPageId, set);
  }

  /**
   * Unregister an experiment (called when experiment completes/cancels).
   */
  unregisterExperiment(landingPageId: string, experimentId: ExperimentId): void {
    this.pageExperiments.get(landingPageId)?.delete(experimentId);
  }

  /**
   * Check if a rollback is safe (no active experiments on this page).
   */
  isSafe(landingPageId: string): { safe: boolean; reason?: string; experimentId?: string } {
    try {
      const experimentIds = this.pageExperiments.get(landingPageId);
      if (!experimentIds || experimentIds.size === 0) return { safe: true };

      // Verify each registered experiment is actually still running
      for (const expId of experimentIds) {
        try {
          const exp = abTestingManager.getExperiment(expId);
          if (exp.status === 'running') {
            return {
              safe: false,
              reason: `Experimento ativo "${exp.name}" (${exp.id}) impede rollback automático. Finalize ou pause o experimento antes de prosseguir.`,
              experimentId: exp.id,
            };
          }
        } catch {
          // Experiment not found — clean up stale reference
          experimentIds.delete(expId);
        }
      }

      return { safe: true };
    } catch {
      // Fail-open for recovery
      return { safe: true };
    }
  }

  /**
   * Assert rollback is safe. Throws if an experiment is blocking.
   */
  assertSafe(landingPageId: string): void {
    const result = this.isSafe(landingPageId);
    if (!result.safe) {
      throw new Error(`[ExperimentSafetyGuard] ${result.reason}`);
    }
  }
}

export const experimentSafetyGuard = new ExperimentSafetyGuard();
export { ExperimentSafetyGuard };
