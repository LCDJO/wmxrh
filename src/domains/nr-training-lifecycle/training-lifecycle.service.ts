/**
 * NR Training Lifecycle Engine — Service Layer
 *
 * Persistence and orchestration for training assignments,
 * completions, and lifecycle transitions.
 * All mutations emit domain events and create audit trail entries.
 */

import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope } from '@/domains/shared/scoped-query';
import type {
  TrainingAssignment,
  TrainingCompletion,
  TrainingLifecycleEvent as LifecycleAuditEntry,
  CreateAssignmentDTO,
  RecordCompletionDTO,
  WaiveTrainingDTO,
  TrainingLifecycleStatus,
} from './types';
import {
  canTransition,
  computeBlockingLevel,
  computeExpiryDate,
  isExpired,
  isOverdue,
} from './lifecycle.engine';
import { trainingLifecycleEvents } from './events';

// Helper to bypass strict table typing for new tables not yet in generated types
const db = () => supabase as any;
const ASSIGNMENTS = 'nr_training_assignments';
const COMPLETIONS = 'nr_training_completions';
const AUDIT = 'nr_training_audit_log';

export const trainingLifecycleService = {

  async createAssignment(dto: CreateAssignmentDTO): Promise<TrainingAssignment> {
    const payload = {
      tenant_id: dto.tenant_id,
      company_id: dto.company_id ?? null,
      company_group_id: dto.company_group_id ?? null,
      employee_id: dto.employee_id,
      nr_number: dto.nr_number,
      training_name: dto.training_name,
      cbo_code: dto.cbo_code ?? null,
      status: 'pending',
      trigger: dto.trigger,
      required_hours: dto.required_hours,
      due_date: dto.due_date ?? null,
      blocking_level: 'none',
      is_renewal: !!dto.previous_assignment_id,
      previous_assignment_id: dto.previous_assignment_id ?? null,
      renewal_number: dto.renewal_number ?? 0,
      legal_basis: dto.legal_basis ?? null,
      validity_months: dto.validity_months ?? null,
    };

    const { data, error } = await db().from(ASSIGNMENTS).insert([payload]).select().single();
    if (error) throw error;
    const assignment = data as TrainingAssignment;

    await this.logTransition(assignment, null, 'pending', null, `Created via ${dto.trigger}`);
    trainingLifecycleEvents.emit({
      type: 'TrainingAssigned',
      payload: { assignment, trigger_source: dto.trigger },
    });

    return assignment;
  },

  async createBulkAssignments(dtos: CreateAssignmentDTO[]): Promise<TrainingAssignment[]> {
    if (dtos.length === 0) return [];

    const payloads = dtos.map(dto => ({
      tenant_id: dto.tenant_id,
      company_id: dto.company_id ?? null,
      company_group_id: dto.company_group_id ?? null,
      employee_id: dto.employee_id,
      nr_number: dto.nr_number,
      training_name: dto.training_name,
      cbo_code: dto.cbo_code ?? null,
      status: 'pending',
      trigger: dto.trigger,
      required_hours: dto.required_hours,
      due_date: dto.due_date ?? null,
      blocking_level: 'none',
      is_renewal: !!dto.previous_assignment_id,
      previous_assignment_id: dto.previous_assignment_id ?? null,
      renewal_number: dto.renewal_number ?? 0,
      legal_basis: dto.legal_basis ?? null,
      validity_months: dto.validity_months ?? null,
    }));

    const { data, error } = await db().from(ASSIGNMENTS).insert(payloads).select();
    if (error) throw error;
    const assignments = (data ?? []) as TrainingAssignment[];

    for (const a of assignments) {
      trainingLifecycleEvents.emit({
        type: 'TrainingAssigned',
        payload: { assignment: a, trigger_source: a.trigger },
      });
    }
    return assignments;
  },

  async recordCompletion(dto: RecordCompletionDTO): Promise<TrainingCompletion> {
    const { data: assignment, error: aErr } = await db().from(ASSIGNMENTS).select('*').eq('id', dto.assignment_id).single();
    if (aErr || !assignment) throw aErr ?? new Error('Assignment not found');

    const a = assignment as TrainingAssignment;
    if (!canTransition(a.status, 'completed') && a.status !== 'overdue') {
      throw new Error(`Cannot complete from status: ${a.status}`);
    }

    const expiresAt = computeExpiryDate(dto.completed_at, a.validity_months);

    const { data: completion, error: cErr } = await db().from(COMPLETIONS).insert([{
      tenant_id: a.tenant_id,
      assignment_id: dto.assignment_id,
      employee_id: a.employee_id,
      completed_at: dto.completed_at,
      expires_at: expiresAt,
      hours_completed: dto.hours_completed,
      instructor_name: dto.instructor_name ?? null,
      provider_name: dto.provider_name ?? null,
      certificate_number: dto.certificate_number ?? null,
      certificate_url: dto.certificate_url ?? null,
      score: dto.score ?? null,
      passed: dto.passed ?? true,
      location: dto.location ?? null,
      methodology: dto.methodology ?? null,
      observations: dto.observations ?? null,
      registered_by: dto.registered_by ?? null,
    }]).select().single();
    if (cErr) throw cErr;

    await db().from(ASSIGNMENTS).update({
      status: 'completed',
      blocking_level: 'none',
      due_date: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq('id', dto.assignment_id);

    await this.logTransition(a, a.status, 'completed', dto.registered_by ?? null, 'Training completed');

    trainingLifecycleEvents.emit({
      type: 'TrainingCompleted',
      payload: {
        assignment_id: dto.assignment_id,
        employee_id: a.employee_id,
        completion: completion as TrainingCompletion,
        expires_at: expiresAt,
      },
    });

    return completion as TrainingCompletion;
  },

  async transitionStatus(
    assignmentId: string,
    toStatus: TrainingLifecycleStatus,
    performedBy: string | null,
    reason: string | null,
  ): Promise<void> {
    const { data, error } = await db().from(ASSIGNMENTS).select('*').eq('id', assignmentId).single();
    if (error || !data) throw error ?? new Error('Not found');

    const a = data as TrainingAssignment;
    if (!canTransition(a.status, toStatus)) {
      throw new Error(`Invalid transition: ${a.status} → ${toStatus}`);
    }

    const blockingLevel = computeBlockingLevel(a.nr_number, toStatus);
    await db().from(ASSIGNMENTS).update({ status: toStatus, blocking_level: blockingLevel, updated_at: new Date().toISOString() }).eq('id', assignmentId);
    await this.logTransition(a, a.status, toStatus, performedBy, reason);

    trainingLifecycleEvents.emit({
      type: 'TrainingStatusChanged',
      payload: { assignment_id: assignmentId, employee_id: a.employee_id, from_status: a.status, to_status: toStatus, reason },
    });

    if (blockingLevel === 'hard_block' || blockingLevel === 'soft_block') {
      trainingLifecycleEvents.emit({
        type: 'TrainingBlocked',
        payload: { assignment_id: assignmentId, employee_id: a.employee_id, training_name: a.training_name, nr_number: a.nr_number, blocking_level: blockingLevel, reason: reason ?? 'Training expired or overdue' },
      });
    }
  },

  async waiveTraining(dto: WaiveTrainingDTO): Promise<void> {
    const { data } = await db().from(ASSIGNMENTS).select('*').eq('id', dto.assignment_id).single();
    if (data) {
      const a = data as TrainingAssignment;
      await db().from(ASSIGNMENTS).update({ status: 'waived', blocking_level: 'none', waiver_reason: dto.reason, waiver_approved_by: dto.approved_by, updated_at: new Date().toISOString() }).eq('id', dto.assignment_id);
      await this.logTransition(a, a.status, 'waived', dto.approved_by, dto.reason);
    }
  },

  async scanAndUpdateExpired(tenantId: string, referenceDate: string): Promise<{ expired: number; overdue: number; blocked: number }> {
    let expiredCount = 0, overdueCount = 0, blockedCount = 0;

    const { data: completed } = await db().from(ASSIGNMENTS).select('*').eq('tenant_id', tenantId).eq('status', 'completed');
    for (const row of (completed ?? [])) {
      const a = row as TrainingAssignment;
      if (a.due_date && isExpired(a.due_date, referenceDate)) {
        const blocking = computeBlockingLevel(a.nr_number, 'expired');
        await db().from(ASSIGNMENTS).update({ status: 'expired', blocking_level: blocking, updated_at: new Date().toISOString() }).eq('id', a.id);
        expiredCount++;
        if (blocking !== 'none') blockedCount++;
        await this.logTransition(a, 'completed', 'expired', null, 'Auto-expired by lifecycle scan');
        trainingLifecycleEvents.emit({ type: 'TrainingExpired', payload: { assignment_id: a.id, employee_id: a.employee_id, training_name: a.training_name, nr_number: a.nr_number, expired_at: referenceDate, blocking_level: blocking } });
      }
    }

    const { data: pending } = await db().from(ASSIGNMENTS).select('*').eq('tenant_id', tenantId).in('status', ['pending', 'scheduled']);
    for (const row of (pending ?? [])) {
      const a = row as TrainingAssignment;
      if (a.due_date && isOverdue(a.due_date, referenceDate)) {
        const blocking = computeBlockingLevel(a.nr_number, 'overdue');
        await db().from(ASSIGNMENTS).update({ status: 'overdue', blocking_level: blocking, updated_at: new Date().toISOString() }).eq('id', a.id);
        overdueCount++;
        if (blocking !== 'none') blockedCount++;
        await this.logTransition(a, a.status, 'overdue', null, 'Auto-overdue by lifecycle scan');
      }
    }

    return { expired: expiredCount, overdue: overdueCount, blocked: blockedCount };
  },

  async createRenewal(expiredAssignment: TrainingAssignment): Promise<TrainingAssignment> {
    return this.createAssignment({
      tenant_id: expiredAssignment.tenant_id,
      company_id: expiredAssignment.company_id,
      company_group_id: expiredAssignment.company_group_id,
      employee_id: expiredAssignment.employee_id,
      nr_number: expiredAssignment.nr_number,
      training_name: expiredAssignment.training_name,
      cbo_code: expiredAssignment.cbo_code,
      trigger: 'renewal',
      required_hours: expiredAssignment.required_hours,
      validity_months: expiredAssignment.validity_months,
      legal_basis: expiredAssignment.legal_basis,
      previous_assignment_id: expiredAssignment.id,
      renewal_number: expiredAssignment.renewal_number + 1,
    });
  },

  async listByEmployee(employeeId: string, scope: QueryScope): Promise<TrainingAssignment[]> {
    const q = applyScope(db().from(ASSIGNMENTS).select('*').eq('employee_id', employeeId), scope);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as TrainingAssignment[];
  },

  async listByCompany(companyId: string, scope: QueryScope): Promise<TrainingAssignment[]> {
    const q = applyScope(db().from(ASSIGNMENTS).select('*').eq('company_id', companyId), scope);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as TrainingAssignment[];
  },

  async listAll(scope: QueryScope): Promise<TrainingAssignment[]> {
    const q = applyScope(db().from(ASSIGNMENTS).select('*'), scope);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as TrainingAssignment[];
  },

  async getCompletions(assignmentId: string): Promise<TrainingCompletion[]> {
    const { data, error } = await db().from(COMPLETIONS).select('*').eq('assignment_id', assignmentId).order('completed_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as TrainingCompletion[];
  },

  async getAuditTrail(assignmentId: string): Promise<LifecycleAuditEntry[]> {
    const { data, error } = await db().from(AUDIT).select('*').eq('assignment_id', assignmentId).order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as LifecycleAuditEntry[];
  },

  async logTransition(
    assignment: TrainingAssignment,
    fromStatus: TrainingLifecycleStatus | null,
    toStatus: TrainingLifecycleStatus,
    performedBy: string | null,
    reason: string | null,
  ): Promise<void> {
    await db().from(AUDIT).insert([{
      tenant_id: assignment.tenant_id,
      assignment_id: assignment.id,
      employee_id: assignment.employee_id,
      from_status: fromStatus,
      to_status: toStatus,
      performed_by: performedBy,
      reason,
      metadata: { nr_number: assignment.nr_number, training_name: assignment.training_name, blocking_level: assignment.blocking_level },
    }]);
  },
};
