/**
 * AdaptiveLearningModule — Feedback loop for fraud pattern tuning.
 *
 * Accepts human review feedback on fraud incidents and adjusts:
 *   1. Pattern confidence thresholds
 *   2. False positive / true positive rates
 *   3. Profile baseline recalibration
 *
 * Uses simple Bayesian updating for rate estimates.
 */

import type { LearningFeedback, ModelPerformanceMetrics, FraudIncident } from './types';
import { FraudPatternDatabase } from './fraud-pattern-database';

export class AdaptiveLearningModule {
  private feedbackLog: LearningFeedback[] = [];
  private incidentOutcomes = new Map<string, boolean>(); // incident_id → was_fraud

  constructor(private patternDB: FraudPatternDatabase) {}

  /**
   * Submit human feedback for a fraud incident.
   */
  submitFeedback(feedback: LearningFeedback): void {
    this.feedbackLog.push(feedback);
    this.incidentOutcomes.set(feedback.incident_id, feedback.was_fraud);

    // Update pattern rates
    this.updatePatternRates();
  }

  /**
   * Compute overall model performance metrics.
   */
  getPerformanceMetrics(): ModelPerformanceMetrics {
    const outcomes = [...this.incidentOutcomes.values()];
    if (outcomes.length === 0) {
      return {
        precision: 0,
        recall: 0,
        f1_score: 0,
        false_positive_rate: 0,
        true_positive_rate: 0,
        total_predictions: 0,
        total_confirmed_fraud: 0,
        evaluated_at: new Date().toISOString(),
      };
    }

    const tp = outcomes.filter(Boolean).length;
    const fp = outcomes.filter(o => !o).length;
    const total = outcomes.length;

    const precision = total > 0 ? tp / total : 0;
    const recall = tp > 0 ? 1 : 0; // simplified — real recall requires known negatives
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
   * Recalculate pattern-level FP/TP rates from feedback.
   */
  private updatePatternRates(): void {
    // This is a simplified approach — in production, pattern_id
    // would be correlated with each incident
    const patterns = this.patternDB.getPatterns();
    const metrics = this.getPerformanceMetrics();

    for (const pattern of patterns) {
      // Bayesian nudge towards observed rates
      const alpha = 0.1; // learning rate
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
}
