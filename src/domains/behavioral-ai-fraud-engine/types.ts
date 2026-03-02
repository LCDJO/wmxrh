/**
 * Behavioral Biometrics & AI Fraud Pattern Engine — Types
 *
 * Detecção de fraude comportamental no módulo de ponto,
 * mesmo quando biometria facial é válida.
 */

// ── Behavior Capture ────────────────────────────────────────────

export type InputSource = 'touch' | 'mouse' | 'keyboard' | 'accelerometer' | 'gyroscope';
export type CapturePhase = 'pre_clock' | 'during_clock' | 'post_clock';

export interface BehaviorSample {
  timestamp: number;
  source: InputSource;
  phase: CapturePhase;
  data: Record<string, number>;
}

export interface BehaviorCaptureSession {
  session_id: string;
  tenant_id: string;
  employee_id: string;
  device_fingerprint: string;
  samples: BehaviorSample[];
  started_at: string;
  ended_at?: string;
  metadata: Record<string, unknown>;
}

// ── Feature Extraction ──────────────────────────────────────────

export interface BehavioralFeatureVector {
  session_id: string;
  employee_id: string;
  tenant_id: string;

  // Timing
  avg_touch_duration_ms: number;
  touch_interval_stddev_ms: number;
  typing_speed_cpm: number;

  // Pressure & motion
  avg_touch_pressure: number;
  pressure_variance: number;
  avg_swipe_velocity: number;
  swipe_angle_consistency: number;

  // Accelerometer / gyroscope
  device_tilt_mean_x: number;
  device_tilt_mean_y: number;
  device_tilt_stddev: number;
  device_shake_events: number;

  // Navigation patterns
  screen_interaction_count: number;
  time_to_clock_action_ms: number;
  hesitation_count: number;
  backtrack_count: number;

  extracted_at: string;
}

// ── Behavior Profile ────────────────────────────────────────────

export type ProfileMaturity = 'nascent' | 'developing' | 'mature' | 'established';

export interface BehaviorProfile {
  id: string;
  tenant_id: string;
  employee_id: string;
  maturity: ProfileMaturity;
  sample_count: number;
  baseline_features: BehavioralFeatureVector;
  feature_stddevs: Partial<BehavioralFeatureVector>;
  last_updated_at: string;
  created_at: string;
}

// ── Anomaly Detection ───────────────────────────────────────────

export type AnomalyType =
  | 'timing_anomaly'
  | 'pressure_anomaly'
  | 'motion_anomaly'
  | 'navigation_anomaly'
  | 'device_switch_anomaly'
  | 'location_velocity_anomaly'
  | 'pattern_replay_detected'
  | 'bot_behavior_detected'
  | 'proxy_employee_suspected';

export type AnomalySeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface AnomalyDetection {
  id: string;
  session_id: string;
  tenant_id: string;
  employee_id: string;
  anomaly_type: AnomalyType;
  severity: AnomalySeverity;
  confidence: number;         // 0-1
  deviation_score: number;    // z-score or Mahalanobis distance
  description: string;
  feature_deltas: Record<string, number>;
  detected_at: string;
}

// ── Risk Score (Behavioral) ─────────────────────────────────────

export interface BehavioralRiskAssessment {
  overall_score: number;      // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  anomaly_count: number;
  anomaly_types: AnomalyType[];
  recommended_action: 'allow' | 'flag' | 'challenge' | 'block' | 'escalate';
  contributing_factors: BehavioralRiskFactor[];
  combined_biometric_score?: number;   // merged with BiometricTrustLayer
  assessed_at: string;
}

export interface BehavioralRiskFactor {
  factor: string;
  weight: number;
  score: number;
  description: string;
}

// ── Fraud Pattern Database ──────────────────────────────────────

export type FraudPatternCategory =
  | 'buddy_punching'
  | 'bot_automation'
  | 'replay_attack'
  | 'device_sharing'
  | 'location_spoofing'
  | 'time_manipulation'
  | 'proxy_clocking'
  | 'credential_sharing';

export interface FraudPattern {
  id: string;
  category: FraudPatternCategory;
  name: string;
  description: string;
  detection_rules: FraudDetectionRule[];
  severity: AnomalySeverity;
  is_active: boolean;
  false_positive_rate: number;
  true_positive_rate: number;
  sample_count: number;
  created_at: string;
  updated_at: string;
}

export interface FraudDetectionRule {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between' | 'pattern';
  value: number | string | [number, number];
  weight: number;
}

export interface FraudIncident {
  id: string;
  tenant_id: string;
  employee_id: string;
  pattern_id: string;
  pattern_category: FraudPatternCategory;
  session_id: string;
  worktime_entry_id?: string;
  confidence: number;
  evidence: Record<string, unknown>;
  status: 'detected' | 'investigating' | 'confirmed' | 'dismissed' | 'escalated';
  resolved_by?: string;
  resolved_at?: string;
  enforcement_action_id?: string;
  created_at: string;
}

// ── Adaptive Learning ───────────────────────────────────────────

export interface LearningFeedback {
  incident_id: string;
  was_fraud: boolean;
  reviewer_id: string;
  notes?: string;
  submitted_at: string;
}

export interface ModelPerformanceMetrics {
  precision: number;
  recall: number;
  f1_score: number;
  false_positive_rate: number;
  true_positive_rate: number;
  total_predictions: number;
  total_confirmed_fraud: number;
  evaluated_at: string;
}

// ── Engine API ──────────────────────────────────────────────────

export interface BehavioralAIEngineAPI {
  captureBehavior(session: BehaviorCaptureSession): Promise<string>;
  extractFeatures(sessionId: string): Promise<BehavioralFeatureVector>;
  detectAnomalies(tenantId: string, employeeId: string, features: BehavioralFeatureVector): Promise<AnomalyDetection[]>;
  assessRisk(tenantId: string, employeeId: string, anomalies: AnomalyDetection[], biometricRiskScore?: number): BehavioralRiskAssessment;
  matchFraudPatterns(features: BehavioralFeatureVector, anomalies: AnomalyDetection[]): FraudIncident[];
  submitFeedback(feedback: LearningFeedback): Promise<void>;
  getProfile(tenantId: string, employeeId: string): BehaviorProfile | null;
}
