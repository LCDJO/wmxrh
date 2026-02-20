/**
 * Legal Automated Actions Engine
 *
 * Reacts to critical legal changes by generating executable action plans:
 *   1. Create Safety Automation workflows
 *   2. Require new NR trainings
 *   3. Update suggested salary floor
 *   4. Trigger Payroll Simulation recalculation
 *
 * Pure domain logic — outputs action descriptors, no I/O.
 * Consumers (services/hooks) execute the actual side-effects.
 */

import type {
  LegalImpactNotification,
  AffectedCargo,
  AffectedTreinamento,
  AffectedEpi,
} from './legal-impact-analyzer.engine';
import type { GravidadeMudanca, AreaImpacto } from './legal-diff.engine';

// ── Action Types ──

export type AutomatedActionType =
  | 'create_safety_workflow'
  | 'require_training'
  | 'update_salary_floor'
  | 'recalculate_payroll'
  | 'update_epi_requirements'
  | 'update_health_program'
  | 'notify_stakeholders'
  | 'create_compliance_task';

export type ActionStatus = 'pending' | 'approved' | 'executed' | 'rejected' | 'failed';

export interface AutomatedActionBase {
  action_id: string;
  action_type: AutomatedActionType;
  /** Human-readable title */
  titulo: string;
  descricao: string;
  /** Source notification that triggered this */
  notification_id: string;
  change_id: string;
  document_code: string;
  /** Severity inherited from legal change */
  gravidade: GravidadeMudanca;
  /** Always requires human approval */
  requires_approval: boolean;
  status: ActionStatus;
  /** Priority order (lower = more urgent) */
  prioridade: number;
  /** Suggested deadline in days */
  prazo_dias: number;
  /** Entities affected by this action */
  entity_ids: string[];
  /** Additional structured payload for executor */
  payload: Record<string, unknown>;
  created_at: string;
}

// ── Specific Action Payloads ──

export interface CreateSafetyWorkflowAction extends AutomatedActionBase {
  action_type: 'create_safety_workflow';
  payload: {
    workflow_name: string;
    trigger_event: string;
    playbook_type: 'nr_update' | 'risk_reassessment' | 'epi_review' | 'health_program_update';
    nr_numbers: number[];
    affected_cargo_ids: string[];
    affected_employee_count_estimate: number;
    tasks: {
      titulo: string;
      descricao: string;
      assignee_role: 'gestor' | 'rh' | 'sesmt' | 'admin';
      prazo_dias: number;
    }[];
  };
}

export interface RequireTrainingAction extends AutomatedActionBase {
  action_type: 'require_training';
  payload: {
    treinamento_ids: string[];
    nr_numbers: number[];
    motivo: string;
    /** Whether existing certificates should be invalidated */
    invalidate_existing: boolean;
    /** New minimum hours (if changed) */
    nova_carga_horaria: number | null;
    /** Estimated employees needing retraining */
    funcionarios_afetados: number;
    prazo_conclusao_dias: number;
  };
}

export interface UpdateSalaryFloorAction extends AutomatedActionBase {
  action_type: 'update_salary_floor';
  payload: {
    cargo_ids: string[];
    motivo: string;
    /** Source of the new floor (e.g., "CCT 2026", "Portaria X") */
    fonte: string;
    /** Suggested action: review or auto-update */
    sugestao: 'revisar_manualmente' | 'aplicar_reajuste';
    /** If a percentage was detected in the legal change */
    percentual_reajuste: number | null;
    /** If a fixed value was detected */
    valor_piso_sugerido: number | null;
  };
}

export interface RecalculatePayrollAction extends AutomatedActionBase {
  action_type: 'recalculate_payroll';
  payload: {
    motivo: string;
    areas_afetadas: AreaImpacto[];
    /** Which payroll components need recalculation */
    componentes: (
      | 'base_salary'
      | 'insalubridade'
      | 'periculosidade'
      | 'adicional_noturno'
      | 'hora_extra'
      | 'encargos_patronais'
      | 'beneficios'
      | 'fgts'
      | 'inss'
      | 'irrf'
    )[];
    /** Period to recalculate */
    competencia_inicio: string;
    /** Estimated financial impact */
    impacto_estimado: 'baixo' | 'moderado' | 'alto' | 'critico';
    cargo_ids: string[];
  };
}

export interface UpdateEpiRequirementsAction extends AutomatedActionBase {
  action_type: 'update_epi_requirements';
  payload: {
    epi_ids: string[];
    motivo: string;
    /** Whether CAs need re-validation */
    revalidar_ca: boolean;
    /** Risk agents affected */
    agentes_risco: string[];
    nr_referencia: string | null;
  };
}

