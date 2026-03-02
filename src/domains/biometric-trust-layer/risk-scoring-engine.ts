/**
 * RiskScoringEngine — Multi-dimensional biometric risk assessment.
 *
 * Four scoring pillars:
 *  1. liveness_score      — Proof-of-life confidence
 *  2. face_match_score    — Template similarity
 *  3. device_integrity    — Root, VPN, mock location
 *  4. geolocation_score   — Location anomaly / geofence
 *
 * When risk is HIGH or CRITICAL → status = flagged + notify manager.
 */

import type { BiometricRiskAssessment, BiometricRiskFactor } from './types';
import { supabase } from '@/integrations/supabase/client';

// ── Context ────────────────────────────────────────────────────

export interface RiskContext {
  // Pillar 1: Liveness
  liveness_score: number;
  liveness_method?: string;

  // Pillar 2: Face match
  match_score: number;
  capture_quality?: number;

  // Pillar 3: Device integrity
  is_new_device?: boolean;
  device_rooted?: boolean;
  vpn_active?: boolean;
  is_mock_location?: boolean;

  // Pillar 4: Geolocation
  is_different_location?: boolean;
  is_offline?: boolean;
  geofence_distance_m?: number;

  // Behavioral context
  hour_of_day?: number;
  failed_attempts_last_hour?: number;
  enrollment_age_days?: number;
}

// ── Pillar weights (sum = 1.0) ─────────────────────────────────

const PILLAR_WEIGHTS = {
  liveness: 0.30,
  face_match: 0.35,
  device_integrity: 0.20,
  geolocation: 0.15,
} as const;

// ── Engine ─────────────────────────────────────────────────────

export class RiskScoringEngine {

