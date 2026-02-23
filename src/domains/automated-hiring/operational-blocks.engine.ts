/**
 * Automated Hiring — Bloqueios Automáticos
 *
 * Operational restriction engine that prevents employees with
 * unresolved hiring pendencies from performing critical actions.
 *
 * Blocked operations when hiring is incomplete:
 * - Registro de ponto (time clock)
 * - Uso de veículo corporativo (fleet)
 * - Operações críticas (machinery, confined spaces, height work)
 *
 * This engine evaluates the hiring workflow state and produces
 * a restriction profile consumed by downstream systems.
 *
 * Integrations:
 * - Time & Attendance Engine (ponto eletrônico)
 * - Fleet Compliance Engine (vehicle access)
 * - Safety Automation Engine (operational clearance)
 * - Security Kernel (access control enforcement)
 */

import type { HiringWorkflow, HiringStep } from './types';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export type OperationalRestriction =
  | 'time_clock'         // Registro de ponto
  | 'fleet_vehicle'      // Uso de veículo
  | 'fleet_device'       // Dispositivo de rastreamento
  | 'machinery'          // Operação de máquinas (NR-12)
  | 'height_work'        // Trabalho em altura (NR-35)
  | 'confined_space'     // Espaço confinado (NR-33)
  | 'electrical'         // Eletricidade (NR-10)
  | 'hot_work'           // Trabalho a quente (NR-34)
  | 'chemical_handling'  // Manuseio de químicos (NR-20)
  | 'system_access'      // Acesso a sistemas internos
  | 'client_contact';    // Contato com clientes

export type RestrictionSeverity = 'hard_block' | 'soft_block' | 'warning';

export interface OperationalBlock {
  restriction: OperationalRestriction;
  severity: RestrictionSeverity;
  reason: string;
  legal_basis: string | null;
  source_step: HiringStep;
  /** Can be overridden by authorized manager */
  overridable: boolean;
}

export interface HiringRestrictionProfile {
  employee_id: string | null;
  workflow_id: string;
  workflow_status: string;
  is_fully_cleared: boolean;
  blocks: OperationalBlock[];
  hard_blocks: number;
  soft_blocks: number;
  warnings: number;
  evaluated_at: string;
}

export interface RestrictionCheckResult {
  allowed: boolean;
  block: OperationalBlock | null;
}

// ═══════════════════════════════════════════════
//  Pendency → Restriction Mapping
// ═══════════════════════════════════════════════

interface PendencyRule {
  step: HiringStep;
  condition: (workflow: HiringWorkflow) => boolean;
  restrictions: {
    restriction: OperationalRestriction;
    severity: RestrictionSeverity;
    reason: string;
    legal_basis: string | null;
    overridable: boolean;
  }[];
}

