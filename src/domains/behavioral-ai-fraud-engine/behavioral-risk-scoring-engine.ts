/**
 * BehavioralRiskScoringEngine — Weighted risk aggregation for behavioral anomalies.
 *
 * Pillars (behavioral):
 *   timing        30%
 *   pressure      15%
 *   motion        15%
 *   navigation    10%
 *   bot_detection 15%
 *   replay        15%
 *
 * Merges with BiometricTrustLayer risk score when available.
 */

import type {
  AnomalyDetection, AnomalyType, AnomalySeverity,
  BehavioralRiskAssessment, BehavioralRiskFactor,
} from './types';

const TYPE_WEIGHTS: Record<string, number> = {
  timing_anomaly: 0.30,
  pressure_anomaly: 0.15,
  motion_anomaly: 0.15,
  navigation_anomaly: 0.10,
  bot_behavior_detected: 0.15,
  pattern_replay_detected: 0.15,
  device_switch_anomaly: 0.10,
  location_velocity_anomaly: 0.10,
  proxy_employee_suspected: 0.15,
};

const SEVERITY_MULTIPLIER: Record<AnomalySeverity, number> = {
  info: 0.1,
  low: 0.3,
  medium: 0.6,
  high: 0.85,
  critical: 1.0,
};

export class BehavioralRiskScoringEngine {

  assess(
    tenantId: string,
    employeeId: string,
    anomalies: AnomalyDetection[],
    biometricRiskScore?: number,
  ): BehavioralRiskAssessment {
    const factors: BehavioralRiskFactor[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    // Group anomalies by type, take worst per type
    const byType = new Map<AnomalyType, AnomalyDetection>();
    for (const a of anomalies) {
      const existing = byType.get(a.anomaly_type);
      if (!existing || a.deviation_score > existing.deviation_score) {
        byType.set(a.anomaly_type, a);
      }
    }

    for (const [type, anomaly] of byType) {
      const weight = TYPE_WEIGHTS[type] ?? 0.05;
      const severityMult = SEVERITY_MULTIPLIER[anomaly.severity];
      const score = Math.round(anomaly.confidence * severityMult * 100);

      factors.push({
        factor: type,
        weight,
        score,
        description: anomaly.description,
      });

      weightedSum += score * weight;
      totalWeight += weight;
    }

    // Normalize
    let overall_score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    // Merge with biometric risk if available (60% behavioral, 40% biometric)
    let combined_biometric_score: number | undefined;
    if (biometricRiskScore != null) {
      combined_biometric_score = Math.round(overall_score * 0.6 + biometricRiskScore * 0.4);
      overall_score = combined_biometric_score;
    }

    // Boost if critical anomalies present
    const hasCritical = anomalies.some(a => a.severity === 'critical');
    if (hasCritical && overall_score < 60) {
      overall_score = Math.max(overall_score, 60);
    }

    overall_score = Math.min(100, overall_score);

    const risk_level = overall_score >= 75 ? 'critical'
      : overall_score >= 50 ? 'high'
      : overall_score >= 25 ? 'medium'
      : 'low';

    const recommended_action = risk_level === 'critical' ? 'block'
      : risk_level === 'high' ? 'escalate'
      : risk_level === 'medium' ? 'challenge'
      : anomalies.length > 0 ? 'flag'
      : 'allow';

    return {
      overall_score,
      risk_level,
      anomaly_count: anomalies.length,
      anomaly_types: [...byType.keys()],
      recommended_action,
      contributing_factors: factors,
      combined_biometric_score,
      assessed_at: new Date().toISOString(),
    };
  }
}