  assess(context: RiskContext): BiometricRiskAssessment {
    const factors: BiometricRiskFactor[] = [];

    // ═══ Pillar 1: Liveness ═══════════════════════════════════
    const livenessRisk = this.scoreLiveness(context, factors);

    // ═══ Pillar 2: Face Match ═════════════════════════════════
    const matchRisk = this.scoreFaceMatch(context, factors);

    // ═══ Pillar 3: Device Integrity ═══════════════════════════
    const deviceRisk = this.scoreDeviceIntegrity(context, factors);

    // ═══ Pillar 4: Geolocation ════════════════════════════════
    const geoRisk = this.scoreGeolocation(context, factors);

    // ═══ Behavioral bonuses ═══════════════════════════════════
    this.scoreBehavioral(context, factors);

    // ═══ Weighted overall score ═══════════════════════════════
    const overall_score = Math.min(100, Math.round(
      livenessRisk * PILLAR_WEIGHTS.liveness +
      matchRisk * PILLAR_WEIGHTS.face_match +
      deviceRisk * PILLAR_WEIGHTS.device_integrity +
      geoRisk * PILLAR_WEIGHTS.geolocation +
      factors
        .filter(f => f.factor.startsWith('behavioral_'))
        .reduce((s, f) => s + f.score * f.weight, 0),
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

  // ── Pillar 1: Liveness ───────────────────────────────────────

  private scoreLiveness(ctx: RiskContext, factors: BiometricRiskFactor[]): number {
    if (ctx.liveness_score >= 0.9) return 0;

    const risk = Math.round((1 - ctx.liveness_score) * 100);

    if (ctx.liveness_score < 0.5) {
      factors.push({ factor: 'liveness_critical', weight: 0.30, score: risk, description: `Liveness crítico: ${(ctx.liveness_score * 100).toFixed(1)}%` });
    } else if (ctx.liveness_score < 0.75) {
      factors.push({ factor: 'liveness_low', weight: 0.25, score: risk, description: `Liveness baixo: ${(ctx.liveness_score * 100).toFixed(1)}%` });
    } else {
      factors.push({ factor: 'liveness_marginal', weight: 0.15, score: risk, description: `Liveness marginal: ${(ctx.liveness_score * 100).toFixed(1)}%` });
    }

    return risk;
  }

  // ── Pillar 2: Face Match ─────────────────────────────────────

  private scoreFaceMatch(ctx: RiskContext, factors: BiometricRiskFactor[]): number {
    let risk = 0;

    if (ctx.match_score < 0.7) {
      risk = 90;
      factors.push({ factor: 'match_critical', weight: 0.35, score: risk, description: `Match score muito baixo: ${(ctx.match_score * 100).toFixed(1)}%` });
    } else if (ctx.match_score < 0.85) {
      risk = Math.round((1 - ctx.match_score) * 100);
      factors.push({ factor: 'match_low', weight: 0.30, score: risk, description: `Match score baixo: ${(ctx.match_score * 100).toFixed(1)}%` });
    } else if (ctx.match_score < 0.9) {
      risk = Math.round((1 - ctx.match_score) * 60);
      factors.push({ factor: 'match_marginal', weight: 0.15, score: risk, description: `Match score marginal: ${(ctx.match_score * 100).toFixed(1)}%` });
    }

    if (ctx.capture_quality != null && ctx.capture_quality < 0.6) {
      const q = 20;
      risk = Math.max(risk, q);
      factors.push({ factor: 'poor_capture', weight: 0.10, score: q, description: 'Qualidade da captura abaixo do ideal' });
    }

    return risk;
  }

  // ── Pillar 3: Device Integrity ───────────────────────────────

  private scoreDeviceIntegrity(ctx: RiskContext, factors: BiometricRiskFactor[]): number {
    let risk = 0;

    if (ctx.device_rooted) {
      risk += 40;
      factors.push({ factor: 'device_rooted', weight: 0.20, score: 40, description: 'Dispositivo com root/jailbreak detectado' });
    }

    if (ctx.vpn_active) {
      risk += 15;
      factors.push({ factor: 'vpn_detected', weight: 0.05, score: 15, description: 'VPN ativa detectada' });
    }

    if (ctx.is_mock_location) {
      risk += 50;
      factors.push({ factor: 'mock_location', weight: 0.20, score: 50, description: 'Localização simulada (mock) detectada' });
    }

    if (ctx.is_new_device) {
      risk += 15;
      factors.push({ factor: 'new_device', weight: 0.10, score: 15, description: 'Dispositivo não reconhecido' });
    }

    return Math.min(100, risk);
  }

  // ── Pillar 4: Geolocation ────────────────────────────────────

  private scoreGeolocation(ctx: RiskContext, factors: BiometricRiskFactor[]): number {
    let risk = 0;

    if (ctx.is_different_location) {
      risk += 30;
      factors.push({ factor: 'location_anomaly', weight: 0.15, score: 30, description: 'Localização diferente do padrão' });
    }

    if (ctx.geofence_distance_m != null && ctx.geofence_distance_m > 500) {
      const geoScore = Math.min(60, Math.round(ctx.geofence_distance_m / 50));
      risk += geoScore;
      factors.push({ factor: 'geofence_violation', weight: 0.15, score: geoScore, description: `Fora do geofence: ${ctx.geofence_distance_m}m` });
    }

    if (ctx.is_offline) {
      risk += 20;
      factors.push({ factor: 'offline_capture', weight: 0.10, score: 20, description: 'Captura realizada em modo offline' });
    }

    return Math.min(100, risk);
  }

  // ── Behavioral (secondary signals) ──────────────────────────

  private scoreBehavioral(ctx: RiskContext, factors: BiometricRiskFactor[]): void {
    if (ctx.hour_of_day != null && (ctx.hour_of_day < 5 || ctx.hour_of_day > 23)) {
      factors.push({ factor: 'behavioral_unusual_hour', weight: 0.05, score: 10, description: `Horário incomum: ${ctx.hour_of_day}h` });
    }

    if (ctx.failed_attempts_last_hour && ctx.failed_attempts_last_hour >= 3) {
      const score = Math.min(40, ctx.failed_attempts_last_hour * 10);
      factors.push({ factor: 'behavioral_repeated_failures', weight: 0.10, score, description: `${ctx.failed_attempts_last_hour} tentativas falhadas na última hora` });
    }

    if (ctx.enrollment_age_days != null && ctx.enrollment_age_days > 365) {
      factors.push({ factor: 'behavioral_old_enrollment', weight: 0.05, score: 10, description: 'Enrollment com mais de 1 ano' });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MANAGER NOTIFICATION — triggered when risk_level is high/critical
  // ═══════════════════════════════════════════════════════════════

  async notifyManagerIfHighRisk(
    tenantId: string,
    employeeId: string,
    assessment: BiometricRiskAssessment,
    context: { worktime_entry_id?: string; match_score?: number },
  ): Promise<boolean> {
    if (assessment.risk_level !== 'high' && assessment.risk_level !== 'critical') {
      return false;
    }

    try {
      // 1. Persist a notification record
      await supabase
        .from('notifications' as any)
        .insert({
          tenant_id: tenantId,
          type: 'biometric_risk_alert',
          title: assessment.risk_level === 'critical'
            ? '🚨 Risco biométrico CRÍTICO detectado'
            : '⚠️ Risco biométrico elevado detectado',
          message: [
            `Colaborador: ${employeeId}`,
            `Score de risco: ${assessment.overall_score}/100 (${assessment.risk_level})`,
            `Fatores: ${assessment.factors.map(f => f.description).join('; ')}`,
            `Ação recomendada: ${assessment.recommended_action}`,
            context.match_score != null ? `Match: ${(context.match_score * 100).toFixed(1)}%` : '',
          ].filter(Boolean).join('\n'),
          priority: assessment.risk_level === 'critical' ? 'critical' : 'high',
          metadata: {
            employee_id: employeeId,
            risk_score: assessment.overall_score,
            risk_level: assessment.risk_level,
            factors: assessment.factors,
            worktime_entry_id: context.worktime_entry_id,
          },
        });

      // 2. Audit the notification
      await supabase
        .from('biometric_audit_trail' as any)
        .insert({
          tenant_id: tenantId,
          employee_id: employeeId,
          action: 'manager_risk_notification',
          action_category: 'verification',
          entity_type: 'risk_assessment',
          metadata: {
            risk_score: assessment.overall_score,
            risk_level: assessment.risk_level,
            recommended_action: assessment.recommended_action,
            factor_count: assessment.factors.length,
          },
          lgpd_justification: 'Notificação automática de risco biométrico elevado ao gestor',
        });

      console.info(`[RiskScoringEngine] Manager notified: risk=${assessment.risk_level}, score=${assessment.overall_score}`);
      return true;
    } catch (err) {
      console.error('[RiskScoringEngine] Failed to notify manager:', err);
      return false;
    }
  }
}
