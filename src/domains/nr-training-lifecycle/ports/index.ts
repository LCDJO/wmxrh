/**
 * NR Training Lifecycle — Future Integration Ports
 *
 * All ports follow hexagonal architecture (Ports & Adapters).
 * Each port defines a contract; adapters implement for specific vendors.
 *
 * Ready for:
 *   1. LMS Integration (Moodle, TalentLMS, Alura, SENAI)
 *   2. EAD Platform (SCORM/xAPI content, quizzes)
 *   3. Biometric Attendance (fingerprint, facial recognition)
 *   4. Certificate Auto-Upload (OCR, matching, vault)
 */

// LMS Integration
export { lmsIntegrationRegistry } from './lms-integration.port';
export type {
  LmsIntegrationPort,
  LmsCourse,
  LmsEnrollment,
  LmsWebhookPayload,
} from './lms-integration.port';

// EAD Platform
export { eadPlatformRegistry } from './ead-platform.port';
export type {
  EadPlatformPort,
  EadCourse,
  EadCourseModule,
  EadLearnerProgress,
  EadSessionLog,
  EadCertificate,
  EadContentType,
} from './ead-platform.port';

// Biometric Attendance
export { biometricAttendanceRegistry } from './biometric-attendance.port';
export type {
  BiometricAttendancePort,
  BiometricDevice,
  BiometricMethod,
  AttendanceRecord,
  TrainingSession,
  AttendanceSummary,
  PresenceProof,
} from './biometric-attendance.port';

// Certificate Auto-Upload
export { certificateUploadRegistry } from './certificate-upload.port';
export type {
  CertificateUploadPort,
  CertificateUploadRequest,
  CertificateFormat,
  OcrExtractionResult,
  CertificateMatchResult,
  ProcessedCertificate,
} from './certificate-upload.port';
