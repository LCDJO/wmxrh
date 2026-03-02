/**
 * EmployeeLifecycleEngine — Onboarding Domain
 *
 * Manages post-hire integration:
 *   - Onboarding checklist (configurable per position/department)
 *   - Document collection tracking
 *   - Training assignment
 *   - Buddy/mentor assignment
 *   - Probation period management
 *   - 30/60/90 day check-ins
 *
 * Integrates with:
 *   - automated-hiring (receives EmployeeHired)
 *   - governance (EmployeeOnboarded, EmployeeProbationCompleted)
 *   - employee-agreement (mandatory agreements)
 */

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'cancelled';
export type ChecklistItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';

export interface OnboardingPlan {
  id: string;
  tenant_id: string;
  employee_id: string;
  template_id: string | null;
  status: OnboardingStatus;
  start_date: string;
  target_completion_date: string;
  actual_completion_date: string | null;
  buddy_id: string | null;
  mentor_id: string | null;
  checklist: OnboardingChecklistItem[];
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface OnboardingChecklistItem {
  id: string;
  category: 'documentation' | 'training' | 'access' | 'equipment' | 'integration' | 'compliance';
  title: string;
  description: string | null;
  status: ChecklistItemStatus;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  is_mandatory: boolean;
  order: number;
}

export interface OnboardingTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  position_id: string | null;
  department_id: string | null;
  items: Omit<OnboardingChecklistItem, 'id' | 'status' | 'completed_at'>[];
  is_active: boolean;
}

export interface OnboardingMetrics {
  active_onboardings: number;
  avg_completion_days: number;
  completion_rate: number;
  blocked_items_count: number;
  overdue_items_count: number;
}

// ══════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════

export class OnboardingService {
  async getMetrics(tenantId: string): Promise<OnboardingMetrics> {
    return {
      active_onboardings: 0,
      avg_completion_days: 0,
      completion_rate: 0,
      blocked_items_count: 0,
      overdue_items_count: 0,
    };
  }
}

let _instance: OnboardingService | null = null;
export function getOnboardingService(): OnboardingService {
  if (!_instance) _instance = new OnboardingService();
  return _instance;
}
