/**
 * Automated Hiring — Preparação Futura
 *
 * Extension points and contracts for upcoming capabilities:
 *
 *   1. Onboarding Digital Completo
 *      - Self-service portal for new hires
 *      - Progress tracking with step-by-step wizard
 *
 *   2. Coleta de Documentos via App
 *      - Mobile document capture (camera + OCR)
 *      - Real-time validation and status feedback
 *
 *   3. Validação Automática de Antecedentes
 *      - Background check orchestration
 *      - Multi-provider integration (criminal, credit, education)
 *
 *   4. Integração com Exame Clínico Externo
 *      - External clinic scheduling and result ingestion
 *      - HL7/FHIR-compatible payloads
 *
 * These are typed contracts only — no runtime dependencies.
 * Implementations will be provided by future engines.
 */

import type { HiringStep, HiringWorkflow } from './types';

// ═══════════════════════════════════════════════
//  1. Onboarding Digital Completo
// ═══════════════════════════════════════════════

export type OnboardingChannel = 'web_portal' | 'mobile_app' | 'whatsapp' | 'email_link';

export type OnboardingWizardStepStatus = 'locked' | 'available' | 'in_progress' | 'submitted' | 'validated' | 'rejected';

export interface OnboardingWizardStep {
  step: HiringStep;
  label: string;
  status: OnboardingWizardStepStatus;
  instructions: string;
  help_url: string | null;
  estimated_minutes: number;
  requires_upload: boolean;
  requires_signature: boolean;
}

export interface OnboardingSession {
  id: string;
  workflow_id: string;
  tenant_id: string;
  candidate_cpf: string;
  candidate_name: string;
  channel: OnboardingChannel;
  access_token_hash: string;
  expires_at: string;
  wizard_steps: OnboardingWizardStep[];
  current_step_index: number;
  started_at: string;
  completed_at: string | null;
  last_activity_at: string;
}

export interface CreateOnboardingSessionDTO {
  workflow_id: string;
  tenant_id: string;
  candidate_cpf: string;
  candidate_name: string;
  channel: OnboardingChannel;
  notify_candidate: boolean;
}

/** Port — to be implemented by the Onboarding Module */
export interface OnboardingPortalPort {
  createSession(dto: CreateOnboardingSessionDTO): Promise<OnboardingSession>;
  getSession(sessionId: string): Promise<OnboardingSession | null>;
  advanceStep(sessionId: string, stepIndex: number, payload: Record<string, unknown>): Promise<OnboardingSession>;
  expireSession(sessionId: string): Promise<void>;
}

// ═══════════════════════════════════════════════
//  2. Coleta de Documentos via App
// ═══════════════════════════════════════════════

export type DocumentCaptureMethod = 'camera' | 'gallery' | 'file_upload' | 'nfc_scan';

export type DocumentValidationStatus = 'pending' | 'processing' | 'valid' | 'invalid' | 'manual_review';

export interface CapturedDocument {
  id: string;
  workflow_id: string;
  document_type: string;
  capture_method: DocumentCaptureMethod;
  file_url: string;
  file_hash: string;
  mime_type: string;
  file_size_bytes: number;
  ocr_extracted_data: Record<string, string> | null;
  validation_status: DocumentValidationStatus;
  validation_errors: string[];
  captured_at: string;
  validated_at: string | null;
  device_info: {
    platform: string;
    os_version: string;
    app_version: string;
    geolocation: { lat: number; lng: number } | null;
  } | null;
}

export interface DocumentCaptureRequest {
  workflow_id: string;
  document_type: string;
  capture_method: DocumentCaptureMethod;
  file_data: Blob | ArrayBuffer;
  mime_type: string;
  device_info?: CapturedDocument['device_info'];
}

/** Port — to be implemented by the Document Capture Module */
export interface DocumentCapturePort {
  upload(request: DocumentCaptureRequest): Promise<CapturedDocument>;
  getStatus(documentId: string): Promise<CapturedDocument | null>;
  retryValidation(documentId: string): Promise<CapturedDocument>;
  listByWorkflow(workflowId: string): Promise<CapturedDocument[]>;
}

// ═══════════════════════════════════════════════
//  3. Validação Automática de Antecedentes
// ═══════════════════════════════════════════════

export type BackgroundCheckType =
  | 'criminal_federal'
  | 'criminal_state'
  | 'credit_score'
  | 'education_verification'
  | 'employment_history'
  | 'professional_license'
  | 'sanctions_list'
  | 'identity_verification';

export type BackgroundCheckStatus = 'requested' | 'in_progress' | 'completed' | 'failed' | 'expired';

export type BackgroundCheckResult = 'clear' | 'flagged' | 'inconclusive' | 'not_found';

