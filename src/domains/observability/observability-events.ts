/**
 * Canonical Observability Events — emitted through GlobalEventKernel.
 *
 * These are the standard events that other layers (Self-Healing, Governance, etc.)
 * subscribe to for cross-cutting integration.
 */

export const OBSERVABILITY_KERNEL_EVENTS = {
  /** Fired when a module's health status changes (healthy→degraded, degraded→down, etc.) */
  ModuleHealthChanged: 'observability:module_health_changed',
  /** Fired when an application error is captured */
  ApplicationErrorDetected: 'observability:application_error_detected',
  /** Fired when a module/gateway latency p95 exceeds threshold */
  LatencyThresholdExceeded: 'observability:latency_threshold_exceeded',
  /** Fired when error rate spikes above normal */
  ErrorRateSpike: 'observability:error_rate_spike',
  /** SCIM: User provisioned via SCIM */
  SCIMUserCreated: 'observability:scim_user_created',
  /** SCIM: User attributes updated via SCIM */
  SCIMUserUpdated: 'observability:scim_user_updated',
  /** SCIM: User deactivated via SCIM */
  SCIMUserDeactivated: 'observability:scim_user_deactivated',
  /** SCIM: Group synced to internal roles */
  SCIMGroupSynced: 'observability:scim_group_synced',
  /** WorkTime: Clock entry successfully recorded */
  TimeEntryRecorded: 'observability:time_entry_recorded',
  /** WorkTime: Clock entry rejected (geofence / device / retroactive) */
  TimeEntryRejected: 'observability:time_entry_rejected',
  /** WorkTime: Geofence violation detected */
  GeoFenceViolation: 'observability:geofence_violation',
  /** WorkTime: Time adjustment requested */
  TimeAdjustmentRequested: 'observability:time_adjustment_requested',
  /** WorkTime: Anti-fraud flag raised */
  FraudFlagRaised: 'observability:fraud_flag_raised',
  /** Biometric: Face enrollment completed */
  BiometricEnrolled: 'observability:biometric_enrolled',
  /** Biometric: Face verification completed */
  BiometricVerified: 'observability:biometric_verified',
  /** Biometric: Spoof/liveness failure detected */
  BiometricSpoofDetected: 'observability:biometric_spoof_detected',
  /** Biometric: Consent granted or revoked */
  BiometricConsentChanged: 'observability:biometric_consent_changed',
  /** BehavioralAI: New behavior profile created for employee */
  BehaviorProfileCreated: 'observability:behavior_profile_created',
  /** BehavioralAI: Behavioral anomaly detected during clock event */
  BehaviorAnomalyDetected: 'observability:behavior_anomaly_detected',
  /** BehavioralAI: High-risk entry blocked by unified risk engine */
  HighRiskEntryBlocked: 'observability:high_risk_entry_blocked',
  /** BehavioralAI: Cluster of correlated fraud anomalies detected */
  FraudClusterDetected: 'observability:fraud_cluster_detected',
  /** BehavioralAI: Adaptive model recalibrated from feedback */
  AdaptiveModelUpdated: 'observability:adaptive_model_updated',
} as const;

export type ObservabilityKernelEvent = typeof OBSERVABILITY_KERNEL_EVENTS[keyof typeof OBSERVABILITY_KERNEL_EVENTS];

// ── Payload types ───────────────────────────────────────────────

export interface ModuleHealthChangedPayload {
  module_id: string;
  module_label: string;
  previous_status: string;
  current_status: string;
  error_count_1h: number;
  latency_ms: number;
}

export interface ApplicationErrorDetectedPayload {
  error_id: string;
  message: string;
  severity: string;
  error_type: string;
  source: string;
  module_id?: string;
  count: number;
}

export interface LatencyThresholdExceededPayload {
  source: string;
  category: string;
  p95_ms: number;
  threshold_ms: number;
  sample_count: number;
}

export interface ErrorRateSpikePayload {
  rate_per_min: number;
  threshold_per_min: number;
  top_module?: string;
  total_errors_1h: number;
}

export interface SCIMUserCreatedPayload {
  tenant_id: string;
  external_id: string;
  email: string;
  role: string;
  scim_client_id: string;
}

export interface SCIMUserUpdatedPayload {
  tenant_id: string;
  external_id: string;
  changed_fields: string[];
  scim_client_id: string;
}

export interface SCIMUserDeactivatedPayload {
  tenant_id: string;
  external_id: string;
  user_id?: string;
  scim_client_id: string;
}

export interface SCIMGroupSyncedPayload {
  tenant_id: string;
  group_name: string;
  mapped_role: string;
  members_affected: number;
  scim_client_id: string;
}

// ── WorkTime Payloads ───────────────────────────────────────────

export interface TimeEntryRecordedPayload {
  tenant_id: string;
  employee_id: string;
  event_type: string;
  recorded_at: string;
  source: string;
  integrity_hash: string;
  geofence_matched: boolean;
}