export interface UpdateHealthProgramAction extends AutomatedActionBase {
  action_type: 'update_health_program';
  payload: {
    programa_tipo: 'pcmso' | 'pgr' | 'ltcat' | 'ppra';
    motivo: string;
    /** Whether new exams are required */
    novos_exames_requeridos: boolean;
    /** Risk factors that changed */
    fatores_risco_alterados: string[];
    cargo_ids: string[];
  };
}

export type AutomatedAction =
  | CreateSafetyWorkflowAction
  | RequireTrainingAction
  | UpdateSalaryFloorAction
  | RecalculatePayrollAction
  | UpdateEpiRequirementsAction
  | UpdateHealthProgramAction
  | AutomatedActionBase;

// ── Output ──

export interface AutomatedActionsResult {
  notification_id: string;
  change_id: string;
  document_code: string;
  gravidade: GravidadeMudanca;
  total_actions: number;
  actions: AutomatedAction[];
  /** Summary for human review */
  resumo: string;
  generated_at: string;
}

// ── Main Engine ──

/**
 * Generate automated action plans from a legal impact notification.
 * All actions are marked `requires_approval: true` — strictly advisory.
 */
export function generateAutomatedActions(
  notification: LegalImpactNotification
): AutomatedActionsResult {
  const actions: AutomatedAction[] = [];
  let priority = 1;
  const ts = new Date().toISOString();

  const isCritical = notification.gravidade === 'critica';
  const isHigh = notification.gravidade === 'alta';
  const areas = new Set(notification.areas_impacto);

  // ── 1. Safety Automation Workflow ──
  if (isCritical || isHigh) {
    const safetyAction = buildSafetyWorkflow(notification, priority++, ts);
    if (safetyAction) actions.push(safetyAction);
  }

  // ── 2. Training Requirements ──
  if (notification.treinamentos_afetados.length > 0) {
    actions.push(buildTrainingAction(notification, priority++, ts));
  }

  // ── 3. Salary Floor Update ──
  if (
    areas.has('folha_pagamento') ||
    areas.has('sindical') ||
    notification.cargos_afetados.some(c => c.motivo.includes('Adicional'))
  ) {
    actions.push(buildSalaryFloorAction(notification, priority++, ts));
  }

  // ── 4. Payroll Recalculation ──
  const payrollAreas: AreaImpacto[] = [
    'folha_pagamento', 'adicional_insalubridade', 'adicional_periculosidade',
    'adicional_noturno', 'fgts', 'inss', 'irrf', 'beneficios',
  ];
  if (payrollAreas.some(a => areas.has(a))) {
    actions.push(buildPayrollAction(notification, payrollAreas.filter(a => areas.has(a)), priority++, ts));
  }

  // ── 5. EPI Requirements ──
  if (notification.epis_afetados.length > 0 || areas.has('epi')) {
    actions.push(buildEpiAction(notification, priority++, ts));
  }

  // ── 6. Health Program Update ──
  if (areas.has('saude_ocupacional') || areas.has('pcmso') || areas.has('pgr')) {
    actions.push(buildHealthProgramAction(notification, priority++, ts));
  }

  // ── Summary ──
  const parts: string[] = [];
  for (const a of actions) {
    parts.push(`• [${a.action_type}] ${a.titulo}`);
  }

  return {
    notification_id: notification.notification_id,
    change_id: notification.change_id,
    document_code: notification.document_code,
    gravidade: notification.gravidade,
    total_actions: actions.length,
    actions,
    resumo: actions.length === 0
      ? 'Nenhuma ação automática necessária para esta alteração.'
      : `${actions.length} ação(ões) gerada(s) para aprovação:\n${parts.join('\n')}`,
    generated_at: ts,
  };
}

// ── Builders ──

function makeId(type: string, changeId: string): string {
  return `action_${type}_${changeId}_${Date.now()}`;
}

