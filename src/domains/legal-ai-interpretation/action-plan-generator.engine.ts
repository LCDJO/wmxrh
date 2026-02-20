/**
 * Legal Action Plan Generator
 *
 * Generates per-company action plans from impact mapping results.
 * Produces prioritized task lists based on norm type, risk level,
 * and affected areas.
 *
 * Pure domain logic — no I/O.
 */

import type { CompanyLegalImpact, RiscoJuridico } from './impact-mapping.engine';

// ── Output Types ──

export type PrioridadePlano = 'urgente' | 'alta' | 'media' | 'baixa';

export type TarefaStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';

export interface TarefaRecomendada {
  id: string;
  titulo: string;
  descricao: string;
  responsavel_tipo: 'rh' | 'sst' | 'juridico' | 'gestao' | 'ti' | 'financeiro' | 'medicina';
  prazo_dias: number;
  automatizavel: boolean;
  status: TarefaStatus;
  dependencia_ids: string[];
  tags: string[];
}

export interface LegalActionPlan {
  id: string;
  empresa: { id: string; name: string };
  mudanca_referencia: string;
  tarefas_recomendadas: TarefaRecomendada[];
  prioridade: PrioridadePlano;
  prazo_sugerido: number; // days
  risco_base: RiscoJuridico;
  total_tarefas: number;
  tarefas_automatizaveis: number;
  generated_at: string;
}

export interface ActionPlanGeneratorResult {
  plans: LegalActionPlan[];
  total_plans: number;
  total_tasks: number;
  generated_at: string;
}

// ── Input ──

export interface ActionPlanGeneratorInput {
  norm_codigo: string;
  norm_tipo: string;
  areas_impactadas: string[];
  nrs_afetadas: string[];
  company_impacts: CompanyLegalImpact[];
}

// ── NR → Task Catalog ──

interface TaskTemplate {
  titulo: string;
  descricao: string;
  responsavel_tipo: TarefaRecomendada['responsavel_tipo'];
  prazo_dias: number;
  automatizavel: boolean;
  tags: string[];
}

