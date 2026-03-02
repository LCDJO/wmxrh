/**
 * EmployeeLifecycleEngine — Development Domain
 *
 * Manages employee growth and career development:
 *   - Individual Development Plans (PDI)
 *   - Skill matrix and gap analysis
 *   - Training recommendations
 *   - Career path mapping
 *   - Succession planning
 *   - Mentorship programs
 *
 * Integrates with:
 *   - performance (feeds from review outcomes)
 *   - governance (DevelopmentPlanCreated events)
 *   - career-intelligence (career path data)
 */

export type DevelopmentPlanStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type SkillProficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type ActionItemStatus = 'not_started' | 'in_progress' | 'completed' | 'cancelled';

export interface DevelopmentPlan {
  id: string;
  tenant_id: string;
  employee_id: string;
  title: string;
  description: string | null;
  status: DevelopmentPlanStatus;
  objectives: DevelopmentObjective[];
  action_items: DevelopmentActionItem[];
  mentor_id: string | null;
  review_id: string | null;
  start_date: string;
  target_date: string;
  completed_at: string | null;
  progress_percentage: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DevelopmentObjective {
  id: string;
  title: string;
  description: string | null;
  target_skill: string | null;
  target_proficiency: SkillProficiency | null;
  weight: number;
  is_achieved: boolean;
}

export interface DevelopmentActionItem {
  id: string;
  objective_id: string;
  title: string;
  description: string | null;
  action_type: 'training' | 'course' | 'mentoring' | 'project' | 'certification' | 'reading' | 'other';
  status: ActionItemStatus;
  due_date: string | null;
  completed_at: string | null;
  evidence_url: string | null;
}

export interface SkillAssessment {
  id: string;
  tenant_id: string;
  employee_id: string;
  skill_name: string;
  category: string;
  current_level: SkillProficiency;
  target_level: SkillProficiency | null;
  assessed_at: string;
  assessed_by: string;
}

export interface DevelopmentMetrics {
  active_plans: number;
  avg_progress: number;
  completed_plans_rate: number;
  skills_gap_count: number;
  mentorship_active: number;
}

// ══════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════

export class DevelopmentService {
  async getMetrics(tenantId: string): Promise<DevelopmentMetrics> {
    return {
      active_plans: 0,
      avg_progress: 0,
      completed_plans_rate: 0,
      skills_gap_count: 0,
      mentorship_active: 0,
    };
  }
}

let _instance: DevelopmentService | null = null;
export function getDevelopmentService(): DevelopmentService {
  if (!_instance) _instance = new DevelopmentService();
  return _instance;
}
