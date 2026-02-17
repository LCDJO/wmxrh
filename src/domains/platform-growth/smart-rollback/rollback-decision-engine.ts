/**
 * RollbackDecisionEngine — Evaluates whether a rollback should be triggered.
 *
 * Analyzes performance comparisons and decides:
 *  - automatic: if confidence is high and degradation severe → execute immediately
 *  - suggested: if degradation detected but confidence insufficient → suggest to operator
 *  - none: if metrics are within acceptable range
 */
import type {
  PerformanceComparison,
  RollbackDecision,
  RollbackMode,
  RollbackReason,
  RollbackThresholds,
} from './types';
import { DEFAULT_ROLLBACK_THRESHOLDS } from './types';

class RollbackDecisionEngine {
  private decisions: RollbackDecision[] = [];
  private lastRollbackTime = new Map<string, number>();

  /**
   * Evaluate a performance comparison and produce a rollback decision (or null if no action).
   */
  evaluate(
    comparison: PerformanceComparison,
    thresholds: RollbackThresholds = DEFAULT_ROLLBACK_THRESHOLDS,
  ): RollbackDecision | null {
    if (!comparison.isDegraded) return null;

    const pageId = comparison.currentVersion.landingPageId;

    // Check cooldown
    const lastRollback = this.lastRollbackTime.get(pageId) ?? 0;
    if (Date.now() - lastRollback < thresholds.cooldownMs) return null;

    // Determine primary reason
    const reason = this.determineReason(comparison, thresholds);

    // Determine mode based on confidence
    const mode: RollbackMode =
      comparison.confidence >= thresholds.autoRollbackConfidenceThreshold
        ? 'automatic'
        : 'suggested';

    const decision: RollbackDecision = {
      id: `rd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      landingPageId: pageId,
      currentVersionId: comparison.currentVersion.versionId,
      targetVersionId: comparison.previousVersion.versionId,
      currentVersionNumber: comparison.currentVersion.versionNumber,
      targetVersionNumber: comparison.previousVersion.versionNumber,
      reason,
      mode,
      comparison,
      decidedAt: new Date().toISOString(),
      approved: mode === 'automatic' ? true : null,
    };

    this.decisions.push(decision);
    return decision;
  }

  /**
   * Manually approve a pending (suggested) decision.
   */
  approve(decisionId: string, approvedBy: string): RollbackDecision | null {
    const decision = this.decisions.find(d => d.id === decisionId);
    if (!decision || decision.approved !== null) return null;
    decision.approved = true;
    decision.approvedBy = approvedBy;
    return decision;
  }

  /**
   * Cancel a pending decision.
   */
  cancel(decisionId: string): RollbackDecision | null {
    const decision = this.decisions.find(d => d.id === decisionId);
    if (!decision || decision.approved !== null) return null;
    decision.approved = false;
    return decision;
  }

  /**
   * Record that a rollback was executed (for cooldown tracking).
   */
  recordExecution(landingPageId: string): void {
    this.lastRollbackTime.set(landingPageId, Date.now());
  }

  /**
   * Get pending decisions for a landing page.
   */
  getPending(landingPageId?: string): RollbackDecision[] {
    return this.decisions.filter(
      d => d.approved === null && (!landingPageId || d.landingPageId === landingPageId),
    );
  }

  /**
   * Get full decision history.
   */
  getHistory(landingPageId?: string): RollbackDecision[] {
    if (!landingPageId) return [...this.decisions];
    return this.decisions.filter(d => d.landingPageId === landingPageId);
  }

  private determineReason(
    comparison: PerformanceComparison,
    thresholds: RollbackThresholds,
  ): RollbackReason {
    const reasons: RollbackReason[] = [];

    if (comparison.conversionRateDelta <= -thresholds.conversionDropThreshold) {
      reasons.push('conversion_drop');
    }
    if (comparison.revenueDelta <= -thresholds.revenueDropThreshold) {
      reasons.push('revenue_drop');
    }
    if (comparison.bounceRateDelta >= thresholds.bounceRateIncreaseThreshold) {
      reasons.push('bounce_spike');
    }

    return reasons.length > 1 ? 'combined_degradation' : reasons[0] ?? 'conversion_drop';
  }
}

export const rollbackDecisionEngine = new RollbackDecisionEngine();
export { RollbackDecisionEngine };
