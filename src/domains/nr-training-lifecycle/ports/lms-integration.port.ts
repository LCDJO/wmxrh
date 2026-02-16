/**
 * LMS Integration Port — Future
 *
 * Contract for integrating with Learning Management Systems
 * (e.g. Moodle, Totara, TalentLMS, Alura, SENAI).
 *
 * Capabilities:
 *   - Sync course catalog ↔ NR training catalog
 *   - Auto-enroll employees in required courses
 *   - Track progress in real-time
 *   - Auto-complete assignments on course completion
 *   - Pull completion certificates
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface LmsCourse {
  external_id: string;
  name: string;
  description: string | null;
  nr_number: number | null;
  workload_hours: number;
  modality: 'online' | 'presencial' | 'hibrido';
  url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export interface LmsEnrollment {
  external_enrollment_id: string;
  course_external_id: string;
  learner_external_id: string;
  status: 'enrolled' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  progress_pct: number; // 0-100
  started_at: string | null;
  completed_at: string | null;
  score: number | null;
  certificate_url: string | null;
}

export interface LmsWebhookPayload {
  event_type: 'enrollment_created' | 'progress_updated' | 'course_completed' | 'certificate_issued';
  timestamp: string;
  course_external_id: string;
  learner_external_id: string;
  data: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════
// PORT
// ═══════════════════════════════════════════════════════

export interface LmsIntegrationPort {
  readonly slug: string;
  readonly displayName: string;

  /** Sync course catalog from LMS */
  syncCourses(): Promise<LmsCourse[]>;

  /** Enroll an employee in a course */
  enrollEmployee(params: {
    course_external_id: string;
    employee_email: string;
    employee_name: string;
    employee_cpf?: string;
  }): Promise<LmsEnrollment>;

  /** Check enrollment progress */
  getEnrollmentProgress(enrollmentId: string): Promise<LmsEnrollment>;

  /** Bulk check progress for multiple employees */
  batchCheckProgress(enrollmentIds: string[]): Promise<LmsEnrollment[]>;

  /** Parse incoming webhook from LMS */
  parseWebhook(headers: Record<string, string>, body: unknown): LmsWebhookPayload;

  /** Health check */
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}

// ═══════════════════════════════════════════════════════
// REGISTRY (same pattern as training-provider)
// ═══════════════════════════════════════════════════════

const lmsRegistry = new Map<string, LmsIntegrationPort>();

export const lmsIntegrationRegistry = {
  register(adapter: LmsIntegrationPort): void {
    lmsRegistry.set(adapter.slug, adapter);
  },
  get(slug: string): LmsIntegrationPort | undefined {
    return lmsRegistry.get(slug);
  },
  list(): LmsIntegrationPort[] {
    return Array.from(lmsRegistry.values());
  },
  has(slug: string): boolean {
    return lmsRegistry.has(slug);
  },
};
