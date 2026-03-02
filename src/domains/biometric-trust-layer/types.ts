/**
 * Biometric Trust Layer — Type definitions.
 *
 * LGPD-compliant biometric verification for WorkTime Compliance Engine.
 */

// ── Enrollment ──────────────────────────────────────────────────

export type EnrollmentStatus = 'pending' | 'active' | 'revoked' | 'expired';
export type CaptureMethod = 'camera' | 'upload' | 'kiosk';
export type LGPDLegalBasis = 'consent' | 'legal_obligation' | 'legitimate_interest';

export interface BiometricEnrollment {
  id: string;
  tenant_id: string;
  employee_id: string;
  enrollment_status: EnrollmentStatus;
  template_hash: string;
  encrypted_template?: string;
  template_version: number;
  quality_score: number;
  liveness_verified: boolean;
  capture_device?: string;
  capture_method: CaptureMethod;
  consent_granted: boolean;
  consent_granted_at?: string;
  consent_ip_address?: string;
  consent_version_id?: string;
  lgpd_legal_basis: LGPDLegalBasis;
  lgpd_retention_days: number;
  expires_at?: string;
  revoked_at?: string;
  revoked_by?: string;
  revoked_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEnrollmentDTO {
  tenant_id: string;
  employee_id: string;
  face_image_data: string; // base64
  capture_method: CaptureMethod;
  capture_device?: string;
  consent_granted: boolean;
  consent_ip_address?: string;
  consent_version_id?: string;
  lgpd_legal_basis?: LGPDLegalBasis;
}

// ── Liveness ────────────────────────────────────────────────────

export type ChallengeType = 'passive' | 'blink' | 'head_turn' | 'smile' | 'random_gesture';
export type ChallengeResult = 'pending' | 'passed' | 'failed' | 'timeout' | 'error';

export interface LivenessChallenge {
  id: string;
  tenant_id: string;
  employee_id: string;
  challenge_type: ChallengeType;
  challenge_data: Record<string, unknown>;
  result: ChallengeResult;
  confidence_score?: number;
  spoof_probability?: number;
  processing_time_ms?: number;
  device_info: Record<string, unknown>;
  completed_at?: string;
  created_at: string;
}

export interface LivenessCheckDTO {
  tenant_id: string;
  employee_id: string;
  challenge_type?: ChallengeType;
  face_image_data: string; // base64
  device_info?: Record<string, unknown>;
}

export interface LivenessResult {
  challenge_id: string;
  passed: boolean;
  confidence_score: number;
  spoof_probability: number;
  challenge_type: ChallengeType;
  processing_time_ms: number;
}

// ── Face Match ──────────────────────────────────────────────────

export type MatchResult = 'match' | 'no_match' | 'spoof_detected' | 'liveness_failed' | 'error';

export interface BiometricMatchLog {
  id: string;
  tenant_id: string;
  employee_id: string;
  enrollment_id?: string;
  worktime_entry_id?: string;
  match_score: number;
  match_threshold: number;
  match_result: MatchResult;
  liveness_passed: boolean;
  liveness_score?: number;
  liveness_method: string;
  risk_score: number;
  risk_factors: string[];
  capture_quality?: number;
  device_fingerprint?: string;
  ip_address?: string;
  latitude?: number;
  longitude?: number;
  processing_time_ms?: number;
  fraud_signals: string[];
  auto_action?: string;
  created_at: string;
}

export interface FaceVerifyDTO {
  tenant_id: string;
  employee_id: string;
  face_image_data: string; // base64
  worktime_entry_id?: string;
  device_fingerprint?: string;
  ip_address?: string;
  latitude?: number;
  longitude?: number;
}

export interface FaceVerifyResult {
  match_log_id: string;
  match_result: MatchResult;
  match_score: number;
  liveness_passed: boolean;
  risk_score: number;
  risk_factors: string[];
  auto_action?: string;
  processing_time_ms: number;
}

// ── Risk Scoring ────────────────────────────────────────────────

export interface BiometricRiskAssessment {
  overall_score: number;     // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factors: BiometricRiskFactor[];
  recommended_action: 'allow' | 'flag' | 'block' | 'require_liveness';
}

export interface BiometricRiskFactor {
  factor: string;
  weight: number;
  score: number;
  description: string;
}

// ── Consent (LGPD) ─────────────────────────────────────────────

export type ConsentType = 'facial_recognition' | 'liveness_detection' | 'template_storage' | 'data_sharing';

export interface BiometricConsent {
  id: string;
  tenant_id: string;
  employee_id: string;
  consent_type: ConsentType;
  consent_version: string;
  granted: boolean;
  granted_at?: string;
  revoked_at?: string;
  ip_address?: string;
  legal_basis: string;
  purpose_description: string;
  retention_period_days: number;
  created_at: string;
}

// ── Audit ───────────────────────────────────────────────────────

export type AuditActionCategory = 'enrollment' | 'verification' | 'access' | 'consent' | 'revocation' | 'deletion' | 'export';

export interface BiometricAuditEntry {
  id: string;
  tenant_id: string;
  employee_id?: string;
  actor_id?: string;
  action: string;
  action_category: AuditActionCategory;
  entity_type: string;
  entity_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata: Record<string, unknown>;
  lgpd_justification?: string;
  created_at: string;
}

// ── Engine API ──────────────────────────────────────────────────

export interface BiometricTrustEngineAPI {
  enroll(dto: CreateEnrollmentDTO): Promise<BiometricEnrollment>;
  verify(dto: FaceVerifyDTO): Promise<FaceVerifyResult>;
  checkLiveness(dto: LivenessCheckDTO): Promise<LivenessResult>;
  revokeEnrollment(tenantId: string, enrollmentId: string, reason: string, actorId: string): Promise<void>;
  getEnrollment(tenantId: string, employeeId: string): Promise<BiometricEnrollment | null>;
  grantConsent(tenantId: string, employeeId: string, consentType: ConsentType, ipAddress: string): Promise<BiometricConsent>;
  revokeConsent(tenantId: string, employeeId: string, consentType: ConsentType): Promise<void>;
  assessRisk(tenantId: string, employeeId: string, matchScore: number, livenessScore: number, context: Record<string, unknown>): BiometricRiskAssessment;
}
