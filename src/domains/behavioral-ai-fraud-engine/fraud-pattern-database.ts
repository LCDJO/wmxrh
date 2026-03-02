/**
 * FraudPatternDatabase — In-memory catalog of known fraud patterns
 * with rule-based matching against behavioral feature vectors.
 *
 * Categories:
 *   buddy_punching, bot_automation, replay_attack, device_sharing,
 *   location_spoofing, time_manipulation, proxy_clocking, credential_sharing
 */

import type {
  FraudPattern, FraudDetectionRule, FraudIncident,
  FraudPatternCategory, BehavioralFeatureVector, AnomalyDetection,
} from './types';

// ── Built-in patterns ──────────────────────────────────────────

const BUILT_IN_PATTERNS: FraudPattern[] = [
  {
    id: 'fp-buddy-punch',
    category: 'buddy_punching',
    name: 'Buddy Punching Detection',
    description: 'Outro colaborador registrando ponto no lugar do titular',
    detection_rules: [
      { field: 'avg_touch_pressure', operator: 'gt', value: 3.5, weight: 0.3 },
      { field: 'avg_touch_duration_ms', operator: 'gt', value: 2.5, weight: 0.3 },
      { field: 'typing_speed_cpm', operator: 'gt', value: 2.0, weight: 0.2 },
      { field: 'swipe_angle_consistency', operator: 'lt', value: -1.5, weight: 0.2 },
    ],
    severity: 'high',
    is_active: true,
    false_positive_rate: 0.08,
    true_positive_rate: 0.87,
    sample_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'fp-bot-auto',
    category: 'bot_automation',
    name: 'Bot/Automation Detection',
    description: 'Registro automatizado via script ou macro',
    detection_rules: [
      { field: 'touch_interval_stddev_ms', operator: 'lt', value: -2.0, weight: 0.35 },
      { field: 'time_to_clock_action_ms', operator: 'lt', value: -2.5, weight: 0.35 },
      { field: 'hesitation_count', operator: 'lt', value: -1.5, weight: 0.15 },
      { field: 'pressure_variance', operator: 'lt', value: -2.0, weight: 0.15 },
    ],
    severity: 'critical',
    is_active: true,
    false_positive_rate: 0.03,
    true_positive_rate: 0.92,
    sample_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'fp-replay',
    category: 'replay_attack',
    name: 'Replay Attack Detection',
    description: 'Reprodução exata de sessão comportamental anterior',
    detection_rules: [
      { field: 'avg_touch_duration_ms', operator: 'lt', value: 0.3, weight: 0.25 },
      { field: 'touch_interval_stddev_ms', operator: 'lt', value: 0.3, weight: 0.25 },
      { field: 'avg_touch_pressure', operator: 'lt', value: 0.3, weight: 0.25 },
      { field: 'avg_swipe_velocity', operator: 'lt', value: 0.3, weight: 0.25 },
    ],
    severity: 'critical',
    is_active: true,
    false_positive_rate: 0.02,
    true_positive_rate: 0.95,
    sample_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'fp-device-share',
    category: 'device_sharing',
    name: 'Device Sharing Detection',
    description: 'Múltiplos colaboradores usando o mesmo dispositivo',
    detection_rules: [
      { field: 'device_tilt_mean_x', operator: 'gt', value: 2.5, weight: 0.25 },
      { field: 'device_tilt_mean_y', operator: 'gt', value: 2.5, weight: 0.25 },
      { field: 'avg_touch_pressure', operator: 'gt', value: 2.0, weight: 0.25 },
      { field: 'avg_touch_duration_ms', operator: 'gt', value: 2.0, weight: 0.25 },
    ],
    severity: 'high',
    is_active: true,
    false_positive_rate: 0.10,
    true_positive_rate: 0.82,
    sample_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'fp-proxy-clock',
    category: 'proxy_clocking',
    name: 'Proxy Clocking Detection',
    description: 'Ponto registrado por terceiro com perfil comportamental divergente',
    detection_rules: [
      { field: 'avg_touch_duration_ms', operator: 'gt', value: 3.0, weight: 0.20 },
      { field: 'typing_speed_cpm', operator: 'gt', value: 2.5, weight: 0.20 },
      { field: 'device_tilt_stddev', operator: 'gt', value: 2.0, weight: 0.20 },
      { field: 'swipe_angle_consistency', operator: 'lt', value: -2.0, weight: 0.20 },
      { field: 'avg_touch_pressure', operator: 'gt', value: 2.5, weight: 0.20 },
    ],
    severity: 'high',
    is_active: true,
    false_positive_rate: 0.12,
    true_positive_rate: 0.80,
    sample_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export class FraudPatternDatabase {
  private patterns: FraudPattern[] = [...BUILT_IN_PATTERNS];

  /**
   * Match feature deviations against known fraud patterns.
   * `deviations` = Z-scores from BehaviorProfileManager.computeDeviations()
   */
  matchPatterns(
    tenantId: string,
    employeeId: string,
    sessionId: string,
    deviations: Record<string, number>,
    anomalies: AnomalyDetection[],
  ): FraudIncident[] {
    const incidents: FraudIncident[] = [];

    for (const pattern of this.patterns) {
      if (!pattern.is_active) continue;

      const { matched, confidence } = this.evaluateRules(pattern.detection_rules, deviations);

      if (matched && confidence >= 0.5) {
        incidents.push({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          employee_id: employeeId,
          pattern_id: pattern.id,
          pattern_category: pattern.category,
          session_id: sessionId,
          confidence,
          evidence: {
            deviations,
            anomaly_types: anomalies.map(a => a.anomaly_type),
            anomaly_count: anomalies.length,
            pattern_name: pattern.name,
          },
          status: confidence >= 0.8 ? 'detected' : 'investigating',
          created_at: new Date().toISOString(),
        });

        pattern.sample_count += 1;
      }
    }

    return incidents;
  }

  private evaluateRules(
    rules: FraudDetectionRule[],
    deviations: Record<string, number>,
  ): { matched: boolean; confidence: number } {
    let totalWeight = 0;
    let matchedWeight = 0;

    for (const rule of rules) {
      const val = deviations[rule.field];
      if (val == null) continue;

      totalWeight += rule.weight;

      let ruleMatched = false;
      const threshold = rule.value as number;

      switch (rule.operator) {
        case 'gt':  ruleMatched = val > threshold; break;
        case 'lt':  ruleMatched = val < threshold; break;
        case 'gte': ruleMatched = val >= threshold; break;
        case 'lte': ruleMatched = val <= threshold; break;
        case 'eq':  ruleMatched = Math.abs(val - threshold) < 0.01; break;
        case 'between': {
          const [lo, hi] = rule.value as [number, number];
          ruleMatched = val >= lo && val <= hi;
          break;
        }
      }

      if (ruleMatched) matchedWeight += rule.weight;
    }

    if (totalWeight === 0) return { matched: false, confidence: 0 };

    const confidence = matchedWeight / totalWeight;
    return { matched: confidence >= 0.5, confidence };
  }

  getPatterns(): FraudPattern[] {
    return [...this.patterns];
  }

  getPatternsByCategory(category: FraudPatternCategory): FraudPattern[] {
    return this.patterns.filter(p => p.category === category);
  }

  addPattern(pattern: FraudPattern): void {
    this.patterns.push(pattern);
  }

  togglePattern(patternId: string, active: boolean): void {
    const p = this.patterns.find(p => p.id === patternId);
    if (p) p.is_active = active;
  }
}
