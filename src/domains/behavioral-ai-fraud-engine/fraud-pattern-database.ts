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
  SuspiciousDevice, DeviceThreatLevel, BehaviorCluster,
  AnomalyType, AnomalySeverity,
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
  private devices = new Map<string, SuspiciousDevice>();      // fingerprint → device
  private clusters = new Map<string, BehaviorCluster>();      // cluster_id → cluster

  // ── Pattern Matching ────────────────────────────────────────

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

  // ── Suspicious Device Registry ──────────────────────────────

  /**
   * Register or escalate a suspicious device.
   */
  reportDevice(
    tenantId: string,
    fingerprint: string,
    employeeId: string,
    flags: string[],
    incidentId?: string,
  ): SuspiciousDevice {
    const existing = this.devices.get(fingerprint);
    const now = new Date().toISOString();

    if (existing) {
      existing.incident_count += 1;
      existing.last_seen_at = now;
      if (incidentId) existing.last_incident_id = incidentId;
      if (!existing.associated_employee_ids.includes(employeeId)) {
        existing.associated_employee_ids.push(employeeId);
      }
      for (const f of flags) {
        if (!existing.flags.includes(f)) existing.flags.push(f);
      }
      // Auto-escalate threat level
      existing.threat_level = this.escalateDeviceThreat(existing);
      return existing;
    }

    const device: SuspiciousDevice = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      device_fingerprint: fingerprint,
      threat_level: flags.length > 2 ? 'suspicious' : 'watch',
      associated_employee_ids: [employeeId],
      incident_count: 1,
      last_incident_id: incidentId,
      flags,
      first_seen_at: now,
      last_seen_at: now,
    };
    this.devices.set(fingerprint, device);
    return device;
  }

  getDevice(fingerprint: string): SuspiciousDevice | null {
    return this.devices.get(fingerprint) ?? null;
  }

  getSuspiciousDevices(tenantId: string): SuspiciousDevice[] {
    return [...this.devices.values()].filter(d => d.tenant_id === tenantId);
  }

  blockDevice(fingerprint: string, notes?: string): void {
    const d = this.devices.get(fingerprint);
    if (d) {
      d.threat_level = 'blocked';
      d.blocked_at = new Date().toISOString();
      if (notes) d.notes = notes;
    }
  }

  isDeviceBlocked(fingerprint: string): boolean {
    return this.devices.get(fingerprint)?.threat_level === 'blocked';
  }

  private escalateDeviceThreat(device: SuspiciousDevice): DeviceThreatLevel {
    if (device.threat_level === 'blocked') return 'blocked';
    if (device.associated_employee_ids.length >= 3 || device.incident_count >= 5) return 'suspicious';
    if (device.incident_count >= 2 || device.flags.length >= 2) return 'watch';
    return 'clean';
  }

  // ── Anomalous Behavior Clusters ─────────────────────────────

  /**
   * Register or update a behavior cluster (group of correlated anomalies).
   */
  registerCluster(
    tenantId: string,
    clusterType: BehaviorCluster['cluster_type'],
    employeeId: string,
    sessionId: string,
    anomalyTypes: AnomalyType[],
    severity: AnomalySeverity,
    confidence: number,
    centroidFeatures?: Partial<BehaviorCluster['centroid_features']>,
  ): BehaviorCluster {
    const now = new Date().toISOString();

    // Try to find existing cluster of same type + tenant with overlapping employees
    const existing = [...this.clusters.values()].find(
      c => c.tenant_id === tenantId
        && c.cluster_type === clusterType
        && c.is_active
        && c.employee_ids.includes(employeeId),
    );

    if (existing) {
      if (!existing.session_ids.includes(sessionId)) {
        existing.session_ids.push(sessionId);
      }
      for (const t of anomalyTypes) {
        if (!existing.anomaly_types.includes(t)) existing.anomaly_types.push(t);
      }
      existing.confidence = Math.max(existing.confidence, confidence);
      existing.last_updated_at = now;
      return existing;
    }

    const cluster: BehaviorCluster = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      cluster_type: clusterType,
      description: `Cluster ${clusterType} — ${anomalyTypes.join(', ')}`,
      employee_ids: [employeeId],
      session_ids: [sessionId],
      centroid_features: centroidFeatures ?? {},
      anomaly_types: [...anomalyTypes],
      severity,
      confidence,
      first_detected_at: now,
      last_updated_at: now,
      is_active: true,
    };
    this.clusters.set(cluster.id, cluster);
    return cluster;
  }

  /**
   * Merge an employee into an existing cluster (e.g. same device, same location).
   */
  mergeIntoCluster(clusterId: string, employeeId: string, sessionId: string): void {
    const c = this.clusters.get(clusterId);
    if (!c) return;
    if (!c.employee_ids.includes(employeeId)) c.employee_ids.push(employeeId);
    if (!c.session_ids.includes(sessionId)) c.session_ids.push(sessionId);
    c.last_updated_at = new Date().toISOString();
  }

  getActiveClusters(tenantId: string): BehaviorCluster[] {
    return [...this.clusters.values()].filter(c => c.tenant_id === tenantId && c.is_active);
  }

  deactivateCluster(clusterId: string): void {
    const c = this.clusters.get(clusterId);
    if (c) c.is_active = false;
  }

  get deviceCount(): number {
    return this.devices.size;
  }

  get clusterCount(): number {
    return this.clusters.size;
  }
}
