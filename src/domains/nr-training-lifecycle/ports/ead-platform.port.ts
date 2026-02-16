/**
 * EAD Platform Port — Future
 *
 * Contract for integrating with online training platforms
 * for NR-specific EAD courses (video, quizzes, assessments).
 *
 * Capabilities:
 *   - Launch SCORM/xAPI content
 *   - Track time-on-task (carga horária EAD)
 *   - Record quiz/assessment results
 *   - Issue completion certificates
 *   - Support NR EAD requirements (e.g. NR-1 Anexo II)
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type EadContentType = 'scorm_1_2' | 'scorm_2004' | 'xapi' | 'video' | 'quiz' | 'document';

export interface EadCourseModule {
  module_id: string;
  title: string;
  content_type: EadContentType;
  duration_minutes: number;
  is_mandatory: boolean;
  order: number;
  passing_score: number | null;
}

export interface EadCourse {
  external_id: string;
  name: string;
  nr_number: number | null;
  total_hours: number;
  modules: EadCourseModule[];
  requires_final_assessment: boolean;
  minimum_score: number; // 0-100
  /** NR-1 Anexo II: requires live interaction with instructor */
  requires_live_session: boolean;
  certificate_template_id: string | null;
}

export interface EadLearnerProgress {
  learner_id: string;
  course_external_id: string;
  modules_completed: string[];
  total_time_minutes: number;
  current_module_id: string | null;
  assessment_score: number | null;
  assessment_passed: boolean | null;
  /** Tracks individual session logs for audit (NR-1 compliance) */
  session_logs: EadSessionLog[];
  status: 'not_started' | 'in_progress' | 'assessment_pending' | 'completed' | 'failed';
}

export interface EadSessionLog {
  session_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  module_id: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface EadCertificate {
  certificate_id: string;
  course_external_id: string;
  learner_id: string;
  issued_at: string;
  expires_at: string | null;
  pdf_url: string;
  validation_code: string;
  total_hours: number;
  score: number;
}

// ═══════════════════════════════════════════════════════
// PORT
// ═══════════════════════════════════════════════════════

export interface EadPlatformPort {
  readonly slug: string;
  readonly displayName: string;

  /** List available EAD courses for NR trainings */
  listCourses(filters?: { nr_number?: number }): Promise<EadCourse[]>;

  /** Launch a course session for an employee */
  launchSession(params: {
    course_external_id: string;
    employee_email: string;
    employee_name: string;
    return_url: string;
  }): Promise<{ launch_url: string; session_id: string }>;

  /** Get learner progress */
  getProgress(courseId: string, learnerId: string): Promise<EadLearnerProgress>;

  /** Issue certificate after completion */
  issueCertificate(courseId: string, learnerId: string): Promise<EadCertificate>;

  /** Validate an existing certificate by code */
  validateCertificate(validationCode: string): Promise<{ valid: boolean; certificate: EadCertificate | null }>;

  /** Health check */
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}

// ═══════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════

const eadRegistry = new Map<string, EadPlatformPort>();

export const eadPlatformRegistry = {
  register(adapter: EadPlatformPort): void {
    eadRegistry.set(adapter.slug, adapter);
  },
  get(slug: string): EadPlatformPort | undefined {
    return eadRegistry.get(slug);
  },
  list(): EadPlatformPort[] {
    return Array.from(eadRegistry.values());
  },
  has(slug: string): boolean {
    return eadRegistry.has(slug);
  },
};
