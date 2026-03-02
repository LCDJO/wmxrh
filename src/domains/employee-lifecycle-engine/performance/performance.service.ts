/**
 * EmployeeLifecycleEngine — Performance Domain
 *
 * Manages performance evaluation cycles:
 *   - Review cycles (90°, 180°, 360°)
 *   - Goal setting and tracking (OKRs / KPIs)
 *   - Continuous feedback
 *   - Competency assessments
 *   - Performance calibration
 *   - PIP (Performance Improvement Plans)
 *
 * Integrates with:
 *   - governance (PerformanceReviewCompleted events)
 *   - organizational-intelligence (performance summary projections)
 */

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

export class PerformanceService {
  async getMetrics(tenantId: string): Promise<PerformanceMetrics> {
    return {
      active_cycles: 0,
      avg_score: 0,
      completion_rate: 0,
      top_performers_count: 0,
      improvement_plans_count: 0,
      goals_completion_rate: 0,
    };
  }
}

let _instance: PerformanceService | null = null;
export function getPerformanceService(): PerformanceService {
  if (!_instance) _instance = new PerformanceService();
  return _instance;
}
