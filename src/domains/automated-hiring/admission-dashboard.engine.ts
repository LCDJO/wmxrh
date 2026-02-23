/**
 * Automated Hiring — Dashboard de Admissão
 *
 * Analytics engine that computes admission metrics at two levels:
 *
 * Company View:
 *   - Admissões em andamento
 *   - Pendências por etapa
 *   - Tempo médio de admissão
 *
 * Tenant View:
 *   - Taxa de conformidade
 *   - Admissões bloqueadas
 */

import type { HiringWorkflow, HiringStep, HiringWorkflowStatus, StepStatus } from './types';
import { HIRING_STEPS } from './types';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export interface StepPendencyCount {
  step: HiringStep;
  label: string;
  pending: number;
  blocked: number;
  in_progress: number;
}

export interface CompanyAdmissionMetrics {
  company_id: string;
  total_in_progress: number;
  completed_last_30d: number;
  cancelled_last_30d: number;
  pendencies_by_step: StepPendencyCount[];
  avg_admission_days: number | null;
  median_admission_days: number | null;
  fastest_admission_days: number | null;
  slowest_admission_days: number | null;
  evaluated_at: string;
}

export interface BlockedAdmission {
  workflow_id: string;
  candidate_name: string;
  current_step: HiringStep;
  blocked_steps: HiringStep[];
  blocked_since: string | null;
  days_blocked: number;
}

export interface TenantAdmissionMetrics {
  tenant_id: string;
  total_workflows: number;
  active_workflows: number;
  compliance_rate: number;           // 0–100
  blocked_count: number;
  blocked_admissions: BlockedAdmission[];
  status_distribution: Record<HiringWorkflowStatus, number>;
  avg_steps_completed: number;
  evaluated_at: string;
}

// ═══════════════════════════════════════════════
//  Step Labels
// ═══════════════════════════════════════════════

const STEP_LABELS: Record<HiringStep, string> = {
  personal_data: 'Dados Pessoais',
  documents: 'Documentos',
  address: 'Endereço',
  dependents: 'Dependentes',
  position_mapping: 'Mapeamento de Cargo',
  occupational_profile: 'Perfil Ocupacional',
  contract_setup: 'Configuração Contratual',
  health_exam: 'Exame Admissional (ASO)',
  nr_training: 'Treinamentos NR',
  epi_assignment: 'Entrega de EPI',
  agreements: 'Termos Obrigatórios',
  compliance_gate: 'Gate de Conformidade',
  esocial_submission: 'Envio eSocial',
  activation: 'Ativação',
};

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function isInProgress(status: HiringWorkflowStatus): boolean {
  return !['active', 'cancelled'].includes(status);
}

// ═══════════════════════════════════════════════
//  Company Dashboard
// ═══════════════════════════════════════════════

