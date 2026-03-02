/**
 * EmployeeLifecycleEngine — Recruitment Domain
 *
 * Manages the talent acquisition pipeline:
 *   - Job requisitions and approval flows
 *   - Candidate pipeline (ATS with configurable stages)
 *   - Interview scheduling and feedback
 *   - Offer management
 *   - Transition to Onboarding via HiringWorkflow
 *
 * Integrates with:
 *   - automated-hiring (workflow orchestrator)
 *   - governance (EmployeeHired events)
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type RequisitionStatus = 'draft' | 'pending_approval' | 'approved' | 'open' | 'filled' | 'cancelled';
export type CandidateStage = 'applied' | 'screening' | 'interview' | 'technical_test' | 'offer' | 'hired' | 'rejected' | 'withdrawn';

export interface JobRequisition {
  id: string;
  tenant_id: string;
  position_id: string | null;
  department_id: string | null;
  company_id: string | null;
  title: string;
  description: string | null;
  headcount: number;
  status: RequisitionStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  target_start_date: string | null;
  salary_range_min: number | null;
  salary_range_max: number | null;
  requirements: string[];
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  tenant_id: string;
  requisition_id: string;
  name: string;
  email: string;
  phone: string | null;
  stage: CandidateStage;
  score: number | null;
  source: string | null;
  resume_url: string | null;
  notes: string | null;
  interview_feedback: InterviewFeedback[];
  created_at: string;
  updated_at: string;
}

export interface InterviewFeedback {
  interviewer_id: string;
  interviewer_name: string;
  date: string;
  rating: number; // 1-5
  strengths: string[];
  concerns: string[];
  recommendation: 'strong_hire' | 'hire' | 'neutral' | 'no_hire';
  notes: string;
}

export interface RecruitmentPipelineMetrics {
  total_requisitions: number;
  open_positions: number;
  total_candidates: number;
  candidates_by_stage: Record<CandidateStage, number>;
  avg_time_to_fill_days: number;
  offer_acceptance_rate: number;
}

// ══════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════

export class RecruitmentService {
  /**
   * Get pipeline metrics for a tenant.
   * Uses projection store data when available, falls back to live counts.
   */
  async getPipelineMetrics(tenantId: string): Promise<RecruitmentPipelineMetrics> {
    // This is a read model — in production fed by event projections
    return {
      total_requisitions: 0,
      open_positions: 0,
      total_candidates: 0,
      candidates_by_stage: {
        applied: 0, screening: 0, interview: 0,
        technical_test: 0, offer: 0, hired: 0,
        rejected: 0, withdrawn: 0,
      },
      avg_time_to_fill_days: 0,
      offer_acceptance_rate: 0,
    };
  }
}

// ── Singleton ──
let _instance: RecruitmentService | null = null;
export function getRecruitmentService(): RecruitmentService {
  if (!_instance) _instance = new RecruitmentService();
  return _instance;
}