export interface TimeEntryRejectedPayload {
  tenant_id: string;
  employee_id: string;
  event_type: string;
  reason: string;
  rejection_source: 'geofence' | 'device' | 'retroactive' | 'future' | 'other';
}

export interface GeoFenceViolationPayload {
  tenant_id: string;
  employee_id: string;
  latitude: number;
  longitude: number;
  reason: string;
  matched_geofence_id?: string;
}

export interface TimeAdjustmentRequestedPayload {
  tenant_id: string;
  employee_id: string;
  entry_id: string;
  justification: string;
  requested_by: string;
}

export interface FraudFlagRaisedPayload {
  tenant_id: string;
  employee_id: string;
  fraud_type: string;
  severity: string;
  confidence_score: number;
  auto_action?: string;
}

// ── Biometric Payloads ──────────────────────────────────────────

export interface BiometricEnrolledPayload {
  tenant_id: string;
  employee_id: string;
  enrollment_id: string;
  capture_method: string;
  quality_score: number;
}

export interface BiometricVerifiedPayload {
  tenant_id: string;
  employee_id: string;
  match_result: string;
  match_score: number;
  liveness_passed: boolean;
  risk_score: number;
  worktime_entry_id?: string;
}

export interface BiometricSpoofDetectedPayload {
  tenant_id: string;
  employee_id: string;
  detection_type: 'no_match' | 'spoof_detected' | 'liveness_failed';
  confidence_score: number;
  auto_action?: string;
}

export interface BiometricConsentChangedPayload {
  tenant_id: string;
  employee_id: string;
  consent_type: string;
  granted: boolean;
}

export interface BehaviorProfileCreatedPayload {
  tenant_id: string;
  employee_id: string;
  profile_id: string;
  maturity: string;
  sample_count: number;
}

export interface BehaviorAnomalyDetectedPayload {
  tenant_id: string;
  employee_id: string;
  session_id: string;
  anomaly_type: string;
  severity: string;
  deviation_score: number;
  confidence: number;
}

export interface HighRiskEntryBlockedPayload {
  tenant_id: string;
  employee_id: string;
  session_id: string;
  overall_risk_score: number;
  risk_level: string;
  recommended_action: string;
  contributing_pillars: string[];
}

export interface FraudClusterDetectedPayload {
  tenant_id: string;
  cluster_id: string;
  cluster_type: string;
  employee_ids: string[];
  session_count: number;
  severity: string;
  confidence: number;
}

export interface AdaptiveModelUpdatedPayload {
  tenant_id: string;
  trigger: 'manager_approval' | 'feedback' | 'auto_recalibration';
  precision: number;
  recall: number;
  f1_score: number;
  total_predictions: number;
}

export const __DOMAIN_CATALOG = {
  domain: 'Observability',
  color: 'hsl(35 90% 55%)',
  events: [
    { name: 'ModuleHealthChanged', description: 'Status de saúde do módulo alterado' },
    { name: 'ApplicationErrorDetected', description: 'Erro de aplicação capturado' },
    { name: 'LatencyThresholdExceeded', description: 'Latência p95 acima do threshold' },
    { name: 'ErrorRateSpike', description: 'Pico na taxa de erros' },
    { name: 'SCIMUserCreated', description: 'Usuário provisionado via SCIM' },
    { name: 'SCIMUserUpdated', description: 'Usuário atualizado via SCIM' },
    { name: 'SCIMUserDeactivated', description: 'Usuário desativado via SCIM' },
    { name: 'SCIMGroupSynced', description: 'Grupo SCIM sincronizado com roles' },
    { name: 'TimeEntryRecorded', description: 'Registro de ponto persistido com sucesso' },
    { name: 'TimeEntryRejected', description: 'Registro de ponto rejeitado' },
    { name: 'GeoFenceViolation', description: 'Violação de cerca geográfica detectada' },
    { name: 'TimeAdjustmentRequested', description: 'Solicitação de ajuste de ponto' },
    { name: 'FraudFlagRaised', description: 'Sinal de fraude detectado pelo anti-fraude' },
    { name: 'BiometricEnrolled', description: 'Enrollment biométrico facial concluído' },
    { name: 'BiometricVerified', description: 'Verificação biométrica facial realizada' },
    { name: 'BiometricSpoofDetected', description: 'Tentativa de spoof/fraude biométrica detectada' },
    { name: 'BiometricConsentChanged', description: 'Consentimento biométrico concedido/revogado (LGPD)' },
    { name: 'BehaviorProfileCreated', description: 'Perfil comportamental criado para colaborador' },
    { name: 'BehaviorAnomalyDetected', description: 'Anomalia comportamental detectada em registro de ponto' },
    { name: 'HighRiskEntryBlocked', description: 'Registro de alto risco bloqueado pelo motor unificado' },
    { name: 'FraudClusterDetected', description: 'Cluster de anomalias de fraude correlacionadas detectado' },
    { name: 'AdaptiveModelUpdated', description: 'Modelo adaptativo recalibrado com feedback' },
  ],
};
