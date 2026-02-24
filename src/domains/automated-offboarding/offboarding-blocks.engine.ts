/**
 * Automated Offboarding — Bloqueios Operacionais (Etapa 1)
 *
 * When an offboarding process is initiated, this engine freezes
 * the employee's operational state to prevent inconsistencies:
 *
 * Hard blocks:
 * - employee_transfer      → Bloqueia movimentações/transferências
 * - salary_change           → Bloqueia alterações salariais
 * - disciplinary_action     → Bloqueia novas advertências/suspensões
 * - contract_amendment      → Congela estado contratual
 * - benefit_enrollment      → Bloqueia adesão a novos benefícios
 * - new_hiring_workflow     → Impede recontratação simultânea
 *
 * Soft blocks:
 * - vacation_request        → Bloqueia novas férias (pode ser overridden)
 * - training_enrollment     → Bloqueia novos treinamentos
 *
 * Integrations:
 * - Employee Master Record Engine (ficha do colaborador)
 * - Legal Agreements Governance Engine (contratos)
 * - Payroll Simulation Engine (folha)
 * - Workforce Intelligence Engine (analytics)
 * - Security Kernel (enforcement)
 */

import type { OffboardingWorkflow, OffboardingStatus } from './types';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export type OffboardingRestriction =
  | 'employee_transfer'     // Movimentações (promoção, transferência, mudança de setor)
  | 'salary_change'         // Alterações salariais
  | 'disciplinary_action'   // Novas advertências / suspensões
  | 'contract_amendment'    // Aditivos contratuais
  | 'benefit_enrollment'    // Adesão a novos benefícios
  | 'new_hiring_workflow'   // Recontratação simultânea
  | 'vacation_request'      // Novas solicitações de férias
  | 'training_enrollment'   // Novos treinamentos
  | 'fleet_assignment'      // Novo vínculo de veículo
  | 'system_access_grant';  // Novos acessos a sistemas

export type OffboardingBlockSeverity = 'hard_block' | 'soft_block' | 'warning';

export interface OffboardingBlock {
  restriction: OffboardingRestriction;
  severity: OffboardingBlockSeverity;
  reason: string;
  legal_basis: string | null;
  /** Which offboarding status triggers this block */
  active_from: OffboardingStatus;
  /** Can be overridden by authorized manager */
  overridable: boolean;
}

export interface OffboardingRestrictionProfile {
  employee_id: string;
  workflow_id: string;
  workflow_status: OffboardingStatus;
  offboarding_type: string;
  is_fully_blocked: boolean;
  blocks: OffboardingBlock[];
  hard_blocks: number;
  soft_blocks: number;
  warnings: number;
  evaluated_at: string;
}

export interface OffboardingRestrictionCheckResult {
  allowed: boolean;
  block: OffboardingBlock | null;
}

// ═══════════════════════════════════════════════
//  Status → Restriction Mapping
// ═══════════════════════════════════════════════

/** Statuses where the offboarding is "active" (employee is in process) */
const ACTIVE_STATUSES: OffboardingStatus[] = ['draft', 'validation', 'documents_pending', 'esocial_pending'];

interface OffboardingBlockRule {
  /** Block is active when workflow is in any of these statuses */
  active_statuses: OffboardingStatus[];
  condition?: (workflow: OffboardingWorkflow) => boolean;
  restrictions: Omit<OffboardingBlock, 'active_from'>[];
}

const BLOCK_RULES: OffboardingBlockRule[] = [
  // ── Ao iniciar o processo (draft em diante) — Congelamento total ──
  {
    active_statuses: ACTIVE_STATUSES,
    restrictions: [
      {
        restriction: 'employee_transfer',
        severity: 'hard_block',
        reason: 'Colaborador em processo de desligamento — movimentações bloqueadas',
        legal_basis: 'CLT Art. 468',
        overridable: false,
      },
      {
        restriction: 'salary_change',
        severity: 'hard_block',
        reason: 'Colaborador em processo de desligamento — alterações salariais congeladas',
        legal_basis: 'CLT Art. 468',
        overridable: false,
      },
      {
        restriction: 'disciplinary_action',
        severity: 'hard_block',
        reason: 'Colaborador em processo de desligamento — novas advertências/suspensões bloqueadas',
        legal_basis: 'CLT Art. 482 (preservação do estado atual)',
        overridable: false,
      },
      {
        restriction: 'contract_amendment',
        severity: 'hard_block',
        reason: 'Estado contratual congelado — processo de rescisão em andamento',
        legal_basis: 'CLT Art. 468 / Art. 477',
        overridable: false,
      },
      {
        restriction: 'benefit_enrollment',
        severity: 'hard_block',
        reason: 'Colaborador em desligamento — adesão a novos benefícios bloqueada',
        legal_basis: null,
        overridable: false,
      },
      {
        restriction: 'new_hiring_workflow',
        severity: 'hard_block',
        reason: 'Recontratação bloqueada enquanto processo de desligamento está ativo',
        legal_basis: 'Portaria 671/2021',
        overridable: false,
      },
      {
        restriction: 'fleet_assignment',
        severity: 'hard_block',
        reason: 'Novo vínculo de veículo bloqueado — colaborador em desligamento',
        legal_basis: null,
        overridable: false,
      },
    ],
  },

  // ── Soft blocks — podem ser sobrepostos com justificativa ──
  {
    active_statuses: ACTIVE_STATUSES,
    restrictions: [
      {
        restriction: 'vacation_request',
        severity: 'soft_block',
        reason: 'Novas férias bloqueadas durante processo de desligamento (férias proporcionais serão indenizadas)',
        legal_basis: 'CLT Art. 146',
        overridable: true,
      },
      {
        restriction: 'training_enrollment',
        severity: 'soft_block',
        reason: 'Novos treinamentos não recomendados durante desligamento',
        legal_basis: null,
        overridable: true,
      },
      {
        restriction: 'system_access_grant',
        severity: 'soft_block',
        reason: 'Novos acessos a sistemas não recomendados — revogação em progresso',
        legal_basis: 'LGPD Art. 18',
        overridable: true,
      },
    ],
  },

  // ── Justa causa: bloqueio adicional ──
  {
    active_statuses: ACTIVE_STATUSES,
    condition: (w) => w.offboarding_type === 'justa_causa',
    restrictions: [
      {
        restriction: 'system_access_grant',
        severity: 'hard_block',
        reason: 'Justa causa — todo acesso a sistemas deve ser imediatamente revogado',
        legal_basis: 'CLT Art. 482 / LGPD Art. 46',
        overridable: false,
      },
    ],
  },
];

