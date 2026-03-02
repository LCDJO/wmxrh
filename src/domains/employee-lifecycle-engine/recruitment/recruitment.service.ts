/**
 * EmployeeLifecycleEngine — Recruitment Domain (ATS)
 *
 * Full ATS with configurable pipeline stages:
 *   Aplicado → Triagem → Entrevista → Proposta → Contratado
 *
 * Every hire emits:
 *   - EmployeeHired governance event
 *   - LegalEventRecorded governance event (immutable legal log)
 *   - Stage transition history persisted per candidate
 */

import { supabase } from '@/integrations/supabase/client';
import { GovernanceEventStore } from '@/domains/governance/repositories/governance-event-store';
import { createGovernanceEvent } from '@/domains/governance/events/governance-domain-event';
import { EMPLOYEE_LIFECYCLE_EVENTS } from '@/domains/governance/events/employee-lifecycle-events';
import type { Json } from '@/integrations/supabase/types';

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type RequisitionStatus = 'draft' | 'pending_approval' | 'approved' | 'open' | 'filled' | 'cancelled';

/** Default stage keys — tenants can override via ats_pipeline_stages */
export type CandidateStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'withdrawn';

export const DEFAULT_PIPELINE: { stage_key: CandidateStage; label: string; sort_order: number; is_terminal: boolean }[] = [
  { stage_key: 'applied', label: 'Aplicado', sort_order: 1, is_terminal: false },
  { stage_key: 'screening', label: 'Triagem', sort_order: 2, is_terminal: false },
  { stage_key: 'interview', label: 'Entrevista', sort_order: 3, is_terminal: false },
  { stage_key: 'offer', label: 'Proposta', sort_order: 4, is_terminal: false },
  { stage_key: 'hired', label: 'Contratado', sort_order: 5, is_terminal: true },
  { stage_key: 'rejected', label: 'Rejeitado', sort_order: 90, is_terminal: true },
  { stage_key: 'withdrawn', label: 'Desistiu', sort_order: 91, is_terminal: true },
];

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
  stage: string;
  score: number | null;
  source: string | null;
  resume_url: string | null;
  notes: string | null;
  interview_feedback: InterviewFeedback[];
  stage_history: StageTransition[];
  hired_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface StageTransition {
  from: string;
  to: string;
  transitioned_at: string;
  transitioned_by: string;
  notes: string | null;
}

export interface InterviewFeedback {
  interviewer_id: string;
  interviewer_name: string;
  date: string;
  rating: number;
  strengths: string[];
  concerns: string[];
  recommendation: 'strong_hire' | 'hire' | 'neutral' | 'no_hire';
  notes: string;
}

export interface PipelineStage {
  id: string;
  tenant_id: string;
  stage_key: string;
  label: string;
  sort_order: number;
  is_terminal: boolean;
  is_active: boolean;
}

export interface RecruitmentPipelineMetrics {
  total_requisitions: number;
  open_positions: number;
  total_candidates: number;
  candidates_by_stage: Record<string, number>;
  avg_time_to_fill_days: number;
  offer_acceptance_rate: number;
}

// ══════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════

const eventStore = new GovernanceEventStore();

export class RecruitmentService {
  // ── Pipeline Stage Config ──

  async getPipelineStages(tenantId: string): Promise<PipelineStage[]> {
    const { data } = await supabase
      .from('ats_pipeline_stages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order');

    if (data && data.length > 0) return data as PipelineStage[];

    // Seed defaults
    await this.seedDefaultStages(tenantId);
    return DEFAULT_PIPELINE.map((s, i) => ({
      id: `default_${i}`, tenant_id: tenantId,
      ...s, is_active: true,
    }));
  }

  async seedDefaultStages(tenantId: string): Promise<void> {
    const rows = DEFAULT_PIPELINE.map(s => ({
      tenant_id: tenantId,
      stage_key: s.stage_key,
      label: s.label,
      sort_order: s.sort_order,
      is_terminal: s.is_terminal,
      is_active: true,
    }));
    await supabase.from('ats_pipeline_stages').upsert(rows, { onConflict: 'tenant_id,stage_key' });
  }

  // ── Requisitions ──

  async createRequisition(tenantId: string, data: Omit<JobRequisition, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'approved_by' | 'approved_at'>): Promise<JobRequisition> {
    const { data: row, error } = await supabase
      .from('ats_requisitions')
      .insert({ tenant_id: tenantId, ...data })
      .select()
      .single();
    if (error) throw new Error(`[ATS] Requisition create failed: ${error.message}`);
    return row as unknown as JobRequisition;
  }

