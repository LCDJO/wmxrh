/**
 * BehaviorProfileManager — Maintains per-employee behavioral baselines.
 *
 * Uses exponential moving average (EMA) to update profiles progressively,
 * ensuring that behavioral drift is tracked naturally.
 *
 * Profile maturity levels:
 *   nascent     (<10 sessions)
 *   developing  (10-30 sessions)
 *   mature      (30-100 sessions)
 *   established (>100 sessions)
 */

import type { BehaviorProfile, BehavioralFeatureVector, ProfileMaturity } from './types';

const EMA_ALPHA = 0.15; // new sample weight

const NUMERIC_FEATURE_KEYS: (keyof BehavioralFeatureVector)[] = [
  'avg_touch_duration_ms', 'touch_interval_stddev_ms', 'typing_speed_cpm',
  'avg_touch_interval_ms',
  'avg_touch_pressure', 'pressure_variance', 'avg_swipe_velocity',
  'motion_variance', 'session_duration_ms',
  'swipe_angle_consistency', 'device_tilt_mean_x', 'device_tilt_mean_y',
  'device_tilt_stddev', 'device_shake_events', 'screen_interaction_count',
  'time_to_clock_action_ms', 'hesitation_count', 'backtrack_count',
  'habitual_hour_score', 'geolocation_pattern_score', 'biometric_variation_score',
];

export class BehaviorProfileManager {
  private profiles = new Map<string, BehaviorProfile>();

  private key(tenantId: string, employeeId: string): string {
    return `${tenantId}::${employeeId}`;
  }

  getProfile(tenantId: string, employeeId: string): BehaviorProfile | null {
    return this.profiles.get(this.key(tenantId, employeeId)) ?? null;
  }

  /**
   * Update (or create) the behavioral profile with a new feature vector.
   * Uses EMA for smooth adaptation.
   */
  updateProfile(tenantId: string, employeeId: string, features: BehavioralFeatureVector): BehaviorProfile {
    const k = this.key(tenantId, employeeId);
    const existing = this.profiles.get(k);

    if (!existing) {
      const profile: BehaviorProfile = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        employee_id: employeeId,
        maturity: 'nascent',
        sample_count: 1,
        baseline_features: { ...features },
        feature_stddevs: {},
        last_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      this.profiles.set(k, profile);
      return profile;
    }

    // EMA update
    const baseline = existing.baseline_features;
    const stddevs = { ...existing.feature_stddevs } as Record<string, number>;

    for (const key of NUMERIC_FEATURE_KEYS) {
      const newVal = (features as any)[key] as number;
      const oldVal = (baseline as any)[key] as number;
      if (typeof newVal !== 'number' || typeof oldVal !== 'number') continue;

      // Update baseline via EMA
      const emaVal = oldVal * (1 - EMA_ALPHA) + newVal * EMA_ALPHA;
      (baseline as any)[key] = emaVal;

      // Update running stddev approximation
      const diff = Math.abs(newVal - oldVal);
      const oldStd = (stddevs[key] ?? diff) as number;
      stddevs[key] = oldStd * (1 - EMA_ALPHA) + diff * EMA_ALPHA;
    }

    existing.sample_count += 1;
    existing.maturity = this.computeMaturity(existing.sample_count);
    existing.feature_stddevs = stddevs as any;
    existing.last_updated_at = new Date().toISOString();

    return existing;
  }

  /**
   * Compute Z-scores (deviation from baseline) for anomaly detection.
   */
  computeDeviations(profile: BehaviorProfile, features: BehavioralFeatureVector): Record<string, number> {
    const deltas: Record<string, number> = {};
    const stddevs = profile.feature_stddevs as Record<string, number>;

    for (const key of NUMERIC_FEATURE_KEYS) {
      const current = (features as any)[key] as number;
      const baseline = (profile.baseline_features as any)[key] as number;
      const sd = stddevs[key] ?? 1;

      if (typeof current !== 'number' || typeof baseline !== 'number') continue;
      if (sd === 0) {
        deltas[key] = current !== baseline ? 5 : 0; // max signal if stddev=0
        continue;
      }

      deltas[key] = (current - baseline) / sd; // Z-score
    }

    return deltas;
  }

  private computeMaturity(count: number): ProfileMaturity {
    if (count > 100) return 'established';
    if (count > 30) return 'mature';
    if (count >= 10) return 'developing';
    return 'nascent';
  }

  /** Reset profile (LGPD right to erasure) */
  deleteProfile(tenantId: string, employeeId: string): boolean {
    return this.profiles.delete(this.key(tenantId, employeeId));
  }

  get profileCount(): number {
    return this.profiles.size;
  }
}
