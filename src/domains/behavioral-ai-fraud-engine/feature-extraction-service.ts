/**
 * FeatureExtractionService — Transforms raw behavior samples into
 * a normalized feature vector for anomaly detection.
 *
 * Statistical approach: mean, stddev, percentiles per signal type.
 */

import type { BehaviorCaptureSession, BehavioralFeatureVector, BehaviorSample, HabitualTimeWindow } from './types';

export class FeatureExtractionService {

  /**
   * Optional context injected at extraction time for composite scoring.
   * These come from external engines (GeoFence, BiometricTrustLayer).
   */
  extract(
    session: BehaviorCaptureSession,
    context?: {
      employee_habitual_hours?: number[];   // e.g. [8,9,17,18] — typical clock hours
      geolocation_distance_m?: number;      // distance from usual clock location
      geolocation_usual_lat?: number;
      geolocation_usual_lng?: number;
      current_lat?: number;
      current_lng?: number;
      biometric_match_score?: number;       // from BiometricTrustLayer (0-1)
      biometric_baseline_score?: number;    // historical average match score
    },
  ): BehavioralFeatureVector {
    const touches = session.samples.filter(s => s.source === 'touch');
    const keys = session.samples.filter(s => s.source === 'keyboard');
    const accel = session.samples.filter(s => s.source === 'accelerometer');
    const gyro = session.samples.filter(s => s.source === 'gyroscope');

    const touchIntervals = this.intervals(touches);

    return {
      session_id: session.session_id,
      employee_id: session.employee_id,
      tenant_id: session.tenant_id,

      // Timing
      avg_touch_duration_ms: this.mean(touches.map(t => t.data.duration_ms ?? 0)),
      touch_interval_stddev_ms: this.stddev(touchIntervals),
      typing_speed_cpm: this.typingSpeedCPM(keys),
      avg_touch_interval_ms: this.mean(touchIntervals),

      // Pressure & motion
      avg_touch_pressure: this.mean(touches.map(t => t.data.pressure ?? 0)),
      pressure_variance: this.variance(touches.map(t => t.data.pressure ?? 0)),
      avg_swipe_velocity: this.mean(touches.filter(t => t.data.type === 1).map(t => t.data.velocity ?? 0)),
      swipe_angle_consistency: this.angleConsistency(touches.filter(t => t.data.type === 1)),
      motion_variance: this.computeMotionVariance(accel, gyro),

      // Accelerometer / gyroscope
      device_tilt_mean_x: this.mean(accel.map(s => s.data.x ?? 0)),
      device_tilt_mean_y: this.mean(accel.map(s => s.data.y ?? 0)),
      device_tilt_stddev: this.stddev([
        ...accel.map(s => s.data.x ?? 0),
        ...accel.map(s => s.data.y ?? 0),
      ]),
      device_shake_events: this.countShakes(accel),

      // Navigation
      screen_interaction_count: session.samples.length,
      time_to_clock_action_ms: this.timeToClockAction(session.samples),
      hesitation_count: this.countHesitations(session.samples),
      backtrack_count: this.countBacktracks(session.samples),

      // Session context
      session_duration_ms: this.computeSessionDuration(session),
      habitual_time_window: this.classifyTimeWindow(session.started_at),

      // ── BehaviorVector composite scores ───────────────────────
      habitual_hour_score: this.computeHabitualHourScore(session.started_at, context?.employee_habitual_hours),
      geolocation_pattern_score: this.computeGeolocationPatternScore(context?.geolocation_distance_m),
      biometric_variation_score: this.computeBiometricVariationScore(
        context?.biometric_match_score, context?.biometric_baseline_score,
      ),

      extracted_at: new Date().toISOString(),
    };
  }

  // ── Statistical helpers ──────────────────────────────────────

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  private variance(values: number[]): number {
    if (values.length < 2) return 0;
    const m = this.mean(values);
    return values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  }

  private stddev(values: number[]): number {
    return Math.sqrt(this.variance(values));
  }

