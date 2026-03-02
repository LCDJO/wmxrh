/**
 * EmployeeLifecycleEngine — Performance Domain
 *
 * Manages performance evaluation cycles (90°, 180°, 360°)
 * with immutable review history (DB trigger blocks modification after submission).
 *
 * Every completed review emits PerformanceReviewCompleted governance event.
 */

import { supabase } from '@/integrations/supabase/client';
import { GovernanceEventStore } from '@/domains/governance/repositories/governance-event-store';
import { createGovernanceEvent } from '@/domains/governance/events/governance-domain-event';
import { EMPLOYEE_LIFECYCLE_EVENTS } from '@/domains/governance/events/employee-lifecycle-events';
import type { Json } from '@/integrations/supabase/types';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type ReviewType = '90' | '180' | '360';
export type ReviewStatus = 'draft' | 'in_progress' | 'pending_calibration' | 'completed' | 'cancelled';
export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'cancelled';

export interface PerformanceReviewCycle {
  id: string;
  tenant_id: string;
  name: string;
  review_type: ReviewType;
  period_start: string;
  period_end: string;
  status: ReviewStatus;
  participants_count: number;
  completed_count: number;
  created_by: string;
  created_at: string;
}

export interface EmployeeReview {
  id: string;
  tenant_id: string;
  cycle_id: string;
  employee_id: string;
  reviewer_id: string;
  review_type: ReviewType;
  status: ReviewStatus;
  overall_score: number | null;
  competency_scores: CompetencyScore[];
  strengths: string[];
  improvement_areas: string[];
  goals_achieved: number;
  goals_total: number;
  feedback: string | null;
  submitted_at: string | null;
  calibrated_score: number | null;
}

export interface CompetencyScore {
  competency_id: string;
  competency_name: string;
  score: number; // 1-5
  weight: number;
  evidence: string | null;
}

export interface EmployeeGoal {
  id: string;
  tenant_id: string;
  employee_id: string;
  cycle_id: string | null;
  title: string;
  description: string | null;
  metric: string | null;
  target_value: number | null;
  current_value: number | null;
  status: GoalStatus;
  weight: number;
  due_date: string;
  completed_at: string | null;
}

export interface PerformanceMetrics {
  active_cycles: number;
  avg_score: number;
  completion_rate: number;
  top_performers_count: number;
  improvement_plans_count: number;
  goals_completion_rate: number;
}

// ══════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════

const eventStore = new GovernanceEventStore();

export class PerformanceService {
  // ── Cycles ──

  async createCycle(tenantId: string, data: {
    name: string; review_type: ReviewType;
    period_start: string; period_end: string; created_by: string;
  }): Promise<PerformanceReviewCycle> {
    const { data: row, error } = await supabase
      .from('performance_review_cycles')
      .insert({ tenant_id: tenantId, ...data, status: 'draft' })
      .select()
      .single();
    if (error) throw new Error(`[Performance] Cycle create failed: ${error.message}`);
    return row as unknown as PerformanceReviewCycle;
  }

  async listCycles(tenantId: string): Promise<PerformanceReviewCycle[]> {
    const { data, error } = await supabase
      .from('performance_review_cycles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`[Performance] Cycle list failed: ${error.message}`);
    return (data ?? []) as unknown as PerformanceReviewCycle[];
  }

  async updateCycleStatus(cycleId: string, status: ReviewStatus): Promise<void> {
    const { error } = await supabase
      .from('performance_review_cycles')
      .update({ status })
      .eq('id', cycleId);
    if (error) throw new Error(`[Performance] Cycle status update failed: ${error.message}`);
  }

  // ── Reviews (immutable after submission) ──

  async createReview(tenantId: string, data: {
    cycle_id: string; employee_id: string; reviewer_id: string; review_type: ReviewType;
  }): Promise<EmployeeReview> {
    const { data: row, error } = await supabase
      .from('employee_reviews')
      .insert({
        tenant_id: tenantId,
        cycle_id: data.cycle_id,
        employee_id: data.employee_id,
        reviewer_id: data.reviewer_id,
        review_type: data.review_type,
        status: 'draft',
        competency_scores: [] as unknown as Json,
        strengths: [],
        improvement_areas: [],
      })
      .select()
      .single();
    if (error) throw new Error(`[Performance] Review create failed: ${error.message}`);
    return this.mapReview(row);
  }

  async listReviews(tenantId: string, cycleId: string): Promise<EmployeeReview[]> {
    const { data, error } = await supabase
      .from('employee_reviews')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`[Performance] Review list failed: ${error.message}`);
    return (data ?? []).map(this.mapReview);
  }