function buildSafetyWorkflow(
  n: LegalImpactNotification,
  prioridade: number,
  ts: string
): CreateSafetyWorkflowAction | null {
  const nrNumbers = new Set<number>();
  for (const t of n.treinamentos_afetados) nrNumbers.add(t.nr_number);

  const cargoIds = n.cargos_afetados.map(c => c.cargo_id);
  const totalFunc = n.treinamentos_afetados.reduce((s, t) => s + t.funcionarios_afetados, 0);

  const tasks: CreateSafetyWorkflowAction['payload']['tasks'] = [];

  if (n.treinamentos_afetados.length > 0) {
    tasks.push({
      titulo: 'Revisar conteúdo programático dos treinamentos',
      descricao: `${n.treinamentos_afetados.length} treinamento(s) NR afetado(s) pela mudança legislativa.`,
      assignee_role: 'sesmt',
      prazo_dias: n.gravidade === 'critica' ? 5 : 15,
    });
  }

  if (n.cargos_afetados.length > 0) {
    tasks.push({
      titulo: 'Atualizar mapeamentos legais dos cargos',
      descricao: `${cargoIds.length} cargo(s) com NRs ou requisitos impactados.`,
      assignee_role: 'rh',
      prazo_dias: n.gravidade === 'critica' ? 5 : 10,
    });
  }

  if (n.epis_afetados.length > 0) {
    tasks.push({
      titulo: 'Revisar catálogo de EPIs',
      descricao: `${n.epis_afetados.length} EPI(s) com norma alterada.`,
      assignee_role: 'sesmt',
      prazo_dias: 15,
    });
  }

  tasks.push({
    titulo: 'Comunicar colaboradores sobre mudança normativa',
    descricao: `Elaborar comunicado sobre alteração em ${n.document_title}.`,
    assignee_role: 'rh',
    prazo_dias: n.gravidade === 'critica' ? 3 : 7,
  });

  if (tasks.length === 1) return null; // only the generic communication

  return {
    action_id: makeId('safety_wf', n.change_id),
    action_type: 'create_safety_workflow',
    titulo: `Criar workflow SST: ${n.document_code}`,
    descricao: `Workflow de adequação para mudança em ${n.document_title}. ${tasks.length} tarefa(s) planejada(s).`,
    notification_id: n.notification_id,
    change_id: n.change_id,
    document_code: n.document_code,
    gravidade: n.gravidade,
    requires_approval: true,
    status: 'pending',
    prioridade,
    prazo_dias: n.gravidade === 'critica' ? 5 : 15,
    entity_ids: [...cargoIds, ...n.treinamentos_afetados.map(t => t.treinamento_id)],
    created_at: ts,
    payload: {
      workflow_name: `Adequação Legal — ${n.document_code}`,
      trigger_event: 'legal_change.critical',
      playbook_type: n.treinamentos_afetados.length > 0 ? 'nr_update' : 'risk_reassessment',
      nr_numbers: [...nrNumbers],
      affected_cargo_ids: cargoIds,
      affected_employee_count_estimate: totalFunc,
      tasks,
    },
  };
}

function buildTrainingAction(
  n: LegalImpactNotification,
  prioridade: number,
  ts: string
): RequireTrainingAction {
  const totalFunc = n.treinamentos_afetados.reduce((s, t) => s + t.funcionarios_afetados, 0);
  const nrs = [...new Set(n.treinamentos_afetados.map(t => t.nr_number))];

  return {
    action_id: makeId('training', n.change_id),
    action_type: 'require_training',
    titulo: `Exigir reciclagem: NR-${nrs.join(', NR-')}`,
    descricao: `${n.treinamentos_afetados.length} treinamento(s) impactado(s), ~${totalFunc} funcionário(s) necessitam reciclagem.`,
    notification_id: n.notification_id,
    change_id: n.change_id,
    document_code: n.document_code,
    gravidade: n.gravidade,
    requires_approval: true,
    status: 'pending',
    prioridade,
    prazo_dias: 30,
    entity_ids: n.treinamentos_afetados.map(t => t.treinamento_id),
    created_at: ts,
    payload: {
      treinamento_ids: n.treinamentos_afetados.map(t => t.treinamento_id),
      nr_numbers: nrs,
      motivo: `Alteração em ${n.document_code} exige atualização dos treinamentos.`,
      invalidate_existing: n.gravidade === 'critica',
      nova_carga_horaria: null,
      funcionarios_afetados: totalFunc,
      prazo_conclusao_dias: n.gravidade === 'critica' ? 30 : 60,
    },
  };
}

function buildSalaryFloorAction(
  n: LegalImpactNotification,
  prioridade: number,
  ts: string
): UpdateSalaryFloorAction {
  const cargoIds = n.cargos_afetados.map(c => c.cargo_id);

  // Try to detect percentage from change summary
  let pct: number | null = null;
  const pctMatch = n.mensagem.match(/(\d+[.,]?\d*)\s*%/);
  if (pctMatch) pct = parseFloat(pctMatch[1].replace(',', '.'));

  return {
    action_id: makeId('salary', n.change_id),
    action_type: 'update_salary_floor',
    titulo: `Atualizar piso salarial: ${n.document_code}`,
    descricao: `Alteração legislativa pode impactar piso salarial de ${cargoIds.length || 'múltiplos'} cargo(s).`,
    notification_id: n.notification_id,
    change_id: n.change_id,
    document_code: n.document_code,
    gravidade: n.gravidade,
    requires_approval: true,
    status: 'pending',
    prioridade,
    prazo_dias: n.gravidade === 'critica' ? 5 : 15,
    entity_ids: cargoIds,
    created_at: ts,
    payload: {
      cargo_ids: cargoIds,
      motivo: `Mudança em ${n.document_code} pode alterar pisos ou reajustes salariais.`,
      fonte: `${n.document_code} — ${n.document_title}`,
      sugestao: pct ? 'aplicar_reajuste' : 'revisar_manualmente',
      percentual_reajuste: pct,
      valor_piso_sugerido: null,
    },
  };
}

