/**
 * Automated Hiring — Etapa 4: Treinamentos NR
 *
 * Auto-generates mandatory NR training assignments for new hires
 * and blocks activation until pre-activity trainings are completed.
 *
 * Rules (NR-1, item 1.7):
 * - Worker CANNOT perform activities before completing mandatory trainings
 * - Trainings are derived from Etapa 2 (Análise Legal do Cargo)
 * - Some NRs require training BEFORE first day (e.g. NR-35, NR-10, NR-33)
 *
 * Integrations:
 * - NR Training Lifecycle Engine (assignment creation)
 * - Occupational Intelligence (NRs obrigatórias)
 * - Safety Automation Engine (onboarding SST)
 */

import type { HiringWorkflow, ComplianceBlocker } from './types';
import type { CreateAssignmentDTO, TrainingAssignment } from '../nr-training-lifecycle/types';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export interface NrTrainingAdmissionInput {
  tenant_id: string;
  company_id: string;
  employee_id: string;
  /** NRs obrigatórias vindas da Etapa 2 */
  applicable_nrs: number[];
  /** Treinamentos obrigatórios (nomes) vindos da Etapa 2 */
  required_trainings: string[];
  /** CBO do cargo */
  cbo_code: string | null;
  /** Grau de risco da empresa */
  grau_risco: number;
  /** Treinamentos já existentes (conclusões prévias do candidato) */
  existing_completed_nrs: number[];
  /** Data prevista de início das atividades */
  data_inicio_prevista: string;
}

export interface GeneratedTrainingAssignment {
  nr_number: number;
  training_name: string;
  required_hours: number;
  legal_basis: string;
  validity_months: number;
  pre_activity: boolean;       // Must complete BEFORE starting work
  due_date: string;
  already_completed: boolean;  // Candidate already has valid cert
}

export interface NrTrainingEtapaResult {
  valid: boolean;
  blockers: ComplianceBlocker[];
  warnings: ComplianceBlocker[];
  generated_assignments: GeneratedTrainingAssignment[];
  pre_activity_pending: number;
  total_hours_required: number;
  evaluated_at: string;
}

// ═══════════════════════════════════════════════
//  NR Training Catalog (pre-activity flag + hours)
// ═══════════════════════════════════════════════

interface NrTrainingSpec {
  name: string;
  hours: number;
  validity_months: number;
  legal_basis: string;
  /** Must be completed BEFORE employee starts any activity */
  pre_activity: boolean;
}

const NR_TRAINING_SPECS: Record<number, NrTrainingSpec> = {
  1:  { name: 'NR-1 — Disposições Gerais / PGR',              hours: 2,  validity_months: 24, legal_basis: 'NR-1, item 1.7',      pre_activity: true },
  5:  { name: 'NR-5 — CIPA',                                  hours: 20, validity_months: 12, legal_basis: 'NR-5, item 5.6.4',    pre_activity: false },
  6:  { name: 'NR-6 — EPI (Uso e Conservação)',                hours: 2,  validity_months: 24, legal_basis: 'NR-6, item 6.6.1',    pre_activity: true },
  7:  { name: 'NR-7 — PCMSO (Noções)',                         hours: 1,  validity_months: 24, legal_basis: 'NR-7',                pre_activity: false },
  9:  { name: 'NR-9 — Avaliação e Controle de Exposições',     hours: 2,  validity_months: 24, legal_basis: 'NR-9',                pre_activity: false },
  10: { name: 'NR-10 — Segurança em Eletricidade',             hours: 40, validity_months: 24, legal_basis: 'NR-10, item 10.8.8',  pre_activity: true },
  11: { name: 'NR-11 — Transporte e Movimentação de Materiais',hours: 8,  validity_months: 24, legal_basis: 'NR-11, item 11.1.5',  pre_activity: true },
  12: { name: 'NR-12 — Segurança em Máquinas',                 hours: 8,  validity_months: 24, legal_basis: 'NR-12, item 12.16',   pre_activity: true },
  13: { name: 'NR-13 — Caldeiras e Vasos de Pressão',          hours: 40, validity_months: 24, legal_basis: 'NR-13, item 13.3.5',  pre_activity: true },
  15: { name: 'NR-15 — Atividades Insalubres (Conscientização)',hours: 2,  validity_months: 24, legal_basis: 'NR-15',              pre_activity: false },
  16: { name: 'NR-16 — Atividades Perigosas (Conscientização)',hours: 2,   validity_months: 24, legal_basis: 'NR-16',              pre_activity: false },
  17: { name: 'NR-17 — Ergonomia',                             hours: 2,  validity_months: 24, legal_basis: 'NR-17',               pre_activity: false },
  18: { name: 'NR-18 — Construção Civil',                      hours: 6,  validity_months: 24, legal_basis: 'NR-18, item 18.28',   pre_activity: true },
  20: { name: 'NR-20 — Inflamáveis e Combustíveis',            hours: 8,  validity_months: 12, legal_basis: 'NR-20, item 20.11',   pre_activity: true },
  23: { name: 'NR-23 — Proteção contra Incêndios',             hours: 4,  validity_months: 12, legal_basis: 'NR-23',               pre_activity: false },
  33: { name: 'NR-33 — Espaços Confinados',                    hours: 16, validity_months: 12, legal_basis: 'NR-33, item 33.3.5',  pre_activity: true },
  34: { name: 'NR-34 — Trabalho a Quente',                     hours: 8,  validity_months: 24, legal_basis: 'NR-34',               pre_activity: true },
  35: { name: 'NR-35 — Trabalho em Altura',                    hours: 8,  validity_months: 24, legal_basis: 'NR-35, item 35.3.2',  pre_activity: true },
  36: { name: 'NR-36 — Abate e Processamento de Carnes',       hours: 4,  validity_months: 24, legal_basis: 'NR-36',               pre_activity: true },
  37: { name: 'NR-37 — Plataformas de Petróleo',               hours: 16, validity_months: 24, legal_basis: 'NR-37',               pre_activity: true },
};

