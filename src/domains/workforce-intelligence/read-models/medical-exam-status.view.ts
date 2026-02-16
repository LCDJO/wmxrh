/**
 * MedicalExamStatusView — Read Model
 *
 * Flat projection of an employee's medical exam status (PCMSO),
 * consumed by the Workforce Intelligence Engine for compliance analysis.
 */

export type ExamStatus = 'valid' | 'expiring_soon' | 'overdue' | 'no_exam';

export interface MedicalExamStatusView {
  employee_id: string;
  employee_name?: string;
  company_id?: string;
  last_exam_date: string | null;
  last_exam_type: string | null;
  last_exam_result: string | null;
  next_exam_date: string | null;
  days_until_due: number | null;
  status: ExamStatus;
  health_program_name: string | null;
  has_valid_exam: boolean;
  is_overdue: boolean;
}

/** Build from pcmso_exam_alerts view row or raw exam data */
export function toMedicalExamStatusView(raw: {
  employee_id: string;
  employee_name?: string;
  company_id?: string;
  exam_date?: string | null;
  exam_type?: string | null;
  result?: string | null;
  next_exam_date?: string | null;
  days_until_due?: number | null;
  alert_status?: string | null;
  program_name?: string | null;
}): MedicalExamStatusView {
  const alertStatus = raw.alert_status ?? 'no_exam';
  const status: ExamStatus =
    alertStatus === 'overdue' ? 'overdue'
    : alertStatus === 'expiring_soon' ? 'expiring_soon'
    : alertStatus === 'ok' || alertStatus === 'upcoming' ? 'valid'
    : 'no_exam';

  return {
    employee_id: raw.employee_id,
    employee_name: raw.employee_name,
    company_id: raw.company_id,
    last_exam_date: raw.exam_date ?? null,
    last_exam_type: raw.exam_type ?? null,
    last_exam_result: raw.result ?? null,
    next_exam_date: raw.next_exam_date ?? null,
    days_until_due: raw.days_until_due ?? null,
    status,
    health_program_name: raw.program_name ?? null,
    has_valid_exam: status === 'valid' || status === 'expiring_soon',
    is_overdue: status === 'overdue',
  };
}