const PENDENCY_RULES: PendencyRule[] = [
  // ── ASO não aprovado → bloqueia tudo ──
  {
    step: 'health_exam',
    condition: (w) => {
      const s = w.steps.find(s => s.step === 'health_exam');
      return !!s && s.status !== 'completed';
    },
    restrictions: [
      { restriction: 'time_clock',     severity: 'hard_block', reason: 'ASO admissional não aprovado — proibido início de atividades', legal_basis: 'NR-7, item 7.5.3 / CLT Art. 168', overridable: false },
      { restriction: 'fleet_vehicle',  severity: 'hard_block', reason: 'ASO admissional pendente', legal_basis: 'NR-7', overridable: false },
      { restriction: 'machinery',      severity: 'hard_block', reason: 'ASO admissional pendente', legal_basis: 'NR-7', overridable: false },
      { restriction: 'height_work',    severity: 'hard_block', reason: 'ASO admissional pendente', legal_basis: 'NR-7', overridable: false },
      { restriction: 'confined_space', severity: 'hard_block', reason: 'ASO admissional pendente', legal_basis: 'NR-7', overridable: false },
      { restriction: 'electrical',     severity: 'hard_block', reason: 'ASO admissional pendente', legal_basis: 'NR-7', overridable: false },
    ],
  },

  // ── Treinamentos NR pendentes → bloqueia operações de risco ──
  {
    step: 'nr_training',
    condition: (w) => {
      const s = w.steps.find(s => s.step === 'nr_training');
      return !!s && s.status !== 'completed';
    },
    restrictions: [
      { restriction: 'height_work',    severity: 'hard_block', reason: 'Treinamento NR-35 (trabalho em altura) pendente',   legal_basis: 'NR-35, item 35.3.2', overridable: false },
      { restriction: 'confined_space', severity: 'hard_block', reason: 'Treinamento NR-33 (espaço confinado) pendente',     legal_basis: 'NR-33, item 33.3.5', overridable: false },
      { restriction: 'electrical',     severity: 'hard_block', reason: 'Treinamento NR-10 (eletricidade) pendente',         legal_basis: 'NR-10, item 10.8.8', overridable: false },
      { restriction: 'machinery',      severity: 'hard_block', reason: 'Treinamento NR-12 (máquinas) pendente',             legal_basis: 'NR-12, item 12.16',  overridable: false },
      { restriction: 'hot_work',       severity: 'hard_block', reason: 'Treinamento NR-34 (trabalho a quente) pendente',    legal_basis: 'NR-34',              overridable: false },
      { restriction: 'chemical_handling', severity: 'hard_block', reason: 'Treinamento NR-20 (inflamáveis) pendente',       legal_basis: 'NR-20, item 20.11', overridable: false },
      { restriction: 'time_clock',     severity: 'soft_block', reason: 'Treinamentos pré-atividade pendentes — atividades restritas', legal_basis: 'NR-1, item 1.7', overridable: true },
    ],
  },

  // ── EPI não entregue → bloqueia operações de risco ──
  {
    step: 'epi_assignment',
    condition: (w) => {
      const s = w.steps.find(s => s.step === 'epi_assignment');
      return !!s && s.status !== 'completed' && s.status !== 'skipped';
    },
    restrictions: [
      { restriction: 'machinery',      severity: 'hard_block', reason: 'EPI obrigatório não entregue', legal_basis: 'NR-6, item 6.3', overridable: false },
      { restriction: 'height_work',    severity: 'hard_block', reason: 'EPI obrigatório não entregue (cinto/talabarte)', legal_basis: 'NR-6 / NR-35', overridable: false },
      { restriction: 'chemical_handling', severity: 'hard_block', reason: 'EPI obrigatório não entregue (respirador/luvas)', legal_basis: 'NR-6', overridable: false },
      { restriction: 'time_clock',     severity: 'soft_block', reason: 'EPI pendente de entrega — atividades restritas', legal_basis: 'NR-6', overridable: true },
    ],
  },

  // ── Termos não assinados → bloqueia operações específicas ──
  {
    step: 'agreements',
    condition: (w) => {
      const s = w.steps.find(s => s.step === 'agreements');
      return !!s && s.status !== 'completed';
    },
    restrictions: [
      { restriction: 'time_clock',     severity: 'soft_block', reason: 'Termos obrigatórios pendentes de assinatura', legal_basis: 'CLT Art. 442', overridable: true },
      { restriction: 'system_access',  severity: 'soft_block', reason: 'Termo LGPD não assinado — acesso a dados restrito', legal_basis: 'LGPD Art. 7º', overridable: false },
      { restriction: 'client_contact', severity: 'warning',    reason: 'Termo de uso de imagem pendente', legal_basis: 'CC Art. 20', overridable: true },
    ],
  },

  // ── Fleet não validado → bloqueia veículos ──
  {
    step: 'compliance_gate',
    condition: (w) => {
      const cg = w.steps.find(s => s.step === 'compliance_gate');
      return !!cg && cg.metadata?.fleet_validated === false;
    },
    restrictions: [
      { restriction: 'fleet_vehicle', severity: 'hard_block', reason: 'Compliance de frota não aprovado (CNH/termos)', legal_basis: 'CTB Art. 159', overridable: false },
      { restriction: 'fleet_device',  severity: 'hard_block', reason: 'Dispositivo de rastreamento não vinculado', legal_basis: null, overridable: false },
    ],
  },

  // ── eSocial não aceito → bloqueia tudo ──
  {
    step: 'esocial_submission',
    condition: (w) => {
      const s = w.steps.find(s => s.step === 'esocial_submission');
      return !!s && s.status !== 'completed';
    },
    restrictions: [
      { restriction: 'time_clock',    severity: 'hard_block', reason: 'Evento S-2200 não aceito pelo eSocial — colaborador não pode iniciar', legal_basis: 'eSocial MOS', overridable: false },
      { restriction: 'fleet_vehicle', severity: 'hard_block', reason: 'Registro eSocial pendente', legal_basis: 'eSocial MOS', overridable: false },
    ],
  },

  // ── Workflow não ativado → bloqueia tudo ──
  {
    step: 'activation',
    condition: (w) => w.status !== 'active',
    restrictions: [
      { restriction: 'time_clock',     severity: 'hard_block', reason: 'Colaborador não ativado — processo admissional incompleto', legal_basis: 'CLT Art. 29', overridable: false },
      { restriction: 'fleet_vehicle',  severity: 'hard_block', reason: 'Colaborador não ativado', legal_basis: null, overridable: false },
      { restriction: 'system_access',  severity: 'soft_block', reason: 'Acesso restrito até ativação completa', legal_basis: null, overridable: true },
    ],
  },
];

