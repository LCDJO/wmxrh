/**
 * ExperimentSafetyGuard — Blocks automatic rollback when active A/B experiments are running.
 *
 * Rules:
 *  - If LP has active A/B test → block automatic rollback
 *  - Manual rollback during A/B requires approval from PlatformMarketingDirector
 *  - Prevents data contamination by ensuring no uncontrolled version swap during experiments
 */
import { abTestingManager } from '../autonomous-marketing/ab-testing-manager';
import type { ExperimentId } from '../autonomous-marketing/types';

/** Roles authorized to approve rollback during active experiments */
const EXPERIMENT_OVERRIDE_ROLES = ['PlatformMarketingDirector', 'PlatformSuperAdmin'] as const;
type ExperimentOverrideRole = (typeof EXPERIMENT_OVERRIDE_ROLES)[number];

export interface SafetyCheckResult {
  /** Whether automatic rollback is allowed */
  safe: boolean;
  /** Human-readable reason if blocked */
  reason?: string;
  /** Blocking experiment ID */
  experimentId?: string;
  /** Whether manual override is possible (with director approval) */
  requiresDirectorApproval: boolean;
  /** Roles that can authorize override */
  authorizedRoles: readonly string[];
}

export interface OverrideApproval {
  approvedBy: string;
  role: ExperimentOverrideRole;
  experimentId: string;
  landingPageId: string;
  approvedAt: string;
  reason: string;
}

class ExperimentSafetyGuard {
  /** Active experiment IDs registered per landing page */
  private pageExperiments = new Map<string, Set<ExperimentId>>();
  /** Override approvals granted by directors */
  private overrideApprovals: OverrideApproval[] = [];

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
   *
   * If an experiment IS active:
   *  - Automatic rollback is BLOCKED (safe: false)
   *  - Manual rollback requires PlatformMarketingDirector approval
   */
  isSafe(landingPageId: string): SafetyCheckResult {
    const defaultSafe: SafetyCheckResult = {
      safe: true,
      requiresDirectorApproval: false,
      authorizedRoles: [],
    };

    try {
      const experimentIds = this.pageExperiments.get(landingPageId);
      if (!experimentIds || experimentIds.size === 0) return defaultSafe;

      // Verify each registered experiment is actually still running
      for (const expId of experimentIds) {
        try {
          const exp = abTestingManager.getExperiment(expId);
          if (exp.status === 'running') {
            // Check if a director override exists for this experiment
            const hasOverride = this.hasValidOverride(landingPageId, expId);

            if (hasOverride) {
              // Director approved — allow manual rollback
              return defaultSafe;
            }

            return {
              safe: false,
              reason:
                `Experimento A/B ativo "${exp.name}" (${exp.id}) bloqueia rollback automático. ` +
                `Rollback manual requer aprovação de PlatformMarketingDirector ou PlatformSuperAdmin.`,
              experimentId: exp.id,
              requiresDirectorApproval: true,
              authorizedRoles: EXPERIMENT_OVERRIDE_ROLES,
            };
          }
        } catch {
          // Experiment not found — clean up stale reference
          experimentIds.delete(expId);
        }
      }

      return defaultSafe;
    } catch {
      // Fail-open for recovery
      return defaultSafe;
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

  /**
   * Grant director override to allow manual rollback despite active experiment.
   * Only PlatformMarketingDirector and PlatformSuperAdmin can approve.
   */
  grantOverride(
    landingPageId: string,
    experimentId: string,
    approvedBy: string,
    role: string,
    reason: string,
  ): OverrideApproval | null {
    if (!EXPERIMENT_OVERRIDE_ROLES.includes(role as ExperimentOverrideRole)) {
      console.warn(
        `[ExperimentSafetyGuard] Override denied: role "${role}" is not authorized. ` +
        `Required: ${EXPERIMENT_OVERRIDE_ROLES.join(' or ')}.`,
      );
      return null;
    }

    const approval: OverrideApproval = {
      approvedBy,
      role: role as ExperimentOverrideRole,
      experimentId,
      landingPageId,
      approvedAt: new Date().toISOString(),
      reason,
    };

    this.overrideApprovals.push(approval);

    console.info(
      `[ExperimentSafetyGuard] Override GRANTED by ${approvedBy} (${role}) ` +
      `for LP ${landingPageId} / experiment ${experimentId}: "${reason}"`,
    );

    return approval;
  }

  /**
   * Revoke a previously granted override.
   */
  revokeOverride(landingPageId: string, experimentId: string): boolean {
    const before = this.overrideApprovals.length;
    this.overrideApprovals = this.overrideApprovals.filter(
      o => !(o.landingPageId === landingPageId && o.experimentId === experimentId),
    );
    return this.overrideApprovals.length < before;
  }

  /**
   * Get all override approvals for a landing page.
   */
  getOverrides(landingPageId: string): OverrideApproval[] {
    return this.overrideApprovals.filter(o => o.landingPageId === landingPageId);
  }

  /**
   * Check if a valid override exists for a specific experiment on a landing page.
   */
  private hasValidOverride(landingPageId: string, experimentId: string): boolean {
    return this.overrideApprovals.some(
      o => o.landingPageId === landingPageId && o.experimentId === experimentId,
    );
  }
}

export const experimentSafetyGuard = new ExperimentSafetyGuard();
export { ExperimentSafetyGuard };
