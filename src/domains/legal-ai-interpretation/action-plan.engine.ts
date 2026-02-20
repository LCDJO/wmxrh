/**
 * Action Plan Engine — Generate structured action plans from interpretations
 *
 * Converts executive summary + impact analysis into a prioritized,
 * step-by-step action plan with time estimates and responsibilities.
 *
 * Pure domain logic — no I/O.
 */

import type {
  ActionPlanInput,
  ActionPlanResult,
  ActionPlan,
  ActionStep,
  ActionPriority,
  ActionComplexity,
  WorkflowType,
  CostEstimate,
} from './types';

// ── Main Engine ──

export function generateActionPlan(input: ActionPlanInput): ActionPlanResult {
  const steps = buildSteps(input);
  const prioridade = inferPriority(input);
  const complexidade = inferComplexity(input);
  const prazoTotal = steps.reduce((s, step) => Math.max(s, step.prazo_dias), 0);
  const custoTotal = aggregateStepCosts(input);

  const plan: ActionPlan = {
    id: crypto.randomUUID(),
    norm_codigo: input.summary.norm_codigo,
    titulo: `Plano de Adequação — ${input.summary.norm_codigo}`,
    descricao: `Plano de ação para adequação à ${input.summary.norm_codigo} (${input.summary.norm_titulo}). ` +
      `Impacto geral: ${input.summary.impacto_geral}. ` +
      `${input.position_impacts.length} cargo(s) afetado(s).`,
    prioridade,
    complexidade,
    etapas: steps,
    responsaveis_sugeridos: inferResponsaveis(input),
    prazo_total_dias: prazoTotal,
    custo_estimado: custoTotal,
    dependencias: [],
    status: 'draft',
    generated_at: new Date().toISOString(),
  };

  return {
    plan,
    total_steps: steps.length,
    automatable_steps: steps.filter(s => s.automatizavel).length,
    estimated_total_days: prazoTotal,
  };
}

// ── Step Builder ──

function buildSteps(input: ActionPlanInput): ActionStep[] {
  const steps: ActionStep[] = [];
  let ordem = 1;

  // Step 1: always — analysis & communication
  steps.push({
    ordem: ordem++,
    titulo: 'Análise e comunicação interna',
    descricao: `Comunicar a equipe sobre alterações na ${input.summary.norm_codigo} e distribuir resumo executivo.`,
    responsavel_tipo: 'rh',
    prazo_dias: 3,
    entregavel: 'Comunicado interno enviado',
    automatizavel: true,
    workflow_type: 'notify_stakeholders',
  });

  // Area-specific steps
  const areas = new Set(input.interpretation.implicacoes_praticas.map(i => i.area));

  if (hasArea(areas, 'Saúde Ocupacional')) {
    steps.push({
      ordem: ordem++,
      titulo: 'Atualizar programas de saúde ocupacional',
      descricao: 'Revisar PCMSO e ASOs conforme novos requisitos.',
      responsavel_tipo: 'sst',
      prazo_dias: 30,
      entregavel: 'PCMSO atualizado',
      automatizavel: true,
      workflow_type: 'update_health_program',
    });
  }

  if (hasArea(areas, 'Equipamentos de Proteção')) {
    steps.push({
      ordem: ordem++,
      titulo: 'Revisar catálogo de EPIs',
      descricao: 'Atualizar EPIs obrigatórios conforme nova regulamentação.',
      responsavel_tipo: 'sst',
      prazo_dias: 15,
      entregavel: 'Catálogo de EPIs revisado',
      automatizavel: true,
      workflow_type: 'update_epi',
    });
  }

  if (hasArea(areas, 'Treinamento')) {
    steps.push({
      ordem: ordem++,
      titulo: 'Programar reciclagem de treinamentos',
      descricao: 'Agendar reciclagem para cargos afetados pela alteração.',
      responsavel_tipo: 'rh',
      prazo_dias: 45,
      entregavel: 'Cronograma de reciclagem aprovado',
      automatizavel: true,
      workflow_type: 'update_training',
    });
  }

  if (hasArea(areas, 'Segurança do Trabalho')) {
    steps.push({
      ordem: ordem++,
      titulo: 'Atualizar mapeamento de riscos',
      descricao: 'Revisar PGR e inventário de riscos.',
      responsavel_tipo: 'sst',
      prazo_dias: 30,
      entregavel: 'PGR atualizado',
      automatizavel: true,
      workflow_type: 'update_risk_mapping',
    });
  }

  if (hasArea(areas, 'Folha de Pagamento') || hasArea(areas, 'Jornada')) {
    steps.push({
      ordem: ordem++,
      titulo: 'Recalcular folha / simulação',
      descricao: 'Recalcular simulações de folha considerando novos parâmetros.',
      responsavel_tipo: 'financeiro',
      prazo_dias: 15,
      entregavel: 'Simulação recalculada',
      automatizavel: true,
      workflow_type: 'recalculate_payroll',
    });
  }

  if (hasArea(areas, 'eSocial')) {
    steps.push({
      ordem: ordem++,
      titulo: 'Adequar eventos eSocial',
      descricao: 'Ajustar layouts e eventos do eSocial conforme alteração.',
      responsavel_tipo: 'ti',
      prazo_dias: 20,
      entregavel: 'Eventos eSocial atualizados',
      automatizavel: false,
      workflow_type: null,
    });
  }

  // Final step: audit
  steps.push({
    ordem: ordem++,
    titulo: 'Auditoria de conformidade',
    descricao: `Verificar que todas as adequações da ${input.summary.norm_codigo} foram implementadas.`,
    responsavel_tipo: 'juridico',
    prazo_dias: 10,
    entregavel: 'Relatório de conformidade',
    automatizavel: true,
    workflow_type: 'audit_compliance',
  });

  return steps;
}

// ── Inference ──

function inferPriority(input: ActionPlanInput): ActionPriority {
  const imp = input.summary.impacto_geral;
  if (imp === 'critico') return 'imediata';
  if (imp === 'alto') return 'curto_prazo';
  if (imp === 'moderado') return 'medio_prazo';
  return 'longo_prazo';
}

function inferComplexity(input: ActionPlanInput): ActionComplexity {
  const areas = input.interpretation.implicacoes_praticas.length;
  const positions = input.position_impacts.length;
  if (areas >= 4 || positions >= 20) return 'critica';
  if (areas >= 3 || positions >= 10) return 'complexa';
  if (areas >= 2 || positions >= 5) return 'moderada';
  return 'simples';
}

function inferResponsaveis(input: ActionPlanInput): string[] {
  const roles = new Set<string>();
  roles.add('RH');
  input.interpretation.implicacoes_praticas.forEach(impl => {
    impl.departamentos_envolvidos.forEach(d => roles.add(d));
  });
  return Array.from(roles);
}

function aggregateStepCosts(input: ActionPlanInput): CostEstimate | null {
  let minTotal = 0, maxTotal = 0;
  const components: { item: string; valor: number }[] = [];

  for (const imp of input.position_impacts) {
    if (imp.custo_estimado) {
      minTotal += imp.custo_estimado.valor_minimo;
      maxTotal += imp.custo_estimado.valor_maximo;
      components.push(...imp.custo_estimado.componentes);
    }
  }

  if (components.length === 0) return null;
  return { valor_minimo: minTotal, valor_maximo: maxTotal, moeda: 'BRL', componentes: components };
}

// ── Util ──

function hasArea(areas: Set<string>, keyword: string): boolean {
  for (const a of areas) {
    if (a.toLowerCase().includes(keyword.toLowerCase())) return true;
  }
  return false;
}
