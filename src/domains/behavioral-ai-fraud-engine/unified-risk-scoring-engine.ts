/**
 * UnifiedRiskScoringEngine — Aggregates 5 risk pillars into a single
 * registration decision.
 *
 * Pillars & default weights:
 *   biometric_score   25%  — facial recognition match
 *   liveness_score    20%  — anti-spoofing liveness detection
 *   device_score      15%  — device fingerprint trust
 *   geo_score         15%  — geolocation conformity
 *   behavior_score    25%  — behavioral biometrics (this engine)
 *
 * Decision thresholds:
 *   ≥75  → block registration
 *   ≥50  → require manager approval
 *   ≥30  → require extra validation (challenge)
 *   <30  → allow
 */

import type {
  AnomalyType,
  UnifiedRiskInput,
  UnifiedRiskAssessment,
  UnifiedRiskLevel,
  UnifiedRecommendedAction,
  UnifiedRiskFactor,
} from './types';

const DEFAULT_WEIGHTS: UnifiedRiskInput = {
  biometric_score: 0.25,
  liveness_score: 0.20,
  device_score: 0.15,
  geo_score: 0.15,
  behavior_score: 0.25,
};

const PILLAR_LABELS: Record<keyof UnifiedRiskInput, string> = {
  biometric_score: 'Reconhecimento biométrico facial',
  liveness_score: 'Detecção de vivacidade (anti-spoofing)',
  device_score: 'Confiança do dispositivo',
  geo_score: 'Conformidade geográfica',
  behavior_score: 'Biometria comportamental',
};

// Thresholds
const BLOCK_THRESHOLD = 75;
const MANAGER_THRESHOLD = 50;
const CHALLENGE_THRESHOLD = 30;

export class UnifiedRiskScoringEngine {
  private weights: UnifiedRiskInput;

  constructor(customWeights?: Partial<UnifiedRiskInput>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...customWeights };

    // Normalize weights to sum to 1.0
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    if (sum > 0 && Math.abs(sum - 1) > 0.001) {
      for (const key of Object.keys(this.weights) as (keyof UnifiedRiskInput)[]) {
        this.weights[key] /= sum;
      }
    }
  }

  /**
   * Compute unified risk from all 5 pillars.
   * Scores are RISK scores: 0 = safe, 100 = maximum risk.
   */
  assess(
    input: UnifiedRiskInput,
    anomalyContext?: { count: number; types: AnomalyType[] },
  ): UnifiedRiskAssessment {
    const factors: UnifiedRiskFactor[] = [];
    let weightedSum = 0;

    for (const pillar of Object.keys(this.weights) as (keyof UnifiedRiskInput)[]) {
      const score = Math.max(0, Math.min(100, input[pillar]));
      const weight = this.weights[pillar];
      const contribution = score * weight;

      weightedSum += contribution;

      factors.push({
        pillar,
        score,
        weight,
        weighted_contribution: Math.round(contribution * 100) / 100,
        description: PILLAR_LABELS[pillar],
      });
    }

    // Apply critical boost: if any pillar ≥ 90, floor overall at 50
    const hasCriticalPillar = factors.some(f => f.score >= 90);
    let overall_score = Math.round(weightedSum);
    if (hasCriticalPillar && overall_score < 50) {
      overall_score = 50;
    }
    overall_score = Math.min(100, overall_score);

    // Determine level + action
    const risk_level: UnifiedRiskLevel =
      overall_score >= BLOCK_THRESHOLD ? 'critical'
        : overall_score >= MANAGER_THRESHOLD ? 'high'
          : overall_score >= CHALLENGE_THRESHOLD ? 'medium'
            : 'low';

    const registration_blocked = overall_score >= BLOCK_THRESHOLD;
    const requires_manager_approval = overall_score >= MANAGER_THRESHOLD && !registration_blocked;
    const requires_extra_validation = overall_score >= CHALLENGE_THRESHOLD && !requires_manager_approval && !registration_blocked;

    const recommended_action: UnifiedRecommendedAction =
      registration_blocked ? 'block'
        : requires_manager_approval ? 'require_manager_approval'
          : requires_extra_validation ? 'challenge'
            : factors.some(f => f.score >= 40) ? 'flag'
              : 'allow';

    return {
      overall_score,
      risk_level,
      recommended_action,
      pillar_scores: { ...input },
      pillar_weights: { ...this.weights },
      contributing_factors: factors.sort((a, b) => b.weighted_contribution - a.weighted_contribution),
      requires_extra_validation,
      requires_manager_approval,
      registration_blocked,
      anomaly_count: anomalyContext?.count ?? 0,
      anomaly_types: anomalyContext?.types ?? [],
      assessed_at: new Date().toISOString(),
    };
  }

  /**
   * Convert individual confidence scores (0-1 where 1=trusted) to
   * risk scores (0-100 where 100=risky) for input into assess().
   */
  static confidenceToRisk(confidence: number): number {
    return Math.round((1 - Math.max(0, Math.min(1, confidence))) * 100);
  }
}