  private intervals(samples: BehaviorSample[]): number[] {
    const sorted = samples.slice().sort((a, b) => a.timestamp - b.timestamp);
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(sorted[i].timestamp - sorted[i - 1].timestamp);
    }
    return intervals;
  }

  private typingSpeedCPM(keys: BehaviorSample[]): number {
    if (keys.length < 2) return 0;
    const sorted = keys.slice().sort((a, b) => a.timestamp - b.timestamp);
    const durationMs = sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
    if (durationMs <= 0) return 0;
    return (keys.length / (durationMs / 60_000));
  }

  private angleConsistency(swipes: BehaviorSample[]): number {
    const angles = swipes.map(s => s.data.angle ?? 0);
    if (angles.length < 2) return 1; // perfect consistency if only 1
    const sd = this.stddev(angles);
    return Math.max(0, 1 - sd / 180); // normalize: 0=chaotic, 1=consistent
  }

  private countShakes(accel: BehaviorSample[]): number {
    const THRESHOLD = 15; // m/s²
    let shakes = 0;
    for (const s of accel) {
      const magnitude = Math.sqrt((s.data.x ?? 0) ** 2 + (s.data.y ?? 0) ** 2 + (s.data.z ?? 0) ** 2);
      if (magnitude > THRESHOLD) shakes++;
    }
    return shakes;
  }

  private timeToClockAction(samples: BehaviorSample[]): number {
    const pre = samples.filter(s => s.phase === 'pre_clock');
    const during = samples.filter(s => s.phase === 'during_clock');
    if (pre.length === 0 || during.length === 0) return 0;
    const lastPre = Math.max(...pre.map(s => s.timestamp));
    const firstDuring = Math.min(...during.map(s => s.timestamp));
    return Math.max(0, firstDuring - lastPre);
  }

  private countHesitations(samples: BehaviorSample[]): number {
    // Hesitation = gap > 2 seconds between interactions
    const sorted = samples.slice().sort((a, b) => a.timestamp - b.timestamp);
    let count = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].timestamp - sorted[i - 1].timestamp > 2000) count++;
    }
    return count;
  }

  private countBacktracks(samples: BehaviorSample[]): number {
    let count = 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].phase === 'pre_clock' && samples[i - 1].phase === 'during_clock') count++;
    }
    return count;
  }

  private computeSessionDuration(session: BehaviorCaptureSession): number {
    // Prefer metadata if available (set by SDK)
    if (session.metadata?.session_duration_ms) {
      return session.metadata.session_duration_ms as number;
    }
    // Fallback: diff between first and last sample timestamps
    if (session.samples.length < 2) return 0;
    const sorted = session.samples.slice().sort((a, b) => a.timestamp - b.timestamp);
    return sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
  }

  private classifyTimeWindow(startedAt: string): HabitualTimeWindow {
    const hour = new Date(startedAt).getHours();
    if (hour >= 5 && hour < 8) return 'early_morning';
    if (hour >= 8 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    if (hour >= 21 && hour < 24) return 'night';
    return 'late_night'; // 0-4
  }

  // ═══════════════════════════════════════════════════════════════
  // BehaviorVector — composite scores (0-1, higher = more anomalous)
  // ═══════════════════════════════════════════════════════════════

  /**
   * motion_variance — Combined accelerometer + gyroscope variance.
   * High variance = shaky/unusual handling; 0 = perfectly still (suspicious bot).
   */
  private computeMotionVariance(
    accel: BehaviorSample[],
    gyro: BehaviorSample[],
  ): number {
    const accelMags = accel.map(s =>
      Math.sqrt((s.data.x ?? 0) ** 2 + (s.data.y ?? 0) ** 2 + (s.data.z ?? 0) ** 2),
    );
    const gyroMags = gyro.map(s =>
      Math.sqrt((s.data.alpha ?? 0) ** 2 + (s.data.beta ?? 0) ** 2 + (s.data.gamma ?? 0) ** 2),
    );
    const allMags = [...accelMags, ...gyroMags];
    return this.variance(allMags);
  }

  /**
   * habitual_hour_score — How typical is the current clock hour?
   * 0 = perfectly habitual, 1 = completely outside normal hours.
   */
  private computeHabitualHourScore(
    startedAt: string,
    habitualHours?: number[],
  ): number {
    const hour = new Date(startedAt).getHours();

    if (!habitualHours || habitualHours.length === 0) {
      // No history → neutral (slightly elevated)
      return 0.3;
    }

    // Circular distance on 24h clock
    const minDistance = Math.min(
      ...habitualHours.map(h => {
        const diff = Math.abs(hour - h);
        return Math.min(diff, 24 - diff);
      }),
    );

    // Normalize: 0h distance → 0 score; 12h distance → 1.0
    return Math.min(1, minDistance / 12);
  }

  /**
   * geolocation_pattern_score — How far from usual clock location?
   * 0 = same place, 1 = extremely far.
   */
  private computeGeolocationPatternScore(
    distanceMeters?: number,
  ): number {
    if (distanceMeters == null) return 0.2; // no data → slight elevation

    // Sigmoid normalization: 0m→0, 500m→0.5, 2000m→0.88, 5000m→0.97
    return 1 - 1 / (1 + distanceMeters / 500);
  }

  /**
   * biometric_variation_score — How much does current biometric match
   * deviate from the employee's historical average?
   * 0 = consistent, 1 = extremely different.
   */
  private computeBiometricVariationScore(
    currentScore?: number,
    baselineScore?: number,
  ): number {
    if (currentScore == null || baselineScore == null) return 0.1; // no data

    // Deviation from baseline, normalized
    const deviation = Math.abs(currentScore - baselineScore);
    // Max expected deviation is ~0.3 (0.95 baseline vs 0.65 current)
    return Math.min(1, deviation / 0.3);
  }
}