  async getEmployeeHistory(tenantId: string, employeeId: string): Promise<EmployeeReview[]> {
    const { data, error } = await supabase
      .from('employee_reviews')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .eq('status', 'completed')
      .order('submitted_at', { ascending: false });
    if (error) throw new Error(`[Performance] History failed: ${error.message}`);
    return (data ?? []).map(this.mapReview);
  }

  /**
   * Submit a review — marks as completed (becomes immutable via DB trigger).
   * Emits PerformanceReviewCompleted governance event.
   */
  async submitReview(reviewId: string, data: {
    overall_score: number;
    competency_scores: CompetencyScore[];
    strengths: string[];
    improvement_areas: string[];
    goals_achieved: number;
    goals_total: number;
    feedback: string;
  }): Promise<EmployeeReview> {
    const submittedAt = new Date().toISOString();

    const { data: row, error } = await supabase
      .from('employee_reviews')
      .update({
        overall_score: data.overall_score,
        competency_scores: data.competency_scores as unknown as Json,
        strengths: data.strengths,
        improvement_areas: data.improvement_areas,
        goals_achieved: data.goals_achieved,
        goals_total: data.goals_total,
        feedback: data.feedback,
        status: 'completed',
        submitted_at: submittedAt,
      })
      .eq('id', reviewId)
      .select()
      .single();
    if (error) throw new Error(`[Performance] Submit failed: ${error.message}`);

    const review = this.mapReview(row);

    // Update cycle completed count
    try {
      const { data: cycle } = await supabase
        .from('performance_review_cycles')
        .select('completed_count')
        .eq('id', review.cycle_id)
        .single();
      if (cycle) {
        await supabase
          .from('performance_review_cycles')
          .update({ completed_count: (cycle.completed_count as number) + 1 })
          .eq('id', review.cycle_id);
      }
    } catch { /* non-critical */ }

    // Emit governance event
    await this.emitReviewCompleted(review);

    return review;
  }

  /** Calibration: only calibrated_score can be updated on completed reviews */
  async calibrate(reviewId: string, calibratedScore: number): Promise<void> {
    const { error } = await supabase
      .from('employee_reviews')
      .update({ calibrated_score: calibratedScore })
      .eq('id', reviewId);
    if (error) throw new Error(`[Performance] Calibration failed: ${error.message}`);
  }

  // ── Goals ──

  async createGoal(tenantId: string, data: {
    employee_id: string; cycle_id?: string; title: string;
    description?: string; metric?: string; target_value?: number;
    weight?: number; due_date: string;
  }): Promise<EmployeeGoal> {
    const { data: row, error } = await supabase
      .from('employee_goals')
      .insert({
        tenant_id: tenantId,
        employee_id: data.employee_id,
        cycle_id: data.cycle_id ?? null,
        title: data.title,
        description: data.description ?? null,
        metric: data.metric ?? null,
        target_value: data.target_value ?? null,
        weight: data.weight ?? 1,
        due_date: data.due_date,
        status: 'not_started',
      })
      .select()
      .single();
    if (error) throw new Error(`[Performance] Goal create failed: ${error.message}`);
    return row as unknown as EmployeeGoal;
  }