function buildPayrollAction(
  n: LegalImpactNotification,
  affectedAreas: AreaImpacto[],
  prioridade: number,
  ts: string
): RecalculatePayrollAction {
  const componentMap: Record<string, RecalculatePayrollAction['payload']['componentes'][number]> = {
    folha_pagamento: 'base_salary',
    adicional_insalubridade: 'insalubridade',
    adicional_periculosidade: 'periculosidade',
    adicional_noturno: 'adicional_noturno',
    fgts: 'fgts',
    inss: 'inss',
    irrf: 'irrf',
    beneficios: 'beneficios',
  };

  const componentes = affectedAreas
    .map(a => componentMap[a])
    .filter(Boolean) as RecalculatePayrollAction['payload']['componentes'];

  const cargoIds = n.cargos_afetados.map(c => c.cargo_id);

  return {
    action_id: makeId('payroll', n.change_id),
    action_type: 'recalculate_payroll',
    titulo: `Recalcular simulação de folha: ${n.document_code}`,
    descricao: `Componentes afetados: ${componentes.join(', ')}. Requer nova simulação para avaliar impacto financeiro.`,
    notification_id: n.notification_id,
    change_id: n.change_id,
    document_code: n.document_code,
    gravidade: n.gravidade,
    requires_approval: true,
    status: 'pending',
    prioridade,
    prazo_dias: n.gravidade === 'critica' ? 3 : 10,
    entity_ids: cargoIds,
    created_at: ts,
    payload: {
      motivo: `Alteração em ${n.document_code} afeta cálculos de folha.`,
      areas_afetadas: affectedAreas,
      componentes,
      competencia_inicio: new Date().toISOString().substring(0, 7),
      impacto_estimado: n.gravidade === 'critica' ? 'critico' : n.gravidade === 'alta' ? 'alto' : 'moderado',
      cargo_ids: cargoIds,
    },
  };
}

function buildEpiAction(
  n: LegalImpactNotification,
  prioridade: number,
  ts: string
): UpdateEpiRequirementsAction {
  const epiIds = n.epis_afetados.map(e => e.epi_id);

  return {
    action_id: makeId('epi', n.change_id),
    action_type: 'update_epi_requirements',
    titulo: `Revisar requisitos de EPI: ${n.document_code}`,
    descricao: `${epiIds.length} EPI(s) com norma de referência ou agente de risco alterado.`,
    notification_id: n.notification_id,
    change_id: n.change_id,
    document_code: n.document_code,
    gravidade: n.gravidade,
    requires_approval: true,
    status: 'pending',
    prioridade,
    prazo_dias: 15,
    entity_ids: epiIds,
    created_at: ts,
    payload: {
      epi_ids: epiIds,
      motivo: `Alteração em ${n.document_code} pode afetar especificações de EPI.`,
      revalidar_ca: n.gravidade === 'critica' || n.gravidade === 'alta',
      agentes_risco: n.epis_afetados.map(e => e.motivo),
      nr_referencia: n.document_code,
    },
  };
}

function buildHealthProgramAction(
  n: LegalImpactNotification,
  prioridade: number,
  ts: string
): UpdateHealthProgramAction {
  const areas = new Set(n.areas_impacto);
  const programa: UpdateHealthProgramAction['payload']['programa_tipo'] =
    areas.has('pcmso') ? 'pcmso' : areas.has('pgr') ? 'pgr' : 'pcmso';

  return {
    action_id: makeId('health', n.change_id),
    action_type: 'update_health_program',
    titulo: `Atualizar ${programa.toUpperCase()}: ${n.document_code}`,
    descricao: `Alteração normativa requer revisão do programa de saúde ocupacional.`,
    notification_id: n.notification_id,
    change_id: n.change_id,
    document_code: n.document_code,
    gravidade: n.gravidade,
    requires_approval: true,
    status: 'pending',
    prioridade,
    prazo_dias: 30,
    entity_ids: n.cargos_afetados.map(c => c.cargo_id),
    created_at: ts,
    payload: {
      programa_tipo: programa,
      motivo: `Alteração em ${n.document_code} impacta requisitos de saúde ocupacional.`,
      novos_exames_requeridos: n.gravidade === 'critica',
      fatores_risco_alterados: [],
      cargo_ids: n.cargos_afetados.map(c => c.cargo_id),
    },
  };
}