// ═══════════════════════════════════════════════
//  Engine
// ═══════════════════════════════════════════════

/**
 * Evaluate all operational restrictions for a hiring workflow.
 */
export function evaluateHiringRestrictions(workflow: HiringWorkflow): HiringRestrictionProfile {
  const blocks: OperationalBlock[] = [];
  const seen = new Set<string>(); // Deduplicate by restriction type

  for (const rule of PENDENCY_RULES) {
    if (!rule.condition(workflow)) continue;

    for (const r of rule.restrictions) {
      const key = `${r.restriction}:${r.severity}`;
      if (seen.has(key)) continue;
      seen.add(key);

      blocks.push({
        restriction: r.restriction,
        severity: r.severity,
        reason: r.reason,
        legal_basis: r.legal_basis,
        source_step: rule.step,
        overridable: r.overridable,
      });
    }
  }

  return {
    employee_id: workflow.employee_id,
    workflow_id: workflow.id,
    workflow_status: workflow.status,
    is_fully_cleared: blocks.length === 0,
    blocks,
    hard_blocks: blocks.filter(b => b.severity === 'hard_block').length,
    soft_blocks: blocks.filter(b => b.severity === 'soft_block').length,
    warnings: blocks.filter(b => b.severity === 'warning').length,
    evaluated_at: new Date().toISOString(),
  };
}

/**
 * Check if a specific operation is allowed for a workflow.
 */
export function checkOperationAllowed(
  workflow: HiringWorkflow,
  operation: OperationalRestriction,
): RestrictionCheckResult {
  const profile = evaluateHiringRestrictions(workflow);
  const block = profile.blocks.find(b => b.restriction === operation && b.severity === 'hard_block')
    ?? profile.blocks.find(b => b.restriction === operation && b.severity === 'soft_block')
    ?? null;

  return {
    allowed: !block || block.severity === 'warning',
    block,
  };
}

/**
 * Quick check: can employee clock in?
 */
export function canClockIn(workflow: HiringWorkflow): RestrictionCheckResult {
  return checkOperationAllowed(workflow, 'time_clock');
}

/**
 * Quick check: can employee use fleet vehicle?
 */
export function canUseVehicle(workflow: HiringWorkflow): RestrictionCheckResult {
  return checkOperationAllowed(workflow, 'fleet_vehicle');
}

/**
 * Quick check: can employee perform critical operation?
 */
export function canPerformCriticalOperation(
  workflow: HiringWorkflow,
  operation: OperationalRestriction,
): RestrictionCheckResult {
  return checkOperationAllowed(workflow, operation);
}