  async listRequisitions(tenantId: string, opts?: { status?: string }): Promise<JobRequisition[]> {
    let q = supabase.from('ats_requisitions').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (opts?.status) q = q.eq('status', opts.status);
    const { data, error } = await q;
    if (error) throw new Error(`[ATS] Requisition list failed: ${error.message}`);
    return (data ?? []) as unknown as JobRequisition[];
  }

  async updateRequisitionStatus(id: string, status: RequisitionStatus, approvedBy?: string): Promise<void> {
    const update: Record<string, unknown> = { status };
    if (status === 'approved' && approvedBy) {
      update.approved_by = approvedBy;
      update.approved_at = new Date().toISOString();
    }
    const { error } = await supabase.from('ats_requisitions').update(update).eq('id', id);
    if (error) throw new Error(`[ATS] Requisition status update failed: ${error.message}`);
  }

  // ── Candidates ──

  async addCandidate(tenantId: string, data: {
    requisition_id: string; name: string; email: string;
    phone?: string; source?: string; resume_url?: string; notes?: string;
  }): Promise<Candidate> {
    const stageHistory: StageTransition[] = [{
      from: '', to: 'applied',
      transitioned_at: new Date().toISOString(),
      transitioned_by: 'system',
      notes: 'Candidatura recebida',
    }];

    const { data: row, error } = await supabase
      .from('ats_candidates')
      .insert({
        tenant_id: tenantId,
        requisition_id: data.requisition_id,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        stage: 'applied',
        source: data.source ?? null,
        resume_url: data.resume_url ?? null,
        notes: data.notes ?? null,
        interview_feedback: [] as unknown as Json,
        stage_history: stageHistory as unknown as Json,
      })
      .select()
      .single();
    if (error) throw new Error(`[ATS] Candidate add failed: ${error.message}`);
    return this.mapCandidate(row);
  }