export function computeCompanyMetrics(
  workflows: HiringWorkflow[],
  companyId: string,
): CompanyAdmissionMetrics {
  const companyWfs = workflows.filter(w => w.company_id === companyId);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const inProgress = companyWfs.filter(w => isInProgress(w.status));
  const completedRecent = companyWfs.filter(
    w => w.status === 'active' && w.data_conclusao && w.data_conclusao >= thirtyDaysAgo,
  );
  const cancelledRecent = companyWfs.filter(
    w => w.status === 'cancelled' && w.updated_at >= thirtyDaysAgo,
  );

  // Pendencies by step
  const pendencies: StepPendencyCount[] = HIRING_STEPS.map(step => {
    const counts = { pending: 0, blocked: 0, in_progress: 0 };
    for (const wf of inProgress) {
      const s = wf.steps.find(st => st.step === step);
      if (!s) continue;
      if (s.status === 'pending') counts.pending++;
      if (s.status === 'blocked' || s.status === 'error') counts.blocked++;
      if (s.status === 'in_progress') counts.in_progress++;
    }
    return { step, label: STEP_LABELS[step], ...counts };
  }).filter(p => p.pending > 0 || p.blocked > 0 || p.in_progress > 0);

  // Admission duration for completed workflows
  const durations = completedRecent
    .filter(w => w.data_conclusao)
    .map(w => daysBetween(w.data_inicio, w.data_conclusao!));

  const allCompleted = companyWfs
    .filter(w => w.status === 'active' && w.data_conclusao)
    .map(w => daysBetween(w.data_inicio, w.data_conclusao!));

  return {
    company_id: companyId,
    total_in_progress: inProgress.length,
    completed_last_30d: completedRecent.length,
    cancelled_last_30d: cancelledRecent.length,
    pendencies_by_step: pendencies,
    avg_admission_days:
      allCompleted.length > 0
        ? Math.round((allCompleted.reduce((a, b) => a + b, 0) / allCompleted.length) * 10) / 10
        : null,
    median_admission_days: median(allCompleted),
    fastest_admission_days: allCompleted.length > 0 ? Math.min(...allCompleted) : null,
    slowest_admission_days: allCompleted.length > 0 ? Math.max(...allCompleted) : null,
    evaluated_at: now.toISOString(),
  };
}

// ═══════════════════════════════════════════════
//  Tenant Dashboard
// ═══════════════════════════════════════════════

export function computeTenantMetrics(
  workflows: HiringWorkflow[],
  tenantId: string,
): TenantAdmissionMetrics {
  const tenantWfs = workflows.filter(w => w.tenant_id === tenantId);
  const now = new Date();

  // Status distribution
  const statusDist = {} as Record<HiringWorkflowStatus, number>;
  const allStatuses: HiringWorkflowStatus[] = [
    'draft', 'validation', 'exams_pending', 'documents_pending',
    'sst_pending', 'ready_for_esocial', 'active', 'cancelled', 'blocked',
  ];
  for (const s of allStatuses) statusDist[s] = 0;
  for (const wf of tenantWfs) statusDist[wf.status] = (statusDist[wf.status] || 0) + 1;

  // Blocked admissions
  const blockedWfs = tenantWfs.filter(w => w.status === 'blocked');
  const blocked: BlockedAdmission[] = blockedWfs.map(wf => {
    const blockedSteps = wf.steps
      .filter(s => s.status === 'blocked' || s.status === 'error')
      .map(s => s.step);

    const blockedSince = wf.steps
      .filter(s => s.status === 'blocked' || s.status === 'error')
      .map(s => s.started_at)
      .filter(Boolean)
      .sort()[0] ?? wf.updated_at;

    return {
      workflow_id: wf.id,
      candidate_name: wf.candidate_name,
      current_step: wf.current_step,
      blocked_steps: blockedSteps,
      blocked_since: blockedSince,
      days_blocked: daysBetween(blockedSince, now.toISOString()),
    };
  });

  // Compliance rate: % of active workflows with all required steps completed
  const activeWfs = tenantWfs.filter(w => isInProgress(w.status));
  const fullyCompliant = activeWfs.filter(wf =>
    wf.steps.every(s => s.status === 'completed' || s.status === 'skipped'),
  );
  const complianceRate = activeWfs.length > 0
    ? Math.round((fullyCompliant.length / activeWfs.length) * 10000) / 100
    : 100;

  // Avg steps completed
  const avgSteps = tenantWfs.length > 0
    ? Math.round(
        (tenantWfs.reduce(
          (sum, wf) => sum + wf.steps.filter(s => s.status === 'completed').length,
          0,
        ) / tenantWfs.length) * 10,
      ) / 10
    : 0;

  return {
    tenant_id: tenantId,
    total_workflows: tenantWfs.length,
    active_workflows: activeWfs.length,
    compliance_rate: complianceRate,
    blocked_count: blocked.length,
    blocked_admissions: blocked,
    status_distribution: statusDist,
    avg_steps_completed: avgSteps,
    evaluated_at: now.toISOString(),
  };
}