export interface BackgroundCheckRecord {
  id: string;
  workflow_id: string;
  tenant_id: string;
  candidate_cpf: string;
  check_type: BackgroundCheckType;
  provider: string;
  status: BackgroundCheckStatus;
  result: BackgroundCheckResult | null;
  result_details: Record<string, unknown> | null;
  risk_score: number | null;
  requested_at: string;
  completed_at: string | null;
  expires_at: string | null;
  provider_reference: string | null;
}

export interface RequestBackgroundCheckDTO {
  workflow_id: string;
  tenant_id: string;
  candidate_cpf: string;
  candidate_name: string;
  checks: BackgroundCheckType[];
  priority: 'normal' | 'urgent';
}

export interface BackgroundCheckSummary {
  workflow_id: string;
  total_checks: number;
  completed: number;
  pending: number;
  flagged: number;
  overall_clear: boolean;
  highest_risk_score: number | null;
  checks: BackgroundCheckRecord[];
}

/** Port — to be implemented by the Background Check Module */
export interface BackgroundCheckPort {
  requestChecks(dto: RequestBackgroundCheckDTO): Promise<BackgroundCheckRecord[]>;
  getStatus(checkId: string): Promise<BackgroundCheckRecord | null>;
  getSummary(workflowId: string): Promise<BackgroundCheckSummary>;
  cancelPending(workflowId: string): Promise<number>;
}

// ═══════════════════════════════════════════════
//  4. Integração com Exame Clínico Externo
// ═══════════════════════════════════════════════

export type ExternalExamStatus = 'scheduled' | 'awaiting_patient' | 'in_progress' | 'result_pending' | 'completed' | 'cancelled' | 'no_show';

export type ExamResultFit = 'apto' | 'inapto' | 'apto_com_restricao';

export interface ExternalClinicProvider {
  id: string;
  name: string;
  cnpj: string;
  crm_medico: string;
  address: string;
  city: string;
  state: string;
  accepts_online_scheduling: boolean;
  supported_exams: string[];
  integration_protocol: 'rest_api' | 'hl7_v2' | 'fhir_r4' | 'email' | 'manual';
}

export interface ExternalExamAppointment {
  id: string;
  workflow_id: string;
  tenant_id: string;
  candidate_cpf: string;
  candidate_name: string;
  clinic_provider_id: string;
  exam_type: string;
  status: ExternalExamStatus;
  scheduled_date: string | null;
  scheduled_time: string | null;
  result_fit: ExamResultFit | null;
  result_observations: string | null;
  result_restrictions: string[] | null;
  aso_document_url: string | null;
  crm_medico: string | null;
  provider_reference: string | null;
  requested_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ScheduleExamDTO {
  workflow_id: string;
  tenant_id: string;
  candidate_cpf: string;
  candidate_name: string;
  clinic_provider_id: string;
  exam_type: string;
  preferred_date?: string;
  preferred_time?: string;
  urgency: 'normal' | 'urgent';
}

export interface ExamResultWebhookPayload {
  provider_reference: string;
  exam_type: string;
  result_fit: ExamResultFit;
  observations: string | null;
  restrictions: string[];
  crm_medico: string;
  aso_document_base64: string | null;
  completed_at: string;
}

/** Port — to be implemented by the Clinical Integration Module */
export interface ExternalClinicalPort {
  listProviders(city: string, examType: string): Promise<ExternalClinicProvider[]>;
  scheduleExam(dto: ScheduleExamDTO): Promise<ExternalExamAppointment>;
  getAppointment(appointmentId: string): Promise<ExternalExamAppointment | null>;
  processResultWebhook(payload: ExamResultWebhookPayload): Promise<ExternalExamAppointment>;
  cancelAppointment(appointmentId: string, reason: string): Promise<void>;
}

// ═══════════════════════════════════════════════
//  Feature Flags (for gradual rollout)
// ═══════════════════════════════════════════════

export interface HiringFutureFeatureFlags {
  onboarding_portal_enabled: boolean;
  mobile_document_capture_enabled: boolean;
  background_check_enabled: boolean;
  external_clinic_integration_enabled: boolean;
}

export const DEFAULT_FUTURE_FLAGS: HiringFutureFeatureFlags = {
  onboarding_portal_enabled: false,
  mobile_document_capture_enabled: false,
  background_check_enabled: false,
  external_clinic_integration_enabled: false,
};

/**
 * Check if a future feature is enabled for a tenant.
 * In production, this would read from tenant configuration.
 */
export function isFutureFeatureEnabled(
  flags: Partial<HiringFutureFeatureFlags>,
  feature: keyof HiringFutureFeatureFlags,
): boolean {
  return flags[feature] ?? DEFAULT_FUTURE_FLAGS[feature];
}
