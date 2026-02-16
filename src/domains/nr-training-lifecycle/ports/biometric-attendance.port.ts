/**
 * Biometric Attendance Validation Port — Future
 *
 * Contract for integrating with biometric presence validation
 * devices and services for in-person NR trainings.
 *
 * Capabilities:
 *   - Validate physical presence via biometrics (fingerprint, facial)
 *   - Record check-in/check-out for training sessions
 *   - Compute effective attendance hours
 *   - Generate proof-of-presence for labor audit
 *   - Anti-fraud: prevent proxy attendance
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type BiometricMethod = 'fingerprint' | 'facial_recognition' | 'iris' | 'palm' | 'voice';

export interface BiometricDevice {
  device_id: string;
  name: string;
  location: string;
  method: BiometricMethod;
  is_online: boolean;
  firmware_version: string | null;
  last_sync_at: string | null;
}

export interface AttendanceRecord {
  record_id: string;
  session_id: string;
  employee_id: string;
  employee_cpf: string;
  device_id: string;
  method: BiometricMethod;
  /** Check-in timestamp */
  checked_in_at: string;
  /** Check-out timestamp (null if not yet checked out) */
  checked_out_at: string | null;
  /** Effective duration in minutes */
  duration_minutes: number | null;
  /** Biometric confidence score 0-1 */
  confidence: number;
  /** Whether identity was successfully verified */
  verified: boolean;
  /** Anti-fraud flags */
  fraud_flags: string[];
  /** Photo captured during validation (URL in blob storage) */
  capture_url: string | null;
  /** GPS coordinates of the device at time of scan */
  geo_lat: number | null;
  geo_lng: number | null;
}

export interface TrainingSession {
  session_id: string;
  training_assignment_id: string;
  nr_number: number;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  location: string;
  instructor_name: string;
  expected_employees: string[]; // employee_ids
  device_ids: string[];
}

export interface AttendanceSummary {
  session_id: string;
  total_expected: number;
  total_present: number;
  total_absent: number;
  total_late: number;
  average_duration_minutes: number;
  attendance_rate: number; // 0-100
  records: AttendanceRecord[];
}

export interface PresenceProof {
  proof_id: string;
  session_id: string;
  employee_id: string;
  /** SHA-256 hash of biometric + session data for tamper-proof audit */
  integrity_hash: string;
  generated_at: string;
  /** Signed PDF for legal compliance */
  proof_pdf_url: string | null;
}

// ═══════════════════════════════════════════════════════
// PORT
// ═══════════════════════════════════════════════════════

export interface BiometricAttendancePort {
  readonly slug: string;
  readonly displayName: string;

  /** List registered biometric devices */
  listDevices(): Promise<BiometricDevice[]>;

  /** Register a training session for attendance tracking */
  registerSession(session: TrainingSession): Promise<{ session_id: string }>;

  /** Record a biometric check-in */
  checkIn(params: {
    session_id: string;
    employee_cpf: string;
    device_id: string;
    biometric_data?: unknown;
  }): Promise<AttendanceRecord>;

  /** Record a biometric check-out */
  checkOut(params: {
    record_id: string;
    device_id: string;
    biometric_data?: unknown;
  }): Promise<AttendanceRecord>;

  /** Get attendance summary for a session */
  getSessionAttendance(sessionId: string): Promise<AttendanceSummary>;

  /** Generate tamper-proof presence proof */
  generatePresenceProof(sessionId: string, employeeId: string): Promise<PresenceProof>;

  /** Health check */
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}

// ═══════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════

const biometricRegistry = new Map<string, BiometricAttendancePort>();

export const biometricAttendanceRegistry = {
  register(adapter: BiometricAttendancePort): void {
    biometricRegistry.set(adapter.slug, adapter);
  },
  get(slug: string): BiometricAttendancePort | undefined {
    return biometricRegistry.get(slug);
  },
  list(): BiometricAttendancePort[] {
    return Array.from(biometricRegistry.values());
  },
  has(slug: string): boolean {
    return biometricRegistry.has(slug);
  },
};
