/**
 * AdaptiveLearningModule — Feedback loop for fraud pattern tuning.
 *
 * When a manager APPROVES a flagged registration:
 *   1. Re-ingest the session's feature vector into the profile baseline (EMA)
 *   2. Reduce tolerance threshold temporarily (wider acceptance)
 *   3. Update pattern FP/TP rates via Bayesian nudge
 *
 * When a manager CONFIRMS fraud:
 *   1. Tighten tolerance threshold
 *   2. Update pattern TP rates
 */

import type {
  LearningFeedback, ModelPerformanceMetrics,
  BehavioralFeatureVector,
} from './types';
import { FraudPatternDatabase } from './fraud-pattern-database';
import { BehaviorProfileManager } from './behavior-profile-manager';

/** Extended feedback including the feature vector that was flagged */
export interface ManagerApprovalFeedback extends LearningFeedback {
  tenant_id: string;
  employee_id: string;
  /** The feature vector from the flagged session — used to recalibrate baseline */
  session_features?: BehavioralFeatureVector;
}

// How much to relax tolerance after a false positive
const FP_TOLERANCE_BUMP = 0.3;
// How much to tighten tolerance after confirmed fraud
const TP_TOLERANCE_TIGHTEN = 0.2;
// Max tolerance relaxation from baseline
const MAX_TOLERANCE_BUMP = 1.5;

export class AdaptiveLearningModule {
  private feedbackLog: LearningFeedback[] = [];
  private incidentOutcomes = new Map<string, boolean>();

  constructor(
    private patternDB: FraudPatternDatabase,
    private profileManager?: BehaviorProfileManager,
  ) {}

  /**
   * Submit human feedback for a fraud incident.
   * Basic path — no baseline adjustment.
   */
  submitFeedback(feedback: LearningFeedback): void {
    this.feedbackLog.push(feedback);
    this.incidentOutcomes.set(feedback.incident_id, feedback.was_fraud);
    this.updatePatternRates();
  }

  /**
   * Manager approved a flagged registration → adjust baseline + reduce FP.
   *
   * This is the key adaptive learning entry point:
   *   - Re-ingests the flagged vector into the EMA baseline so the profile
   *     "learns" that this behavior is normal for the employee.
   *   - Temporarily relaxes the tolerance threshold to prevent repeat flags.
   */
  processManagerApproval(feedback: ManagerApprovalFeedback): void {
    this.feedbackLog.push(feedback);
    this.incidentOutcomes.set(feedback.incident_id, feedback.was_fraud);

    if (!feedback.was_fraud && this.profileManager) {
      // ── False positive: recalibrate baseline ──────────────────
      const profile = this.profileManager.getProfile(feedback.tenant_id, feedback.employee_id);

      if (profile && feedback.session_features) {
        // Re-ingest the approved vector so EMA absorbs it as "normal"
        this.profileManager.updateProfile(
          feedback.tenant_id,
          feedback.employee_id,
          feedback.session_features,
        );

        // Relax tolerance to reduce future FP for this employee
        const baselineTolerance = profile.tolerance_threshold;
        profile.tolerance_threshold = Math.min(
          baselineTolerance + FP_TOLERANCE_BUMP,
          baselineTolerance + MAX_TOLERANCE_BUMP,
        );
      }
    } else if (feedback.was_fraud && this.profileManager) {
      // ── Confirmed fraud: tighten tolerance ────────────────────
      const profile = this.profileManager.getProfile(feedback.tenant_id, feedback.employee_id);
      if (profile) {
        profile.tolerance_threshold = Math.max(
          1.5, // absolute minimum
          profile.tolerance_threshold - TP_TOLERANCE_TIGHTEN,
        );
      }
    }

    this.updatePatternRates();
  }

  /**
   * Compute overall model performance metrics.
   */
  getPerformanceMetrics(): ModelPerformanceMetrics {
    const outcomes = [...this.incidentOutcomes.values()];
    if (outcomes.length === 0) {
      return {
        precision: 0, recall: 0, f1_score: 0,
        false_positive_rate: 0, true_positive_rate: 0,
        total_predictions: 0, total_confirmed_fraud: 0,
        evaluated_at: new Date().toISOString(),
      };
    }

    const tp = outcomes.filter(Boolean).length;
    const fp = outcomes.filter(o => !o).length;
    const total = outcomes.length;

    const precision = total > 0 ? tp / total : 0;
    const recall = tp > 0 ? 1 : 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    return {
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      f1_score: Math.round(f1 * 1000) / 1000,
      false_positive_rate: Math.round((fp / total) * 1000) / 1000,
      true_positive_rate: Math.round((tp / total) * 1000) / 1000,
      total_predictions: total,
      total_confirmed_fraud: tp,
      evaluated_at: new Date().toISOString(),
    };
  }

  /**
   * Recalculate pattern-level FP/TP rates from feedback (Bayesian nudge).
   */
  private updatePatternRates(): void {
    const patterns = this.patternDB.getPatterns();
    const metrics = this.getPerformanceMetrics();
    const alpha = 0.1;

    for (const pattern of patterns) {
      pattern.false_positive_rate = pattern.false_positive_rate * (1 - alpha) + metrics.false_positive_rate * alpha;
      pattern.true_positive_rate = pattern.true_positive_rate * (1 - alpha) + metrics.true_positive_rate * alpha;
    }
  }

  get feedbackCount(): number {
    return this.feedbackLog.length;
  }

  get confirmedFraudCount(): number {
    return [...this.incidentOutcomes.values()].filter(Boolean).length;
  }

  get falsePositiveCount(): number {
    return [...this.incidentOutcomes.values()].filter(o => !o).length;
  }
}
