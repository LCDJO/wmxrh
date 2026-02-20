/**
 * Safety Automation Integration Engine
 *
 * Integrates critical legal changes with the Safety Automation Engine:
 *  - Creates SafetyWorkflows automatically for critical impacts
 *  - Notifies HR via structured alerts
 *  - Updates CareerLegalMappings with new requirements
 *  - Triggers RiskScore recalculation for affected employees
 *
 * Pure domain logic — orchestration layer with typed outputs.
 */

import type { CompanyLegalImpact, RiscoJuridico, CargoAfetado } from './impact-mapping.engine';
import type { LegalActionPlan, TarefaRecomendada } from './action-plan-generator.engine';

// ── Output Types ──

export type SafetyWorkflowTipo = 'revisao_pgr' | 'atualizacao_pcmso' | 'reciclagem_treinamento'
  | 'reavaliacao_epi' | 'medicao_ambiental' | 'adequacao_esocial' | 'auditoria_conformidade';

export type SafetyWorkflowStatus = 'criado' | 'em_execucao' | 'concluido' | 'cancelado' | 'escalado';

export type NotificacaoCanal = 'sistema' | 'email' | 'push';

export type NotificacaoPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente';

export interface SafetyWorkflow {
  id: string;
  tipo: SafetyWorkflowTipo;
  titulo: string;
  descricao: string;
  company_id: string;
  tenant_id: string;
  prazo_dias: number;
  prioridade: NotificacaoPrioridade;
  status: SafetyWorkflowStatus;
  cargos_afetados: string[];
  colaboradores_afetados: number;
  tarefas_vinculadas: string[];
  norma_referencia: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface NotificacaoRH {
  id: string;
  tipo: 'mudanca_legal_critica' | 'workflow_criado' | 'prazo_proximo' | 'acao_necessaria';
  titulo: string;
  mensagem: string;
  canal: NotificacaoCanal;
  prioridade: NotificacaoPrioridade;
  destinatario_tipo: 'rh' | 'gestao' | 'sst' | 'juridico';
  company_id: string;
  tenant_id: string;
  dados_contexto: {
    norma: string;
    workflows_criados: number;
    colaboradores_afetados: number;
    prazo_adequacao: number;
    risco: RiscoJuridico;
  };
  lida: boolean;
  created_at: string;
}

export interface CareerLegalMappingUpdate {
  career_position_id: string;
  cbo_codigo: string;
  campo: string;
  valor_anterior: unknown;
  valor_novo: unknown;
  motivo: string;
  norma_referencia: string;
}

export interface RiskScoreRecalculation {
  employee_id: string;
  company_id: string;
  fatores_impactados: string[];
  recalculo_motivo: string;
  norma_referencia: string;
  prioridade: NotificacaoPrioridade;
}

export interface SafetyAutomationResult {
  workflows_criados: SafetyWorkflow[];
  notificacoes_rh: NotificacaoRH[];
  career_mappings_atualizados: CareerLegalMappingUpdate[];
  risk_recalculations: RiskScoreRecalculation[];
  resumo: {
    total_workflows: number;
    total_notificacoes: number;
    total_mappings: number;
    total_recalculations: number;
    empresas_afetadas: number;
    risco_maximo: RiscoJuridico;
  };
  triggered_at: string;
}

export interface SafetyAutomationInput {
  norm_codigo: string;
  norm_tipo: string;
  areas_impactadas: string[];
  nrs_afetadas: string[];
  company_impacts: CompanyLegalImpact[];
  action_plans: LegalActionPlan[];
  tenant_id: string;
}

// ── Risk threshold for triggering automation ──
const CRITICAL_RISK_LEVELS: RiscoJuridico[] = ['critico', 'alto'];

// ── NR → Workflow Type mapping ──
const NR_WORKFLOW_MAP: Record<string, SafetyWorkflowTipo[]> = {
  'NR-1':  ['revisao_pgr', 'reciclagem_treinamento'],
  'NR-4':  ['auditoria_conformidade'],
  'NR-5':  ['auditoria_conformidade'],
  'NR-6':  ['reavaliacao_epi'],
  'NR-7':  ['atualizacao_pcmso'],
  'NR-9':  ['revisao_pgr', 'medicao_ambiental'],
  'NR-10': ['reciclagem_treinamento', 'auditoria_conformidade'],
  'NR-12': ['auditoria_conformidade'],
  'NR-15': ['medicao_ambiental', 'atualizacao_pcmso'],
  'NR-16': ['auditoria_conformidade'],
  'NR-17': ['revisao_pgr'],
  'NR-18': ['revisao_pgr', 'reavaliacao_epi'],
  'NR-33': ['reciclagem_treinamento', 'auditoria_conformidade'],
  'NR-35': ['reciclagem_treinamento', 'auditoria_conformidade'],
};

const WORKFLOW_LABELS: Record<SafetyWorkflowTipo, string> = {
  revisao_pgr: 'Revisão do PGR',
  atualizacao_pcmso: 'Atualização do PCMSO',
  reciclagem_treinamento: 'Reciclagem de Treinamentos',
  reavaliacao_epi: 'Reavaliação de EPIs',
  medicao_ambiental: 'Medição Ambiental',
  adequacao_esocial: 'Adequação eSocial',
  auditoria_conformidade: 'Auditoria de Conformidade',
};

// ── Main Engine ──

export function integrateSafetyAutomation(input: SafetyAutomationInput): SafetyAutomationResult {
  const workflows: SafetyWorkflow[] = [];
  const notificacoes: NotificacaoRH[] = [];
  const mappingUpdates: CareerLegalMappingUpdate[] = [];
  const riskRecalcs: RiskScoreRecalculation[] = [];

  let riscoMaximo: RiscoJuridico = 'baixo';
  const riskOrder: RiscoJuridico[] = ['baixo', 'medio', 'alto', 'critico'];

  for (const impact of input.company_impacts) {
    const isCritical = CRITICAL_RISK_LEVELS.includes(impact.risco_juridico_estimado);

    // Track max risk
    if (riskOrder.indexOf(impact.risco_juridico_estimado) > riskOrder.indexOf(riscoMaximo)) {
      riscoMaximo = impact.risco_juridico_estimado;
    }

    if (!isCritical) continue;

    // 1. Create SafetyWorkflows
    const companyWorkflows = buildWorkflows(input, impact);
    workflows.push(...companyWorkflows);

    // 2. Generate HR notifications
    const notification = buildHRNotification(input, impact, companyWorkflows.length);
    notificacoes.push(notification);

    // 3. Update CareerLegalMappings
    const mappings = buildCareerMappingUpdates(input, impact);
    mappingUpdates.push(...mappings);

    // 4. Queue RiskScore recalculations
    const recalcs = buildRiskRecalculations(input, impact);
    riskRecalcs.push(...recalcs);
  }

  return {
    workflows_criados: workflows,
    notificacoes_rh: notificacoes,
    career_mappings_atualizados: mappingUpdates,
    risk_recalculations: riskRecalcs,
    resumo: {
      total_workflows: workflows.length,
      total_notificacoes: notificacoes.length,
      total_mappings: mappingUpdates.length,
      total_recalculations: riskRecalcs.length,
      empresas_afetadas: input.company_impacts.filter(i => CRITICAL_RISK_LEVELS.includes(i.risco_juridico_estimado)).length,
      risco_maximo: riscoMaximo,
    },
    triggered_at: new Date().toISOString(),
  };
}

// ── Workflow Builder ──

function buildWorkflows(input: SafetyAutomationInput, impact: CompanyLegalImpact): SafetyWorkflow[] {
  const result: SafetyWorkflow[] = [];
  const addedTypes = new Set<SafetyWorkflowTipo>();

  for (const nr of input.nrs_afetadas) {
    const tipos = NR_WORKFLOW_MAP[nr] || [];
    for (const tipo of tipos) {
      if (addedTypes.has(tipo)) continue;
      addedTypes.add(tipo);

      // Find linked tasks from action plan
      const plan = input.action_plans.find(p => p.empresa.id === impact.company_id);
      const linkedTasks = plan?.tarefas_recomendadas
        .filter(t => matchesWorkflowType(t, tipo))
        .map(t => t.id) ?? [];

      result.push({
        id: crypto.randomUUID(),
        tipo,
        titulo: `${WORKFLOW_LABELS[tipo]} — ${input.norm_codigo}`,
        descricao: `Workflow automático gerado pela mudança na ${input.norm_codigo}. Empresa: ${impact.company_name}. ${impact.numero_colaboradores_afetados} colaborador(es) afetado(s).`,
        company_id: impact.company_id,
        tenant_id: input.tenant_id,
        prazo_dias: computeWorkflowDeadline(tipo, impact.risco_juridico_estimado),
        prioridade: mapRiskToPriority(impact.risco_juridico_estimado),
        status: 'criado',
        cargos_afetados: impact.cargos_afetados.map(c => c.cargo_id),
        colaboradores_afetados: impact.numero_colaboradores_afetados,
        tarefas_vinculadas: linkedTasks,
        norma_referencia: input.norm_codigo,
        created_at: new Date().toISOString(),
        metadata: {
          nrs_afetadas: input.nrs_afetadas,
          areas_impactadas: input.areas_impactadas,
          risco: impact.risco_juridico_estimado,
        },
      });
    }
  }

  // Always add eSocial workflow for critical changes
  if (input.areas_impactadas.includes('esocial') && !addedTypes.has('adequacao_esocial')) {
    result.push({
      id: crypto.randomUUID(),
      tipo: 'adequacao_esocial',
      titulo: `Adequação eSocial — ${input.norm_codigo}`,
      descricao: `Ajustar eventos do eSocial conforme alteração na ${input.norm_codigo}.`,
      company_id: impact.company_id,
      tenant_id: input.tenant_id,
      prazo_dias: 20,
      prioridade: 'alta',
      status: 'criado',
      cargos_afetados: [],
      colaboradores_afetados: impact.numero_colaboradores_afetados,
      tarefas_vinculadas: [],
      norma_referencia: input.norm_codigo,
      created_at: new Date().toISOString(),
      metadata: { areas_impactadas: input.areas_impactadas },
    });
  }

  return result;
}

// ── HR Notification Builder ──

function buildHRNotification(
  input: SafetyAutomationInput,
  impact: CompanyLegalImpact,
  workflowCount: number
): NotificacaoRH {
  const prioridade = mapRiskToPriority(impact.risco_juridico_estimado);
  return {
    id: crypto.randomUUID(),
    tipo: 'mudanca_legal_critica',
    titulo: `⚠️ Mudança Legal Crítica: ${input.norm_codigo}`,
    mensagem: buildNotificationMessage(input, impact, workflowCount),
    canal: prioridade === 'urgente' ? 'email' : 'sistema',
    prioridade,
    destinatario_tipo: 'rh',
    company_id: impact.company_id,
    tenant_id: input.tenant_id,
    dados_contexto: {
      norma: input.norm_codigo,
      workflows_criados: workflowCount,
      colaboradores_afetados: impact.numero_colaboradores_afetados,
      prazo_adequacao: impact.prazo_adequacao,
      risco: impact.risco_juridico_estimado,
    },
    lida: false,
    created_at: new Date().toISOString(),
  };
}

function buildNotificationMessage(
  input: SafetyAutomationInput,
  impact: CompanyLegalImpact,
  workflowCount: number
): string {
  const lines = [
    `A norma ${input.norm_codigo} sofreu alteração com impacto ${impact.risco_juridico_estimado.toUpperCase()} na empresa ${impact.company_name}.`,
    ``,
    `• ${impact.cargos_afetados.length} cargo(s) afetado(s)`,
    `• ${impact.numero_colaboradores_afetados} colaborador(es) impactado(s)`,
    `• ${workflowCount} workflow(s) de segurança criado(s) automaticamente`,
    `• Prazo de adequação: ${impact.prazo_adequacao} dias`,
    ``,
    `Ações recomendadas: ${impact.acoes_recomendadas.slice(0, 3).join('; ')}.`,
  ];
  return lines.join('\n');
}

// ── Career Legal Mapping Updates ──

function buildCareerMappingUpdates(
  input: SafetyAutomationInput,
  impact: CompanyLegalImpact
): CareerLegalMappingUpdate[] {
  const updates: CareerLegalMappingUpdate[] = [];

  for (const cargo of impact.cargos_afetados) {
    // Training requirement update
    if (input.areas_impactadas.includes('treinamentos') || input.areas_impactadas.includes('seguranca_trabalho')) {
      updates.push({
        career_position_id: cargo.cargo_id,
        cbo_codigo: cargo.cbo_codigo,
        campo: 'exige_treinamento',
        valor_anterior: null,
        valor_novo: true,
        motivo: `Exigência atualizada pela ${input.norm_codigo}`,
        norma_referencia: input.norm_codigo,
      });
    }

    // EPI requirement update
    if (input.areas_impactadas.includes('epi')) {
      updates.push({
        career_position_id: cargo.cargo_id,
        cbo_codigo: cargo.cbo_codigo,
        campo: 'exige_epi',
        valor_anterior: null,
        valor_novo: true,
        motivo: `EPIs revisados conforme ${input.norm_codigo}`,
        norma_referencia: input.norm_codigo,
      });
    }

    // Medical exam update
    if (input.areas_impactadas.includes('saude_ocupacional')) {
      updates.push({
        career_position_id: cargo.cargo_id,
        cbo_codigo: cargo.cbo_codigo,
        campo: 'exige_exame_medico',
        valor_anterior: null,
        valor_novo: true,
        motivo: `Exames atualizados conforme ${input.norm_codigo}`,
        norma_referencia: input.norm_codigo,
      });
    }

    // NR code update
    if (input.nrs_afetadas.length > 0) {
      updates.push({
        career_position_id: cargo.cargo_id,
        cbo_codigo: cargo.cbo_codigo,
        campo: 'nr_codigo',
        valor_anterior: null,
        valor_novo: input.nrs_afetadas.join(', '),
        motivo: `NRs aplicáveis atualizadas pela ${input.norm_codigo}`,
        norma_referencia: input.norm_codigo,
      });
    }
  }

  return updates;
}

// ── Risk Score Recalculation ──

function buildRiskRecalculations(
  input: SafetyAutomationInput,
  impact: CompanyLegalImpact
): RiskScoreRecalculation[] {
  const recalcs: RiskScoreRecalculation[] = [];
  const prioridade = mapRiskToPriority(impact.risco_juridico_estimado);

  // Generate one recalculation entry per affected cargo (represents batch of employees)
  for (const cargo of impact.cargos_afetados) {
    const fatores: string[] = [];
    if (input.areas_impactadas.includes('seguranca_trabalho')) fatores.push('seguranca_ocupacional');
    if (input.areas_impactadas.includes('saude_ocupacional')) fatores.push('saude_ocupacional');
    if (input.areas_impactadas.includes('treinamentos')) fatores.push('treinamentos_vencidos');
    if (input.areas_impactadas.includes('epi')) fatores.push('epi_inadequado');
    if (fatores.length === 0) fatores.push('conformidade_legal');

    recalcs.push({
      employee_id: `batch:${cargo.cargo_id}`, // batch marker — resolved at execution
      company_id: impact.company_id,
      fatores_impactados: fatores,
      recalculo_motivo: `Mudança na ${input.norm_codigo} afeta cargo ${cargo.cargo_nome} (${cargo.funcionarios_count} colaboradores)`,
      norma_referencia: input.norm_codigo,
      prioridade,
    });
  }

  return recalcs;
}

// ── Helpers ──

function mapRiskToPriority(risco: RiscoJuridico): NotificacaoPrioridade {
  const map: Record<RiscoJuridico, NotificacaoPrioridade> = {
    critico: 'urgente',
    alto: 'alta',
    medio: 'normal',
    baixo: 'baixa',
  };
  return map[risco];
}

function computeWorkflowDeadline(tipo: SafetyWorkflowTipo, risco: RiscoJuridico): number {
  const baseDeadlines: Record<SafetyWorkflowTipo, number> = {
    revisao_pgr: 30,
    atualizacao_pcmso: 30,
    reciclagem_treinamento: 45,
    reavaliacao_epi: 20,
    medicao_ambiental: 45,
    adequacao_esocial: 20,
    auditoria_conformidade: 15,
  };
  const base = baseDeadlines[tipo];
  // Reduce deadline for critical risks
  if (risco === 'critico') return Math.max(7, Math.floor(base * 0.5));
  if (risco === 'alto') return Math.max(10, Math.floor(base * 0.7));
  return base;
}

function matchesWorkflowType(task: TarefaRecomendada, tipo: SafetyWorkflowTipo): boolean {
  const tagMap: Record<SafetyWorkflowTipo, string[]> = {
    revisao_pgr: ['pgr', 'riscos'],
    atualizacao_pcmso: ['pcmso', 'saude', 'exames'],
    reciclagem_treinamento: ['treinamento'],
    reavaliacao_epi: ['epi'],
    medicao_ambiental: ['medicao', 'ambiente'],
    adequacao_esocial: ['esocial'],
    auditoria_conformidade: ['auditoria', 'conformidade'],
  };
  const relevantTags = tagMap[tipo] || [];
  return task.tags.some(t => relevantTags.includes(t));
}