// ═══════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════

function mkBlocker(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'blocker', message: msg, legal_basis: basis ?? null, step: 'nr_training' };
}

function mkWarning(code: string, msg: string, basis?: string): ComplianceBlocker {
  return { code, severity: 'warning', message: msg, legal_basis: basis ?? null, step: 'nr_training' };
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════
//  Engine
// ═══════════════════════════════════════════════

/**
 * Generate training assignments and evaluate if pre-activity trainings block activation.
 */
export function generateAdmissionTrainings(input: NrTrainingAdmissionInput): NrTrainingEtapaResult {
  const blockers: ComplianceBlocker[] = [];
  const warnings: ComplianceBlocker[] = [];
  const assignments: GeneratedTrainingAssignment[] = [];

  if (input.applicable_nrs.length === 0) {
    warnings.push(mkWarning('NO_NRS', 'Nenhuma NR aplicável identificada — verificar perfil ocupacional'));
  }

  // Always include NR-1 (integração obrigatória)
  const nrsToProcess = new Set(input.applicable_nrs);
  nrsToProcess.add(1);

  for (const nr of nrsToProcess) {
    const spec = NR_TRAINING_SPECS[nr];
    if (!spec) {
      warnings.push(mkWarning(
        `NR_NO_SPEC_${nr}`,
        `NR-${nr} obrigatória, mas sem especificação de treinamento catalogada`,
      ));
      continue;
    }

    const alreadyCompleted = input.existing_completed_nrs.includes(nr);

    // Due date: pre-activity = before start date; others = start date + 90 days
    const dueDate = spec.pre_activity
      ? input.data_inicio_prevista
      : addDays(input.data_inicio_prevista, 90);

    assignments.push({
      nr_number: nr,
      training_name: spec.name,
      required_hours: spec.hours,
      legal_basis: spec.legal_basis,
      validity_months: spec.validity_months,
      pre_activity: spec.pre_activity,
      due_date: dueDate,
      already_completed: alreadyCompleted,
    });
  }

  // Check pre-activity blockers
  const preActivityPending = assignments.filter(a => a.pre_activity && !a.already_completed);

  if (preActivityPending.length > 0) {
    blockers.push(mkBlocker(
      'PRE_ACTIVITY_TRAINING_PENDING',
      `${preActivityPending.length} treinamento(s) pré-atividade obrigatório(s) pendente(s): ${preActivityPending.map(a => `NR-${a.nr_number}`).join(', ')}`,
      'NR-1, item 1.7',
    ));
  }

  const totalHours = assignments
    .filter(a => !a.already_completed)
    .reduce((sum, a) => sum + a.required_hours, 0);

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
    generated_assignments: assignments,
    pre_activity_pending: preActivityPending.length,
    total_hours_required: totalHours,
    evaluated_at: new Date().toISOString(),
  };
}

/**
 * Convert generated assignments into CreateAssignmentDTOs for the NR Training Lifecycle Engine.
 */
export function buildTrainingAssignmentDTOs(
  input: NrTrainingAdmissionInput,
  assignments: GeneratedTrainingAssignment[],
): CreateAssignmentDTO[] {
  return assignments
    .filter(a => !a.already_completed)
    .map(a => ({
      tenant_id: input.tenant_id,
      company_id: input.company_id,
      employee_id: input.employee_id,
      nr_number: a.nr_number,
      training_name: a.training_name,
      cbo_code: input.cbo_code,
      trigger: 'admission' as const,
      required_hours: a.required_hours,
      due_date: a.due_date,
      validity_months: a.validity_months,
      legal_basis: a.legal_basis,
    }));
}

/**
 * Apply Etapa 4 to workflow state machine.
 */
export function applyNrTrainingToWorkflow(
  workflow: HiringWorkflow,
  input: NrTrainingAdmissionInput,
): { workflow: HiringWorkflow; result: NrTrainingEtapaResult } {
  const result = generateAdmissionTrainings(input);
  const now = new Date().toISOString();

  const trainingStep = workflow.steps.find(s => s.step === 'nr_training')!;

  if (result.valid) {
    // All pre-activity trainings done (or none required)
    trainingStep.status = 'completed';
    trainingStep.completed_at = now;
    trainingStep.error_message = null;
    trainingStep.metadata = {
      total_assignments: result.generated_assignments.length,
      pre_activity_completed: true,
      total_hours_required: result.total_hours_required,
      nrs: result.generated_assignments.map(a => a.nr_number),
      validated_at: now,
    };

    // Advance to EPI assignment
    workflow.current_step = 'epi_assignment';
    workflow.status = 'sst_pending';
    const epiStep = workflow.steps.find(s => s.step === 'epi_assignment')!;
    epiStep.status = 'in_progress';
    epiStep.started_at = now;
  } else {
    // Pre-activity trainings pending → block
    trainingStep.status = 'blocked';
    trainingStep.error_message = result.blockers.map(b => b.message).join('; ');
    trainingStep.metadata = {
      total_assignments: result.generated_assignments.length,
      pre_activity_pending: result.pre_activity_pending,
      pending_nrs: result.generated_assignments
        .filter(a => a.pre_activity && !a.already_completed)
        .map(a => a.nr_number),
      total_hours_required: result.total_hours_required,
    };

    workflow.status = 'sst_pending';
  }

  workflow.updated_at = now;
  return { workflow, result };
}