// ═══════════════════════════════════════════════
//  Engine
// ═══════════════════════════════════════════════

/**
 * Evaluate all operational restrictions for an offboarding workflow.
 * Called when any module needs to check if an operation is allowed
 * for an employee undergoing offboarding.
 */
export function evaluateOffboardingRestrictions(workflow: OffboardingWorkflow): OffboardingRestrictionProfile {
  const blocks: OffboardingBlock[] = [];
  const seen = new Set<string>();

  for (const rule of BLOCK_RULES) {
    // Check if current workflow status triggers this rule
    if (!rule.active_statuses.includes(workflow.status)) continue;

    // Check optional condition
    if (rule.condition && !rule.condition(workflow)) continue;

    for (const r of rule.restrictions) {
      const key = `${r.restriction}:${r.severity}`;
      if (seen.has(key)) continue;
      seen.add(key);

      blocks.push({
        ...r,
        active_from: workflow.status,
      });
    }
  }

  return {
    employee_id: workflow.employee_id,
    workflow_id: workflow.id,
    workflow_status: workflow.status,
    offboarding_type: workflow.offboarding_type,
    is_fully_blocked: blocks.filter(b => b.severity === 'hard_block').length > 0,
    blocks,
    hard_blocks: blocks.filter(b => b.severity === 'hard_block').length,
    soft_blocks: blocks.filter(b => b.severity === 'soft_block').length,
    warnings: blocks.filter(b => b.severity === 'warning').length,
    evaluated_at: new Date().toISOString(),
  };
}

/**
 * Check if a specific operation is allowed for an employee in offboarding.
 */
export function checkOffboardingOperationAllowed(
  workflow: OffboardingWorkflow,
  operation: OffboardingRestriction,
): OffboardingRestrictionCheckResult {
  const profile = evaluateOffboardingRestrictions(workflow);
  const block = profile.blocks.find(b => b.restriction === operation && b.severity === 'hard_block')
    ?? profile.blocks.find(b => b.restriction === operation && b.severity === 'soft_block')
    ?? null;

  return {
    allowed: !block || block.severity === 'warning',
    block,
  };
}

// ═══════════════════════════════════════════════
//  Quick Check Helpers
// ═══════════════════════════════════════════════

/** Can the employee be transferred/promoted? */
export function canTransferEmployee(workflow: OffboardingWorkflow): OffboardingRestrictionCheckResult {
  return checkOffboardingOperationAllowed(workflow, 'employee_transfer');
}

/** Can a new disciplinary action be issued? */
export function canIssueDisciplinaryAction(workflow: OffboardingWorkflow): OffboardingRestrictionCheckResult {
  return checkOffboardingOperationAllowed(workflow, 'disciplinary_action');
}

/** Can the contract be amended? */
export function canAmendContract(workflow: OffboardingWorkflow): OffboardingRestrictionCheckResult {
  return checkOffboardingOperationAllowed(workflow, 'contract_amendment');
}

/** Can salary be changed? */
export function canChangeSalary(workflow: OffboardingWorkflow): OffboardingRestrictionCheckResult {
  return checkOffboardingOperationAllowed(workflow, 'salary_change');
}

/** Can the employee request vacation? */
export function canRequestVacation(workflow: OffboardingWorkflow): OffboardingRestrictionCheckResult {
  return checkOffboardingOperationAllowed(workflow, 'vacation_request');
}

/** Can the employee be rehired while offboarding is active? */
export function canRehire(workflow: OffboardingWorkflow): OffboardingRestrictionCheckResult {
  return checkOffboardingOperationAllowed(workflow, 'new_hiring_workflow');
}
