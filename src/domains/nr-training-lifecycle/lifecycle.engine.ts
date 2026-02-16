/**
 * NR Training Lifecycle Engine — Core Engine
 *
 * Pure business logic for lifecycle transitions,
 * expiry detection, blocking rules, and renewal scheduling.
 * No I/O — all persistence delegated to the service layer.
 */

import type {
  TrainingAssignment,
  TrainingCompletion,
  TrainingLifecycleStatus,
  BlockingLevel,
  RenewalForecast,
  EmployeeTrainingCompliance,
  CompanyTrainingCompliance,
  TrainingDashboardStats,
} from './types';

// ═══════════════════════════════════════════════════════
// LIFECYCLE TRANSITION RULES
// ═══════════════════════════════════════════════════════

const VALID_TRANSITIONS: Record<TrainingLifecycleStatus, TrainingLifecycleStatus[]> = {
  pending:     ['scheduled', 'in_progress', 'cancelled', 'waived'],
  scheduled:   ['in_progress', 'cancelled', 'pending'],
  in_progress: ['completed', 'cancelled'],
  completed:   ['expired'],
  expired:     ['pending', 'blocked'],  // pending = renewal created
  overdue:     ['in_progress', 'completed', 'cancelled', 'blocked', 'waived'],
  blocked:     ['pending', 'cancelled'],  // pending = unblock via new training
  cancelled:   [],
  waived:      ['pending'],  // can be re-required
};

export function canTransition(
  from: TrainingLifecycleStatus,
  to: TrainingLifecycleStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ═══════════════════════════════════════════════════════
// BLOCKING RULES
// ═══════════════════════════════════════════════════════

/** NRs that mandate hard blocking (cannot exercise function) */
const HARD_BLOCK_NRS = new Set([10, 33, 35]); // Eletricidade, Espaço Confinado, Altura

/** NRs that mandate soft blocking (restricted activities) */
const SOFT_BLOCK_NRS = new Set([6, 11, 12, 18, 32]); // EPI, Empilhadeira, Máquinas, Construção, Saúde

export function computeBlockingLevel(
  nrNumber: number,
  status: TrainingLifecycleStatus,
): BlockingLevel {
  if (status !== 'expired' && status !== 'overdue') return 'none';

  if (HARD_BLOCK_NRS.has(nrNumber)) return 'hard_block';
  if (SOFT_BLOCK_NRS.has(nrNumber)) return 'soft_block';
  return 'warning';
}

export function getBlockingDescription(level: BlockingLevel, nrNumber: number): string {
  switch (level) {
    case 'hard_block':
      return `Colaborador impedido de exercer função — treinamento NR-${nrNumber} vencido/não realizado. Exposição a acidente grave.`;
    case 'soft_block':
      return `Colaborador com restrição de atividades de risco — treinamento NR-${nrNumber} vencido/não realizado.`;
    case 'warning':
      return `Alerta: treinamento NR-${nrNumber} vencido. Regularizar com urgência.`;
    default:
      return '';
  }
}

// ═══════════════════════════════════════════════════════
// EXPIRY DETECTION
// ═══════════════════════════════════════════════════════

export function computeExpiryDate(
  completedAt: string,
  validityMonths: number | null,
): string | null {
  if (!validityMonths) return null;
  const date = new Date(completedAt);
  date.setMonth(date.getMonth() + validityMonths);
  return date.toISOString().split('T')[0];
}

export function isExpired(expiresAt: string | null, referenceDate: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) <= new Date(referenceDate);
}

export function isOverdue(dueDate: string | null, referenceDate: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(referenceDate);
}