const NR_TASK_CATALOG: Record<string, TaskTemplate[]> = {
  'NR-1': [
    { titulo: 'Revisar PGR', descricao: 'Atualizar o Programa de Gerenciamento de Riscos conforme nova redação da NR-1.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['pgr', 'riscos'] },
    { titulo: 'Atualizar treinamentos', descricao: 'Revisar carga horária e conteúdo dos treinamentos obrigatórios.', responsavel_tipo: 'rh', prazo_dias: 45, automatizavel: true, tags: ['treinamento'] },
    { titulo: 'Reavaliar riscos ocupacionais', descricao: 'Conduzir reavaliação dos riscos para todos os cargos afetados.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['riscos', 'avaliacao'] },
    { titulo: 'Comunicar colaboradores', descricao: 'Elaborar comunicado interno sobre as mudanças e seus impactos.', responsavel_tipo: 'rh', prazo_dias: 5, automatizavel: true, tags: ['comunicacao'] },
  ],
  'NR-4': [
    { titulo: 'Revisar dimensionamento SESMT', descricao: 'Verificar se o dimensionamento do SESMT está conforme a nova redação.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['sesmt'] },
    { titulo: 'Atualizar quadro de profissionais', descricao: 'Confirmar adequação do quadro de profissionais do SESMT.', responsavel_tipo: 'rh', prazo_dias: 20, automatizavel: false, tags: ['sesmt', 'quadro'] },
  ],
  'NR-5': [
    { titulo: 'Revisar composição CIPA', descricao: 'Adequar a composição da CIPA às novas exigências.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['cipa'] },
    { titulo: 'Atualizar calendário CIPA', descricao: 'Revisar agenda de reuniões e ações da CIPA.', responsavel_tipo: 'sst', prazo_dias: 15, automatizavel: true, tags: ['cipa'] },
  ],
  'NR-6': [
    { titulo: 'Revisar catálogo de EPIs', descricao: 'Atualizar lista de EPIs obrigatórios por cargo e atividade.', responsavel_tipo: 'sst', prazo_dias: 20, automatizavel: true, tags: ['epi'] },
    { titulo: 'Atualizar fichas de entrega', descricao: 'Revisar fichas e termos de entrega de EPIs.', responsavel_tipo: 'sst', prazo_dias: 15, automatizavel: true, tags: ['epi', 'documentos'] },
    { titulo: 'Verificar CAs vigentes', descricao: 'Confirmar validade dos Certificados de Aprovação dos EPIs em uso.', responsavel_tipo: 'sst', prazo_dias: 10, automatizavel: false, tags: ['epi', 'ca'] },
  ],
  'NR-7': [
    { titulo: 'Atualizar PCMSO', descricao: 'Revisar o Programa de Controle Médico de Saúde Ocupacional.', responsavel_tipo: 'medicina', prazo_dias: 30, automatizavel: false, tags: ['pcmso', 'saude'] },
    { titulo: 'Revisar cronograma de exames', descricao: 'Adequar periodicidade e tipos de exames ocupacionais.', responsavel_tipo: 'medicina', prazo_dias: 20, automatizavel: true, tags: ['pcmso', 'exames'] },
    { titulo: 'Atualizar ASOs', descricao: 'Revisar modelos de Atestados de Saúde Ocupacional.', responsavel_tipo: 'medicina', prazo_dias: 15, automatizavel: true, tags: ['pcmso', 'aso'] },
  ],
  'NR-9': [
    { titulo: 'Revisar PPRA/PGR agentes', descricao: 'Atualizar avaliação de agentes físicos, químicos e biológicos.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['pgr', 'agentes'] },
    { titulo: 'Atualizar medições ambientais', descricao: 'Programar novas medições de agentes ambientais.', responsavel_tipo: 'sst', prazo_dias: 45, automatizavel: false, tags: ['medicao', 'ambiente'] },
  ],
  'NR-10': [
    { titulo: 'Revisar habilitações elétricas', descricao: 'Verificar validade das habilitações dos trabalhadores em instalações elétricas.', responsavel_tipo: 'sst', prazo_dias: 20, automatizavel: true, tags: ['eletrica', 'habilitacao'] },
    { titulo: 'Atualizar prontuário NR-10', descricao: 'Atualizar documentação do prontuário de instalações elétricas.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['eletrica', 'prontuario'] },
  ],
  'NR-12': [
    { titulo: 'Inventariar máquinas', descricao: 'Atualizar inventário de máquinas e equipamentos conforme NR-12.', responsavel_tipo: 'sst', prazo_dias: 45, automatizavel: false, tags: ['maquinas', 'inventario'] },
    { titulo: 'Verificar proteções', descricao: 'Inspecionar dispositivos de segurança e proteções de máquinas.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['maquinas', 'protecao'] },
  ],
  'NR-15': [
    { titulo: 'Reavaliar insalubridade', descricao: 'Recalcular graus de insalubridade com base nos novos limites.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['insalubridade'] },
    { titulo: 'Simular impacto em folha', descricao: 'Recalcular adicionais de insalubridade na folha de pagamento.', responsavel_tipo: 'financeiro', prazo_dias: 15, automatizavel: true, tags: ['insalubridade', 'folha'] },
  ],
  'NR-16': [
    { titulo: 'Reavaliar periculosidade', descricao: 'Verificar enquadramento de cargos em condições de periculosidade.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['periculosidade'] },
    { titulo: 'Simular impacto em folha', descricao: 'Recalcular adicionais de periculosidade na folha.', responsavel_tipo: 'financeiro', prazo_dias: 15, automatizavel: true, tags: ['periculosidade', 'folha'] },
  ],
  'NR-17': [
    { titulo: 'Revisar análise ergonômica', descricao: 'Atualizar Análise Ergonômica do Trabalho (AET).', responsavel_tipo: 'sst', prazo_dias: 45, automatizavel: false, tags: ['ergonomia'] },
  ],
  'NR-18': [
    { titulo: 'Atualizar PCMAT/PGR obra', descricao: 'Revisar o programa de condições de trabalho na construção.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['construcao', 'pcmat'] },
    { titulo: 'Revisar EPIs de obra', descricao: 'Adequar EPIs específicos para atividades de construção.', responsavel_tipo: 'sst', prazo_dias: 20, automatizavel: true, tags: ['construcao', 'epi'] },
  ],
  'NR-33': [
    { titulo: 'Revisar procedimentos espaço confinado', descricao: 'Atualizar procedimentos de entrada e trabalho em espaços confinados.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['espaco_confinado'] },
    { titulo: 'Reciclar treinamento NR-33', descricao: 'Programar reciclagem para trabalhadores autorizados.', responsavel_tipo: 'rh', prazo_dias: 45, automatizavel: true, tags: ['espaco_confinado', 'treinamento'] },
  ],
  'NR-35': [
    { titulo: 'Revisar procedimentos trabalho em altura', descricao: 'Atualizar procedimentos e APR para trabalho em altura.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['altura'] },
    { titulo: 'Reciclar treinamento NR-35', descricao: 'Programar reciclagem de treinamento de trabalho em altura.', responsavel_tipo: 'rh', prazo_dias: 45, automatizavel: true, tags: ['altura', 'treinamento'] },
  ],
};

// ── Area → Fallback Tasks ──

const AREA_FALLBACK_TASKS: Record<string, TaskTemplate[]> = {
  seguranca_trabalho: [
    { titulo: 'Revisar procedimentos de segurança', descricao: 'Adequar procedimentos de SST à nova regulamentação.', responsavel_tipo: 'sst', prazo_dias: 30, automatizavel: false, tags: ['seguranca'] },
  ],
  saude_ocupacional: [
    { titulo: 'Revisar programas de saúde', descricao: 'Atualizar PCMSO e programas de saúde ocupacional.', responsavel_tipo: 'medicina', prazo_dias: 30, automatizavel: false, tags: ['saude'] },
  ],
  treinamentos: [
    { titulo: 'Atualizar matriz de treinamentos', descricao: 'Revisar obrigatoriedade e conteúdo de treinamentos.', responsavel_tipo: 'rh', prazo_dias: 30, automatizavel: true, tags: ['treinamento'] },
  ],
  epi: [
    { titulo: 'Revisar EPIs obrigatórios', descricao: 'Atualizar catálogo de EPIs conforme nova regulamentação.', responsavel_tipo: 'sst', prazo_dias: 20, automatizavel: true, tags: ['epi'] },
  ],
  folha_pagamento: [
    { titulo: 'Simular impacto em folha', descricao: 'Rodar simulação de folha com novos parâmetros legais.', responsavel_tipo: 'financeiro', prazo_dias: 15, automatizavel: true, tags: ['folha'] },
  ],
  esocial: [
    { titulo: 'Adequar eventos eSocial', descricao: 'Ajustar layouts e eventos do eSocial conforme alteração.', responsavel_tipo: 'ti', prazo_dias: 20, automatizavel: false, tags: ['esocial'] },
  ],
  jornada: [
    { titulo: 'Revisar controle de jornada', descricao: 'Adequar regras de jornada às novas exigências legais.', responsavel_tipo: 'rh', prazo_dias: 15, automatizavel: true, tags: ['jornada'] },
  ],
  sindical: [
    { titulo: 'Analisar impacto em CCT', descricao: 'Verificar se mudança afeta cláusulas de convenções coletivas vigentes.', responsavel_tipo: 'juridico', prazo_dias: 20, automatizavel: false, tags: ['cct', 'sindical'] },
  ],
};

// ── Main Engine ──

export function generateLegalActionPlans(input: ActionPlanGeneratorInput): ActionPlanGeneratorResult {
  const plans: LegalActionPlan[] = [];

  for (const impact of input.company_impacts) {
    const plan = buildPlanForCompany(input, impact);
    plans.push(plan);
  }

  const totalTasks = plans.reduce((s, p) => s + p.total_tarefas, 0);

  return {
    plans,
    total_plans: plans.length,
    total_tasks: totalTasks,
    generated_at: new Date().toISOString(),
  };
}

// ── Plan Builder ──

function buildPlanForCompany(input: ActionPlanGeneratorInput, impact: CompanyLegalImpact): LegalActionPlan {
  const tasks: TarefaRecomendada[] = [];
  const usedTitles = new Set<string>();
  let taskOrder = 0;

  // 1. Communication task (always first)
  tasks.push(makeTask(taskOrder++, {
    titulo: 'Comunicar equipe sobre alteração',
    descricao: `Informar gestores e colaboradores sobre mudanças na ${input.norm_codigo}.`,
    responsavel_tipo: 'rh',
    prazo_dias: 3,
    automatizavel: true,
    tags: ['comunicacao'],
  }, []));
  usedTitles.add('Comunicar equipe sobre alteração');

  // 2. NR-specific tasks
  for (const nr of input.nrs_afetadas) {
    const templates = NR_TASK_CATALOG[nr] || [];
    for (const tpl of templates) {
      if (usedTitles.has(tpl.titulo)) continue;
      usedTitles.add(tpl.titulo);
      const deps = tasks.length > 0 ? [tasks[0].id] : [];
      tasks.push(makeTask(taskOrder++, tpl, deps));
    }
  }

  // 3. Area fallback tasks (for areas not yet covered by NR tasks)
  for (const area of input.areas_impactadas) {
    const fallbacks = AREA_FALLBACK_TASKS[area] || [];
    for (const tpl of fallbacks) {
      if (usedTitles.has(tpl.titulo)) continue;
      usedTitles.add(tpl.titulo);
      const deps = tasks.length > 0 ? [tasks[0].id] : [];
      tasks.push(makeTask(taskOrder++, tpl, deps));
    }
  }

  // 4. Audit task (always last)
  tasks.push(makeTask(taskOrder++, {
    titulo: 'Auditoria de conformidade',
    descricao: `Verificar implementação de todas as adequações à ${input.norm_codigo}.`,
    responsavel_tipo: 'juridico',
    prazo_dias: 10,
    automatizavel: false,
    tags: ['auditoria', 'conformidade'],
  }, tasks.filter(t => !t.automatizavel).map(t => t.id)));

  const prioridade = mapRiskToPriority(impact.risco_juridico_estimado);

  return {
    id: crypto.randomUUID(),
    empresa: { id: impact.company_id, name: impact.company_name },
    mudanca_referencia: input.norm_codigo,
    tarefas_recomendadas: tasks,
    prioridade,
    prazo_sugerido: impact.prazo_adequacao,
    risco_base: impact.risco_juridico_estimado,
    total_tarefas: tasks.length,
    tarefas_automatizaveis: tasks.filter(t => t.automatizavel).length,
    generated_at: new Date().toISOString(),
  };
}

// ── Helpers ──

function makeTask(order: number, tpl: TaskTemplate, deps: string[]): TarefaRecomendada {
  const id = `task-${order}-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    titulo: tpl.titulo,
    descricao: tpl.descricao,
    responsavel_tipo: tpl.responsavel_tipo,
    prazo_dias: tpl.prazo_dias,
    automatizavel: tpl.automatizavel,
    status: 'pendente',
    dependencia_ids: deps,
    tags: tpl.tags,
  };
}

function mapRiskToPriority(risco: RiscoJuridico): PrioridadePlano {
  const map: Record<RiscoJuridico, PrioridadePlano> = {
    critico: 'urgente',
    alto: 'alta',
    medio: 'media',
    baixo: 'baixa',
  };
  return map[risco];
}
