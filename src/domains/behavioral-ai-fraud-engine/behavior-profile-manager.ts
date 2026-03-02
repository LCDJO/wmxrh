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

import type { BehaviorProfile, BehavioralFeatureVector, ProfileMaturity, AnomalyHistoryEntry, ProfileSimilarityMatch } from './types';
import type { AnomalyDetection } from './types';

const EMA_ALPHA = 0.15;
const MIN_TRAINING_SAMPLES = 10;
const MAX_ANOMALY_HISTORY = 50;

const TOLERANCE_BY_MATURITY: Record<ProfileMaturity, number> = {
  nascent: 4.0,
  developing: 3.0,
  mature: 2.5,
  established: 2.0,
};

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
        tolerance_threshold: TOLERANCE_BY_MATURITY.nascent,
        anomaly_history: [],
        is_trained: false,
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
    existing.tolerance_threshold = TOLERANCE_BY_MATURITY[existing.maturity];
    existing.is_trained = existing.sample_count >= MIN_TRAINING_SAMPLES;
    existing.last_updated_at = new Date().toISOString();

    return existing;
  }

  /**
   * Record anomalies into the profile's rolling history.
   */
  recordAnomalies(tenantId: string, employeeId: string, anomalies: AnomalyDetection[]): void {
    const profile = this.getProfile(tenantId, employeeId);
    if (!profile) return;

    for (const a of anomalies) {
      const entry: AnomalyHistoryEntry = {
        anomaly_type: a.anomaly_type,
        severity: a.severity,
        deviation_score: a.deviation_score,
        session_id: a.session_id,
        detected_at: a.detected_at,
      };
      profile.anomaly_history.push(entry);
    }

    if (profile.anomaly_history.length > MAX_ANOMALY_HISTORY) {
      profile.anomaly_history = profile.anomaly_history.slice(-MAX_ANOMALY_HISTORY);
    }
  }

  /**
   * Compute Z-scores (deviation from baseline) for anomaly detection.
   * Returns empty if profile is not trained (< 10 samples).
   */
  computeDeviations(profile: BehaviorProfile, features: BehavioralFeatureVector): Record<string, number> {
    if (!profile.is_trained) return {};

    const deltas: Record<string, number> = {};
    const stddevs = profile.feature_stddevs as Record<string, number>;

    for (const key of NUMERIC_FEATURE_KEYS) {
      const current = (features as any)[key] as number;
      const baseline = (profile.baseline_features as any)[key] as number;
      const sd = stddevs[key] ?? 1;

      if (typeof current !== 'number' || typeof baseline !== 'number') continue;
      if (sd === 0) {
        deltas[key] = current !== baseline ? 5 : 0;
        continue;
      }

      deltas[key] = (current - baseline) / sd;
    }

    return deltas;
  }

  /**
   * Check if profile is trained (≥10 valid samples).
   */
  isTrained(tenantId: string, employeeId: string): boolean {
    const profile = this.getProfile(tenantId, employeeId);
    return profile?.is_trained ?? false;
  }

  /**
   * Get anomaly frequency for a given employee.
   */
  getAnomalyRate(tenantId: string, employeeId: string): { total: number; high_severity: number; rate_per_session: number } {
    const profile = this.getProfile(tenantId, employeeId);
    if (!profile || profile.sample_count === 0) {
      return { total: 0, high_severity: 0, rate_per_session: 0 };
    }
    const total = profile.anomaly_history.length;
    const high_severity = profile.anomaly_history.filter(a => a.severity === 'high' || a.severity === 'critical').length;
    return { total, high_severity, rate_per_session: total / profile.sample_count };
  }

  private computeMaturity(count: number): ProfileMaturity {
    if (count > 100) return 'established';
    if (count > 30) return 'mature';
    if (count >= MIN_TRAINING_SAMPLES) return 'developing';
    return 'nascent';
  }

  /** Reset profile (LGPD right to erasure) */
  deleteProfile(tenantId: string, employeeId: string): boolean {
    return this.profiles.delete(this.key(tenantId, employeeId));
  }

  // ── Anti-Shared-Device Detection ────────────────────────────

  /**
   * Compare all trained profiles within a tenant and detect pairs
   * with excessive behavioral similarity (cosine similarity > threshold).
   * Default threshold: 0.92 (very similar baselines).
   */
  detectSharedProfiles(tenantId: string, threshold = 0.92): ProfileSimilarityMatch[] {
    const tenantProfiles = [...this.profiles.values()].filter(
      p => p.tenant_id === tenantId && p.is_trained,
    );

    const matches: ProfileSimilarityMatch[] = [];

    for (let i = 0; i < tenantProfiles.length; i++) {
      for (let j = i + 1; j < tenantProfiles.length; j++) {
        const a = tenantProfiles[i];
        const b = tenantProfiles[j];

        const { cosine, euclidean, matchingDims } = this.computeSimilarity(
          a.baseline_features, b.baseline_features,
        );

        if (cosine >= threshold) {
          matches.push({
            employee_a: a.employee_id,
            employee_b: b.employee_id,
            cosine_similarity: Math.round(cosine * 1000) / 1000,
            euclidean_distance: Math.round(euclidean * 1000) / 1000,
            matching_dimensions: matchingDims,
            suspected_reason: cosine >= 0.97 ? 'shared_device'
              : cosine >= 0.95 ? 'proxy_clocking'
              : 'credential_sharing',
            detected_at: new Date().toISOString(),
          });
        }
      }
    }

    return matches.sort((a, b) => b.cosine_similarity - a.cosine_similarity);
  }

  private computeSimilarity(
    a: BehavioralFeatureVector,
    b: BehavioralFeatureVector,
  ): { cosine: number; euclidean: number; matchingDims: string[] } {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    let sumSqDiff = 0;
    const matchingDims: string[] = [];
    let dimCount = 0;

    for (const key of NUMERIC_FEATURE_KEYS) {
      const va = (a as any)[key] as number;
      const vb = (b as any)[key] as number;
      if (typeof va !== 'number' || typeof vb !== 'number') continue;

      dotProduct += va * vb;
      normA += va * va;
      normB += vb * vb;

      const maxVal = Math.max(Math.abs(va), Math.abs(vb), 1);
      const normalizedDiff = Math.abs(va - vb) / maxVal;
      sumSqDiff += normalizedDiff * normalizedDiff;
      dimCount++;

      // Track dimensions with very high similarity (< 5% difference)
      if (normalizedDiff < 0.05) {
        matchingDims.push(key);
      }
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    const cosine = denominator > 0 ? dotProduct / denominator : 0;
    const euclidean = dimCount > 0 ? Math.sqrt(sumSqDiff / dimCount) : 1;

    return { cosine, euclidean, matchingDims };
  }

  get profileCount(): number {
    return this.profiles.size;
  }
}
