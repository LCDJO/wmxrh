/**
 * AnomalyDetectionModel — Statistical anomaly detection using Z-score
 * analysis against per-employee behavioral profiles.
 *
 * Detection layers:
 *   1. Timing anomalies    — touch duration, typing speed
 *   2. Pressure anomalies  — touch pressure variance
 *   3. Motion anomalies    — device tilt, shake events
 *   4. Navigation anomalies — hesitation, backtrack patterns
 *   5. Bot detection       — impossibly consistent or fast patterns
 *   6. Replay detection    — near-identical feature vectors
 *   7. Proxy employee      — device + behavior mismatch
 */

import type {
  BehavioralFeatureVector, BehaviorProfile,
  AnomalyDetection, AnomalyType, AnomalySeverity,
} from './types';
import { BehaviorProfileManager } from './behavior-profile-manager';

// Z-score thresholds
const Z_WARN = 2.0;
const Z_HIGH = 3.0;
const Z_CRITICAL = 4.0;

// Bot detection thresholds
const BOT_STDDEV_THRESHOLD = 0.5;  // impossibly low variance
const BOT_SPEED_THRESHOLD = 500;    // < 500ms to clock action

// Replay detection: max Euclidean distance considered a replay
const REPLAY_DISTANCE_THRESHOLD = 0.5;

export class AnomalyDetectionModel {
  constructor(private profileManager: BehaviorProfileManager) {}

  detect(
    tenantId: string,
    employeeId: string,
    features: BehavioralFeatureVector,
    recentFeatures?: BehavioralFeatureVector[],
  ): AnomalyDetection[] {
    const profile = this.profileManager.getProfile(tenantId, employeeId);
    if (!profile || profile.maturity === 'nascent') return []; // not enough data

    const deviations = this.profileManager.computeDeviations(profile, features);
    const anomalies: AnomalyDetection[] = [];
    const now = new Date().toISOString();

    // ── Layer 1: Timing ─────────────────────────────────────────
    this.checkZ(deviations, 'avg_touch_duration_ms', 'timing_anomaly', 'Duração de toque fora do padrão', features, anomalies, now);
    this.checkZ(deviations, 'touch_interval_stddev_ms', 'timing_anomaly', 'Cadência de toque anômala', features, anomalies, now);
    this.checkZ(deviations, 'typing_speed_cpm', 'timing_anomaly', 'Velocidade de digitação atípica', features, anomalies, now);

    // ── Layer 2: Pressure ───────────────────────────────────────
    this.checkZ(deviations, 'avg_touch_pressure', 'pressure_anomaly', 'Pressão de toque fora do padrão', features, anomalies, now);
    this.checkZ(deviations, 'pressure_variance', 'pressure_anomaly', 'Variância de pressão anômala', features, anomalies, now);

    // ── Layer 3: Motion ─────────────────────────────────────────
    this.checkZ(deviations, 'device_tilt_mean_x', 'motion_anomaly', 'Inclinação do dispositivo atípica', features, anomalies, now);
    this.checkZ(deviations, 'device_tilt_stddev', 'motion_anomaly', 'Estabilidade do dispositivo anômala', features, anomalies, now);
    this.checkZ(deviations, 'device_shake_events', 'motion_anomaly', 'Movimentação brusca detectada', features, anomalies, now);

    // ── Layer 4: Navigation ─────────────────────────────────────
    this.checkZ(deviations, 'hesitation_count', 'navigation_anomaly', 'Padrão de hesitação incomum', features, anomalies, now);
    this.checkZ(deviations, 'backtrack_count', 'navigation_anomaly', 'Navegação reversa atípica', features, anomalies, now);

    // ── Layer 5: Bot detection ──────────────────────────────────
    if (this.detectBot(features, profile)) {
      anomalies.push({
        id: crypto.randomUUID(),
        session_id: features.session_id,
        tenant_id: tenantId,
        employee_id: employeeId,
        anomaly_type: 'bot_behavior_detected',
        severity: 'critical',
        confidence: 0.85,
        deviation_score: 5,
        description: 'Comportamento compatível com automação/bot: variância impossibilitante baixa',
        feature_deltas: deviations,
        detected_at: now,
      });
    }

    // ── Layer 6: Replay detection ───────────────────────────────
    if (recentFeatures && this.detectReplay(features, recentFeatures)) {
      anomalies.push({
        id: crypto.randomUUID(),
        session_id: features.session_id,
        tenant_id: tenantId,
        employee_id: employeeId,
        anomaly_type: 'pattern_replay_detected',
        severity: 'critical',
        confidence: 0.90,
        deviation_score: 6,
        description: 'Vetor de features quase idêntico a sessão anterior — possível replay',
        feature_deltas: deviations,
        detected_at: now,
      });
    }

    return anomalies;
  }

  // ── Helpers ──────────────────────────────────────────────────

  private checkZ(
    deviations: Record<string, number>,
    field: string,
    anomalyType: AnomalyType,
    description: string,
    features: BehavioralFeatureVector,
    anomalies: AnomalyDetection[],
    now: string,
  ): void {
    const z = Math.abs(deviations[field] ?? 0);
    if (z < Z_WARN) return;

    const severity: AnomalySeverity = z >= Z_CRITICAL ? 'critical' : z >= Z_HIGH ? 'high' : 'medium';
    const confidence = Math.min(0.99, z / 6);

    anomalies.push({
      id: crypto.randomUUID(),
      session_id: features.session_id,
      tenant_id: features.tenant_id,
      employee_id: features.employee_id,
      anomaly_type: anomalyType,
      severity,
      confidence,
      deviation_score: z,
      description: `${description} (z=${z.toFixed(2)})`,
      feature_deltas: { [field]: deviations[field] },
      detected_at: now,
    });
  }

  private detectBot(features: BehavioralFeatureVector, profile: BehaviorProfile): boolean {
    // Bot = impossibly low variance + fast clock action
    if (features.touch_interval_stddev_ms < BOT_STDDEV_THRESHOLD &&
        features.time_to_clock_action_ms < BOT_SPEED_THRESHOLD &&
        features.hesitation_count === 0 &&
        profile.sample_count > 10) {
      return true;
    }
    return false;
  }

  private detectReplay(
    current: BehavioralFeatureVector,
    recent: BehavioralFeatureVector[],
  ): boolean {
    const numericKeys = [
      'avg_touch_duration_ms', 'touch_interval_stddev_ms', 'avg_touch_pressure',
      'avg_swipe_velocity', 'time_to_clock_action_ms',
    ] as const;

    for (const prev of recent) {
      let sumSqDiff = 0;
      for (const key of numericKeys) {
        const a = (current as any)[key] as number;
        const b = (prev as any)[key] as number;
        if (typeof a !== 'number' || typeof b !== 'number') continue;
        const maxVal = Math.max(Math.abs(a), Math.abs(b), 1);
        sumSqDiff += ((a - b) / maxVal) ** 2;
      }
      const distance = Math.sqrt(sumSqDiff / numericKeys.length);
      if (distance < REPLAY_DISTANCE_THRESHOLD) return true;
    }
    return false;
  }
}