  async listGoals(tenantId: string, employeeId: string): Promise<EmployeeGoal[]> {
    const { data, error } = await supabase
      .from('employee_goals')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('due_date');
    if (error) throw new Error(`[Performance] Goal list failed: ${error.message}`);
    return (data ?? []) as unknown as EmployeeGoal[];
  }

  async updateGoalProgress(goalId: string, currentValue: number, status?: GoalStatus): Promise<void> {
    const update: Record<string, unknown> = { current_value: currentValue };
    if (status) {
      update.status = status;
      if (status === 'completed') update.completed_at = new Date().toISOString();
    }
    const { error } = await supabase.from('employee_goals').update(update).eq('id', goalId);
    if (error) throw new Error(`[Performance] Goal update failed: ${error.message}`);
  }

  // ── Metrics ──

  async getMetrics(tenantId: string): Promise<PerformanceMetrics> {
    const [cyclesRes, reviewsRes, goalsRes] = await Promise.all([
      supabase.from('performance_review_cycles').select('status').eq('tenant_id', tenantId),
      supabase.from('employee_reviews').select('status, overall_score').eq('tenant_id', tenantId),
      supabase.from('employee_goals').select('status').eq('tenant_id', tenantId),
    ]);

    const cycles = cyclesRes.data ?? [];
    const reviews = reviewsRes.data ?? [];
    const goals = goalsRes.data ?? [];

    const completed = reviews.filter(r => r.status === 'completed');
    const scores = completed.map(r => r.overall_score as number).filter(Boolean);
    const completedGoals = goals.filter(g => g.status === 'completed');

    return {
      active_cycles: cycles.filter(c => c.status === 'in_progress' || c.status === 'draft').length,
      avg_score: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      completion_rate: reviews.length > 0 ? completed.length / reviews.length : 0,
      top_performers_count: scores.filter(s => s >= 4).length,
      improvement_plans_count: scores.filter(s => s <= 2).length,
      goals_completion_rate: goals.length > 0 ? completedGoals.length / goals.length : 0,
    };
  }

  // ── Governance Events ──

  private async emitReviewCompleted(review: EmployeeReview): Promise<void> {
    const event = createGovernanceEvent({
      aggregate_type: 'employee',
      aggregate_id: review.employee_id,
      event_type: EMPLOYEE_LIFECYCLE_EVENTS.PerformanceReviewCompleted,
      payload: {
        employee_id: review.employee_id,
        review_type: review.review_type,
        score: review.overall_score,
        period_start: '',
        period_end: '',
        reviewed_by: review.reviewer_id,
        strengths: review.strengths,
        improvement_areas: review.improvement_areas,
        cycle_id: review.cycle_id,
        goals_achieved: review.goals_achieved,
        goals_total: review.goals_total,
      },
      metadata: {
        tenant_id: review.tenant_id,
        actor_id: review.reviewer_id,
        actor_type: 'user',
        source_module: 'performance_engine',
        correlation_id: `perf_review_${review.id}`,
      },
    });

    await eventStore.append([event]);
  }

  // ── Mapper ──

  private mapReview(row: Record<string, unknown>): EmployeeReview {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      cycle_id: row.cycle_id as string,
      employee_id: row.employee_id as string,
      reviewer_id: row.reviewer_id as string,
      review_type: row.review_type as ReviewType,
      status: row.status as ReviewStatus,
      overall_score: (row.overall_score as number) ?? null,
      competency_scores: (row.competency_scores as unknown as CompetencyScore[]) ?? [],
      strengths: (row.strengths as string[]) ?? [],
      improvement_areas: (row.improvement_areas as string[]) ?? [],
      goals_achieved: (row.goals_achieved as number) ?? 0,
      goals_total: (row.goals_total as number) ?? 0,
      feedback: (row.feedback as string) ?? null,
      submitted_at: (row.submitted_at as string) ?? null,
      calibrated_score: (row.calibrated_score as number) ?? null,
    };
  }
}

let _instance: PerformanceService | null = null;
export function getPerformanceService(): PerformanceService {
  if (!_instance) _instance = new PerformanceService();
  return _instance;
}
