/**
 * Workflow Generation Engine — Auto-generate workflow specs from action steps
 *
 * Converts automatable action steps into workflow node/edge definitions
 * compatible with the iPaaS Automation Engine.
 *
 * Pure domain logic — no I/O.
 */

import type {
  WorkflowGenerationInput,
  WorkflowGenerationResult,
  GeneratedWorkflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowType,
  ActionStep,
  ActionPlan,
} from './types';

// ── Main Engine ──

export function generateWorkflows(plan: ActionPlan, tenant_id: string): WorkflowGenerationResult {
  const workflows: GeneratedWorkflow[] = [];

  for (const step of plan.etapas) {
    if (!step.automatizavel || !step.workflow_type) continue;

    const wf = buildWorkflow({ tenant_id, action_plan: plan, step });
    workflows.push(wf);
  }

  return {
    workflows,
    total_generated: workflows.length,
    requires_approval_count: workflows.filter(w => w.requires_approval).length,
  };
}

// ── Workflow Builders ──

function buildWorkflow(input: WorkflowGenerationInput): GeneratedWorkflow {
  const { step, action_plan } = input;
  const template = WORKFLOW_TEMPLATES[step.workflow_type!] || getDefaultTemplate(step);

  return {
    id: crypto.randomUUID(),
    action_plan_id: action_plan.id,
    action_step_ordem: step.ordem,
    workflow_type: step.workflow_type!,
    titulo: step.titulo,
    descricao: step.descricao,
    trigger_event: template.trigger,
    nodes: template.nodes,
    edges: template.edges,
    input_params: {
      norm_codigo: action_plan.norm_codigo,
      step_titulo: step.titulo,
      prazo_dias: step.prazo_dias,
      responsavel_tipo: step.responsavel_tipo,
    },
    estimated_duration_minutes: template.duration,
    requires_approval: template.requiresApproval,
    generated_at: new Date().toISOString(),
  };
}

// ── Templates ──

interface WorkflowTemplate {
  trigger: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  duration: number;
  requiresApproval: boolean;
}