  async listCandidates(tenantId: string, requisitionId: string): Promise<Candidate[]> {
    const { data, error } = await supabase
      .from('ats_candidates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('requisition_id', requisitionId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`[ATS] Candidate list failed: ${error.message}`);
    return (data ?? []).map(this.mapCandidate);
  }

  /**
   * Advance candidate to next stage.
   * When stage = 'hired', emits EmployeeHired + LegalEventRecorded events.
   */
  async advanceStage(
    tenantId: string,
    candidateId: string,
    toStage: string,
    actorId: string,
    notes?: string,
  ): Promise<Candidate> {
    // Load current candidate
    const { data: current, error: loadErr } = await supabase
      .from('ats_candidates')
      .select('*')
      .eq('id', candidateId)
      .single();
    if (loadErr || !current) throw new Error(`[ATS] Candidate not found: ${candidateId}`);

    const candidate = this.mapCandidate(current);
    const transition: StageTransition = {
      from: candidate.stage,
      to: toStage,
      transitioned_at: new Date().toISOString(),
      transitioned_by: actorId,
      notes: notes ?? null,
    };

    const updatedHistory = [...candidate.stage_history, transition];
    const updatePayload: Record<string, unknown> = {
      stage: toStage,
      stage_history: updatedHistory as unknown as Json,
    };

    if (toStage === 'hired') {
      updatePayload.hired_at = new Date().toISOString();
    } else if (toStage === 'rejected') {
      updatePayload.rejected_at = new Date().toISOString();
      updatePayload.rejection_reason = notes ?? null;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('ats_candidates')
      .update(updatePayload)
      .eq('id', candidateId)
      .select()
      .single();
    if (updateErr) throw new Error(`[ATS] Stage advance failed: ${updateErr.message}`);

    // ── Emit governance events on hire ──
    if (toStage === 'hired') {
      await this.emitHiredEvents(tenantId, this.mapCandidate(updated), current.requisition_id as string, actorId);
    }

    return this.mapCandidate(updated);
  }

  async addInterviewFeedback(candidateId: string, feedback: InterviewFeedback): Promise<void> {
    const { data: current } = await supabase
      .from('ats_candidates').select('interview_feedback').eq('id', candidateId).single();
    const existing = (current?.interview_feedback as unknown as InterviewFeedback[]) ?? [];
    existing.push(feedback);

    const { error } = await supabase
      .from('ats_candidates')
      .update({ interview_feedback: existing as unknown as Json })
      .eq('id', candidateId);
    if (error) throw new Error(`[ATS] Feedback add failed: ${error.message}`);
  }

  // ── Metrics ──

  async getPipelineMetrics(tenantId: string): Promise<RecruitmentPipelineMetrics> {
    const [reqResult, candResult] = await Promise.all([
      supabase.from('ats_requisitions').select('status').eq('tenant_id', tenantId),
      supabase.from('ats_candidates').select('stage, hired_at, created_at').eq('tenant_id', tenantId),
    ]);

    const reqs = reqResult.data ?? [];
    const cands = candResult.data ?? [];

    const byStage: Record<string, number> = {};
    for (const c of cands) {
      byStage[c.stage] = (byStage[c.stage] ?? 0) + 1;
    }

    const hired = cands.filter(c => c.hired_at);
    const offered = cands.filter(c => c.stage === 'offer' || c.stage === 'hired');
    const fillDays = hired.length > 0
      ? hired.reduce((sum, c) => {
          const diff = (new Date(c.hired_at!).getTime() - new Date(c.created_at).getTime()) / 86400000;
          return sum + diff;
        }, 0) / hired.length
      : 0;

    return {
      total_requisitions: reqs.length,
      open_positions: reqs.filter(r => r.status === 'open' || r.status === 'approved').length,
      total_candidates: cands.length,
      candidates_by_stage: byStage,
      avg_time_to_fill_days: Math.round(fillDays),
      offer_acceptance_rate: offered.length > 0 ? hired.length / offered.length : 0,
    };
  }

  // ── Internal: Governance Events ──

  private async emitHiredEvents(tenantId: string, candidate: Candidate, requisitionId: string, actorId: string): Promise<void> {
    const metadata = {
      tenant_id: tenantId,
      actor_id: actorId,
      actor_type: 'user' as const,
      source_module: 'ats_recruitment',
      correlation_id: `ats_hire_${candidate.id}`,
    };

    const hiredEvent = createGovernanceEvent({
      aggregate_type: 'employee',
      aggregate_id: candidate.id,
      event_type: EMPLOYEE_LIFECYCLE_EVENTS.EmployeeHired,
      payload: {
        employee_id: candidate.id,
        nome: candidate.name,
        cpf: '',
        cargo_id: null,
        departamento_id: null,
        empresa_id: null,
        tipo_contrato: 'clt',
        data_admissao: new Date().toISOString().split('T')[0],
        salario_base: null,
        cbo_codigo: null,
        hired_by: actorId,
        source: 'ats',
        requisition_id: requisitionId,
      },
      metadata,
    });

    const legalEvent = createGovernanceEvent({
      aggregate_type: 'legal_event',
      aggregate_id: candidate.id,
      event_type: 'LegalEventRecorded',
      payload: {
        employee_id: candidate.id,
        category: 'admissao',
        severity: 'low',
        title: `Contratação via ATS: ${candidate.name}`,
        description: `Candidato contratado através do processo seletivo. Requisição: ${requisitionId}. Fonte: ${candidate.source ?? 'direta'}.`,
        legal_basis: 'CLT Art. 442 - Contrato individual de trabalho',
        effective_date: new Date().toISOString().split('T')[0],
        issued_by: actorId,
        metadata: {
          ats_candidate_id: candidate.id,
          ats_requisition_id: requisitionId,
          candidate_email: candidate.email,
          source: candidate.source,
          stage_count: candidate.stage_history.length,
        },
      },
      metadata,
    });

    await eventStore.append([hiredEvent, legalEvent]);
  }

  // ── Mappers ──

  private mapCandidate(row: Record<string, unknown>): Candidate {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      requisition_id: row.requisition_id as string,
      name: row.name as string,
      email: row.email as string,
      phone: (row.phone as string) ?? null,
      stage: row.stage as string,
      score: (row.score as number) ?? null,
      source: (row.source as string) ?? null,
      resume_url: (row.resume_url as string) ?? null,
      notes: (row.notes as string) ?? null,
      interview_feedback: (row.interview_feedback as unknown as InterviewFeedback[]) ?? [],
      stage_history: (row.stage_history as unknown as StageTransition[]) ?? [],
      hired_at: (row.hired_at as string) ?? null,
      rejected_at: (row.rejected_at as string) ?? null,
      rejection_reason: (row.rejection_reason as string) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}

// ── Singleton ──
let _instance: RecruitmentService | null = null;
export function getRecruitmentService(): RecruitmentService {
  if (!_instance) _instance = new RecruitmentService();
  return _instance;
}