export function daysUntilExpiry(expiresAt: string | null, referenceDate: string): number {
  if (!expiresAt) return Infinity;
  const diff = new Date(expiresAt).getTime() - new Date(referenceDate).getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getRenewalUrgency(
  daysRemaining: number,
): 'normal' | 'soon' | 'urgent' | 'overdue' {
  if (daysRemaining <= 0) return 'overdue';
  if (daysRemaining <= 30) return 'urgent';
  if (daysRemaining <= 60) return 'soon';
  return 'normal';
}

// ═══════════════════════════════════════════════════════
// RENEWAL FORECASTING
// ═══════════════════════════════════════════════════════

export function buildRenewalForecast(
  assignment: TrainingAssignment,
  completion: TrainingCompletion | null,
  employeeName: string,
  referenceDate: string,
): RenewalForecast | null {
  if (!completion?.expires_at) return null;
  if (assignment.status === 'cancelled' || assignment.status === 'waived') return null;

  const days = daysUntilExpiry(completion.expires_at, referenceDate);

  return {
    assignment_id: assignment.id,
    employee_id: assignment.employee_id,
    employee_name: employeeName,
    training_name: assignment.training_name,
    nr_number: assignment.nr_number,
    current_expiry: completion.expires_at,
    days_until_expiry: days,
    renewal_urgency: getRenewalUrgency(days),
    estimated_cost: estimateTrainingCost(assignment.nr_number, assignment.required_hours),
  };
}

function estimateTrainingCost(nrNumber: number, hours: number): number {
  // Estimated cost per hour by NR complexity
  const costPerHour: Record<number, number> = {
    1: 50, 5: 80, 6: 40, 7: 60, 9: 60,
    10: 150, 11: 120, 12: 100, 15: 80, 16: 80,
    17: 60, 18: 100, 20: 200, 32: 100, 33: 180, 35: 150,
  };
  return (costPerHour[nrNumber] ?? 80) * hours;
}

// ═══════════════════════════════════════════════════════
// COMPLIANCE COMPUTATION
// ═══════════════════════════════════════════════════════

export function computeEmployeeCompliance(
  employeeId: string,
  employeeName: string,
  assignments: TrainingAssignment[],
): EmployeeTrainingCompliance {
  const mine = assignments.filter(a => a.employee_id === employeeId);
  const completed = mine.filter(a => a.status === 'completed').length;
  const pending = mine.filter(a => a.status === 'pending' || a.status === 'scheduled' || a.status === 'in_progress').length;
  const overdue = mine.filter(a => a.status === 'overdue').length;
  const expired = mine.filter(a => a.status === 'expired').length;
  const blocked = mine.filter(a => a.status === 'blocked');
  const total = mine.filter(a => a.status !== 'cancelled' && a.status !== 'waived').length;

  // Find next expiry
  const expiringAssignments = mine
    .filter(a => a.status === 'completed' && a.validity_months)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));

  return {
    employee_id: employeeId,
    employee_name: employeeName,
    total_required: total,
    completed,
    pending,
    overdue,
    expired,
    blocked: blocked.length > 0,
    blocking_trainings: blocked.map(a => `NR-${a.nr_number}: ${a.training_name}`),
    compliance_rate: total > 0 ? Math.round((completed / total) * 100) : 100,
    next_expiry_date: expiringAssignments[0]?.due_date ?? null,
    next_expiry_training: expiringAssignments[0]?.training_name ?? null,
  };
}

export function computeDashboardStats(
  assignments: TrainingAssignment[],
  referenceDate: string,
): TrainingDashboardStats {
  const active = assignments.filter(a => a.status !== 'cancelled' && a.status !== 'waived');

  const byStatus = {} as Record<TrainingLifecycleStatus, number>;
  const allStatuses: TrainingLifecycleStatus[] = ['pending','scheduled','in_progress','completed','expired','overdue','blocked','cancelled','waived'];
  for (const s of allStatuses) byStatus[s] = 0;
  for (const a of assignments) byStatus[a.status] = (byStatus[a.status] || 0) + 1;

  const completedAssignments = active.filter(a => a.status === 'completed');
  const total = active.length;
  const complianceRate = total > 0 ? Math.round((completedAssignments.length / total) * 100) : 100;

  const blockedEmployees = new Set(
    active.filter(a => a.status === 'blocked').map(a => a.employee_id),
  ).size;

  // Expiring counts (need completion data, approximate from due_date)
  const ref = new Date(referenceDate);
  const in30d = new Date(ref); in30d.setDate(in30d.getDate() + 30);
  const in60d = new Date(ref); in60d.setDate(in60d.getDate() + 60);
  const in90d = new Date(ref); in90d.setDate(in90d.getDate() + 90);

  const expiring = completedAssignments.filter(a => a.due_date);
  const expiring30 = expiring.filter(a => a.due_date && new Date(a.due_date) <= in30d).length;
  const expiring60 = expiring.filter(a => a.due_date && new Date(a.due_date) <= in60d).length;
  const expiring90 = expiring.filter(a => a.due_date && new Date(a.due_date) <= in90d).length;

  // Top pending NRs
  const nrCounts = new Map<number, number>();
  for (const a of active.filter(a => a.status === 'pending' || a.status === 'overdue')) {
    nrCounts.set(a.nr_number, (nrCounts.get(a.nr_number) ?? 0) + 1);
  }
  const topPending = [...nrCounts.entries()]
    .map(([nr_number, count]) => ({ nr_number, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total_assignments: assignments.length,
    by_status: byStatus,
    compliance_rate: complianceRate,
    blocked_employees: blockedEmployees,
    expiring_30d: expiring30,
    expiring_60d: expiring60,
    expiring_90d: expiring90,
    overdue_count: byStatus.overdue,
    total_hours_required: active.reduce((s, a) => s + a.required_hours, 0),
    total_hours_completed: completedAssignments.reduce((s, a) => s + a.required_hours, 0),
    top_pending_nrs: topPending,
  };
}