const WORKFLOW_TEMPLATES: Record<WorkflowType, WorkflowTemplate> = {
  notify_stakeholders: {
    trigger: 'legal_change.detected',
    nodes: [
      { id: 'start', type: 'start', label: 'Início', config: {} },
      { id: 'prepare', type: 'action', label: 'Preparar comunicado', config: { template: 'regulatory_alert' } },
      { id: 'send', type: 'notification', label: 'Enviar notificação', config: { channels: ['email', 'in_app'] } },
      { id: 'end', type: 'end', label: 'Fim', config: {} },
    ],
    edges: [
      { source: 'start', target: 'prepare', condition: null },
      { source: 'prepare', target: 'send', condition: null },
      { source: 'send', target: 'end', condition: null },
    ],
    duration: 5,
    requiresApproval: false,
  },
  update_training: {
    trigger: 'legal_change.training_impact',
    nodes: [
      { id: 'start', type: 'start', label: 'Início', config: {} },
      { id: 'identify', type: 'action', label: 'Identificar treinamentos afetados', config: {} },
      { id: 'check', type: 'condition', label: 'Requer reciclagem?', config: {} },
      { id: 'schedule', type: 'action', label: 'Agendar reciclagem', config: {} },
      { id: 'approve', type: 'approval', label: 'Aprovação gestor', config: {} },
      { id: 'notify', type: 'notification', label: 'Notificar colaboradores', config: {} },
      { id: 'end', type: 'end', label: 'Fim', config: {} },
    ],
    edges: [
      { source: 'start', target: 'identify', condition: null },
      { source: 'identify', target: 'check', condition: null },
      { source: 'check', target: 'schedule', condition: 'requires_recycling == true' },
      { source: 'check', target: 'end', condition: 'requires_recycling == false' },
      { source: 'schedule', target: 'approve', condition: null },
      { source: 'approve', target: 'notify', condition: 'approved' },
      { source: 'notify', target: 'end', condition: null },
    ],
    duration: 30,
    requiresApproval: true,
  },
  update_epi: {
    trigger: 'legal_change.epi_impact',
    nodes: [
      { id: 'start', type: 'start', label: 'Início', config: {} },
      { id: 'review', type: 'action', label: 'Revisar catálogo EPIs', config: {} },
      { id: 'approve', type: 'approval', label: 'Aprovação SST', config: {} },
      { id: 'update', type: 'action', label: 'Atualizar registros', config: {} },
      { id: 'notify', type: 'notification', label: 'Notificar gestores', config: {} },
      { id: 'end', type: 'end', label: 'Fim', config: {} },
    ],
    edges: [
      { source: 'start', target: 'review', condition: null },
      { source: 'review', target: 'approve', condition: null },
      { source: 'approve', target: 'update', condition: 'approved' },
      { source: 'update', target: 'notify', condition: null },
      { source: 'notify', target: 'end', condition: null },
    ],
    duration: 20,
    requiresApproval: true,
  },
  update_health_program: {
    trigger: 'legal_change.health_impact',
    nodes: [
      { id: 'start', type: 'start', label: 'Início', config: {} },
      { id: 'review', type: 'action', label: 'Revisar PCMSO', config: {} },
      { id: 'update_exams', type: 'action', label: 'Atualizar exames', config: {} },
      { id: 'approve', type: 'approval', label: 'Aprovação médico coordenador', config: {} },
      { id: 'schedule', type: 'action', label: 'Agendar exames pendentes', config: {} },
      { id: 'end', type: 'end', label: 'Fim', config: {} },
    ],
    edges: [
      { source: 'start', target: 'review', condition: null },
      { source: 'review', target: 'update_exams', condition: null },
      { source: 'update_exams', target: 'approve', condition: null },
      { source: 'approve', target: 'schedule', condition: 'approved' },
      { source: 'schedule', target: 'end', condition: null },
    ],
    duration: 45,
    requiresApproval: true,
  },
  update_risk_mapping: {
    trigger: 'legal_change.risk_impact',
    nodes: [
      { id: 'start', type: 'start', label: 'Início', config: {} },
      { id: 'review', type: 'action', label: 'Revisar PGR', config: {} },
      { id: 'update', type: 'action', label: 'Atualizar inventário de riscos', config: {} },
      { id: 'approve', type: 'approval', label: 'Aprovação engenheiro de segurança', config: {} },
      { id: 'end', type: 'end', label: 'Fim', config: {} },
    ],
    edges: [
      { source: 'start', target: 'review', condition: null },
      { source: 'review', target: 'update', condition: null },
      { source: 'update', target: 'approve', condition: null },
      { source: 'approve', target: 'end', condition: 'approved' },
    ],
    duration: 60,
    requiresApproval: true,
  },
  recalculate_payroll: {
    trigger: 'legal_change.payroll_impact',
    nodes: [
      { id: 'start', type: 'start', label: 'Início', config: {} },
      { id: 'identify', type: 'action', label: 'Identificar rubricas afetadas', config: {} },
      { id: 'simulate', type: 'action', label: 'Rodar simulação', config: {} },
      { id: 'approve', type: 'approval', label: 'Aprovação financeiro', config: {} },
      { id: 'apply', type: 'action', label: 'Aplicar ajustes', config: {} },
      { id: 'end', type: 'end', label: 'Fim', config: {} },
    ],
    edges: [
      { source: 'start', target: 'identify', condition: null },
      { source: 'identify', target: 'simulate', condition: null },
      { source: 'simulate', target: 'approve', condition: null },
      { source: 'approve', target: 'apply', condition: 'approved' },
      { source: 'apply', target: 'end', condition: null },
    ],
    duration: 30,
    requiresApproval: true,
  },
  update_salary_floor: {
    trigger: 'legal_change.salary_floor_impact',
    nodes: [
      { id: 'start', type: 'start', label: 'Início', config: {} },
      { id: 'calc', type: 'action', label: 'Calcular novo piso', config: {} },
      { id: 'approve', type: 'approval', label: 'Aprovação RH', config: {} },
      { id: 'apply', type: 'action', label: 'Atualizar pisos', config: {} },
      { id: 'end', type: 'end', label: 'Fim', config: {} },
    ],
    edges: [
      { source: 'start', target: 'calc', condition: null },
      { source: 'calc', target: 'approve', condition: null },
      { source: 'approve', target: 'apply', condition: 'approved' },
      { source: 'apply', target: 'end', condition: null },
    ],
    duration: 15,
    requiresApproval: true,
  },
  update_agreement: {
    trigger: 'legal_change.agreement_impact',
    nodes: [
      { id: 'start', type: 'start', label: 'Início', config: {} },
      { id: 'review', type: 'action', label: 'Revisar cláusulas', config: {} },
      { id: 'notify', type: 'notification', label: 'Notificar jurídico', config: {} },
      { id: 'end', type: 'end', label: 'Fim', config: {} },
    ],
    edges: [
      { source: 'start', target: 'review', condition: null },
      { source: 'review', target: 'notify', condition: null },
      { source: 'notify', target: 'end', condition: null },
    ],
    duration: 20,
    requiresApproval: false,
  },
  audit_compliance: {
    trigger: 'action_plan.completed',
    nodes: [
      { id: 'start', type: 'start', label: 'Início', config: {} },
      { id: 'collect', type: 'action', label: 'Coletar evidências', config: {} },
      { id: 'evaluate', type: 'action', label: 'Avaliar conformidade', config: {} },
      { id: 'report', type: 'action', label: 'Gerar relatório', config: {} },
      { id: 'end', type: 'end', label: 'Fim', config: {} },
    ],
    edges: [
      { source: 'start', target: 'collect', condition: null },
      { source: 'collect', target: 'evaluate', condition: null },
      { source: 'evaluate', target: 'report', condition: null },
      { source: 'report', target: 'end', condition: null },
    ],
    duration: 30,
    requiresApproval: false,
  },
  custom: {
    trigger: 'manual',
    nodes: [
      { id: 'start', type: 'start', label: 'Início', config: {} },
      { id: 'action', type: 'action', label: 'Executar ação customizada', config: {} },
      { id: 'end', type: 'end', label: 'Fim', config: {} },
    ],
    edges: [
      { source: 'start', target: 'action', condition: null },
      { source: 'action', target: 'end', condition: null },
    ],
    duration: 15,
    requiresApproval: false,
  },
};

function getDefaultTemplate(step: ActionStep): WorkflowTemplate {
  return WORKFLOW_TEMPLATES.custom;
}
