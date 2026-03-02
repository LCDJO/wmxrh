/**
 * RiskScoringEngine — Evaluates biometric verification risk
 * based on multiple contextual signals.
 *
 * Feeds into WorkTime anti-fraud and AccountEnforcement pipelines.
 */

import type { BiometricRiskAssessment, BiometricRiskFactor } from './types';

interface RiskContext {
  match_score: number;
  liveness_score: number;
  capture_quality?: number;
  is_offline?: boolean;
  is_new_device?: boolean;
  is_different_location?: boolean;
  hour_of_day?: number;
  failed_attempts_last_hour?: number;
  enrollment_age_days?: number;
  device_rooted?: boolean;
  vpn_active?: boolean;
}

export class RiskScoringEngine {
  assess(context: RiskContext): BiometricRiskAssessment {
    const factors: BiometricRiskFactor[] = [];

    // Match score
    if (context.match_score < 0.9) {
      const score = Math.round((1 - context.match_score) * 60);
      factors.push({ factor: 'low_match_score', weight: 0.3, score, description: `Match score baixo: ${(context.match_score * 100).toFixed(1)}%` });
    }

    // Liveness
    if (context.liveness_score < 0.8) {
      const score = Math.round((1 - context.liveness_score) * 50);
      factors.push({ factor: 'low_liveness', weight: 0.25, score, description: `Liveness score baixo: ${(context.liveness_score * 100).toFixed(1)}%` });
    }

    // Capture quality
    if (context.capture_quality != null && context.capture_quality < 0.6) {
      factors.push({ factor: 'poor_capture', weight: 0.1, score: 15, description: 'Qualidade da captura abaixo do ideal' });
    }

    // Offline sync
    if (context.is_offline) {
      factors.push({ factor: 'offline_capture', weight: 0.1, score: 20, description: 'Captura realizada em modo offline' });
    }

    // New device
    if (context.is_new_device) {
      factors.push({ factor: 'new_device', weight: 0.1, score: 15, description: 'Dispositivo não reconhecido' });
    }

    // Location anomaly
    if (context.is_different_location) {
      factors.push({ factor: 'location_anomaly', weight: 0.15, score: 25, description: 'Localização diferente do padrão' });
    }

    // Unusual hour
    if (context.hour_of_day != null && (context.hour_of_day < 5 || context.hour_of_day > 23)) {
      factors.push({ factor: 'unusual_hour', weight: 0.05, score: 10, description: `Horário incomum: ${context.hour_of_day}h` });
    }

    // Failed attempts
    if (context.failed_attempts_last_hour && context.failed_attempts_last_hour >= 3) {
      const score = Math.min(40, context.failed_attempts_last_hour * 10);
      factors.push({ factor: 'repeated_failures', weight: 0.2, score, description: `${context.failed_attempts_last_hour} tentativas falhadas na última hora` });
    }

    // Device integrity
    if (context.device_rooted) {
      factors.push({ factor: 'rooted_device', weight: 0.15, score: 30, description: 'Dispositivo com root/jailbreak detectado' });
    }

    if (context.vpn_active) {
      factors.push({ factor: 'vpn_detected', weight: 0.05, score: 10, description: 'VPN ativa detectada' });
    }

    // Old enrollment
    if (context.enrollment_age_days != null && context.enrollment_age_days > 365) {
      factors.push({ factor: 'old_enrollment', weight: 0.05, score: 10, description: 'Enrollment com mais de 1 ano' });
    }

    // Calculate overall weighted score
    const totalWeight = factors.reduce((s, f) => s + f.weight, 0) || 1;
    const overall_score = Math.min(100, Math.round(
      factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight
    ));

    const risk_level = overall_score >= 75 ? 'critical'
      : overall_score >= 50 ? 'high'
      : overall_score >= 25 ? 'medium'
      : 'low';

    const recommended_action = risk_level === 'critical' ? 'block'
      : risk_level === 'high' ? 'require_liveness'
      : risk_level === 'medium' ? 'flag'
      : 'allow';

    return { overall_score, risk_level, factors, recommended_action };
  }
}
