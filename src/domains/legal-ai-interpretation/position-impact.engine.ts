/**
 * Position Impact Engine — Impact analysis per cargo/position
 *
 * Identifies which positions are affected by a legislative change
 * based on NR codes, CBO, risk level, and area overlap.
 *
 * Pure domain logic — no I/O.
 */

import type {
  PositionImpactInput,
  PositionImpactResult,
  PositionImpactAnalysis,
  PositionImpactArea,
  CostEstimate,
  ImpactLevel,
  PositionSnapshot,
} from './types';

// ── NR ↔ Area Mapping ──

const NR_AREA_MAP: Record<string, string[]> = {
  'NR-1': ['seguranca_trabalho', 'treinamentos'],
  'NR-4': ['saude_ocupacional', 'seguranca_trabalho'],
  'NR-5': ['seguranca_trabalho'],
  'NR-6': ['epi'],
  'NR-7': ['saude_ocupacional'],
  'NR-9': ['saude_ocupacional', 'seguranca_trabalho'],
  'NR-10': ['seguranca_trabalho', 'treinamentos'],
  'NR-12': ['seguranca_trabalho', 'treinamentos'],
  'NR-15': ['saude_ocupacional', 'folha_pagamento'],
  'NR-16': ['saude_ocupacional', 'folha_pagamento'],
  'NR-17': ['seguranca_trabalho'],
  'NR-18': ['seguranca_trabalho', 'treinamentos', 'epi'],
  'NR-20': ['seguranca_trabalho', 'treinamentos'],
  'NR-23': ['seguranca_trabalho', 'treinamentos'],
  'NR-33': ['seguranca_trabalho', 'treinamentos', 'epi'],
  'NR-35': ['seguranca_trabalho', 'treinamentos', 'epi'],
};

// ── Main Engine ──

export function analyzePositionImpacts(input: PositionImpactInput): PositionImpactResult {
  const companyMap = new Map(input.companies.map(c => [c.id, c]));
  const impacts: PositionImpactAnalysis[] = [];

  for (const pos of input.positions) {
    const overlap = computeAreaOverlap(pos, input.areas_impactadas);
    if (overlap.length === 0) continue;

    const company = companyMap.get(pos.company_id);
    const nivel = inferPositionImpactLevel(pos, overlap, input.areas_impactadas);
    const areas = buildPositionImpactAreas(overlap, input.norm_codigo);
    const acoes = buildPositionActions(pos, overlap);
    const custo = estimatePositionCost(pos, overlap);

    impacts.push({
      cargo_id: pos.id,
      cargo_nome: pos.nome,
      cbo_codigo: pos.cbo_codigo,
      company_id: pos.company_id,
      company_name: company?.name || 'N/A',
      nivel_impacto: nivel,
      areas_afetadas: areas,
      funcionarios_afetados: pos.funcionarios_count,
      acoes_necessarias: acoes,
      prazo_adequacao_dias: inferPrazoPorImpacto(nivel),
      custo_estimado: custo,
    });
  }

  // Sort by impact level (critical first)
  const order: Record<string, number> = { critico: 0, alto: 1, moderado: 2, baixo: 3, nenhum: 4 };
  impacts.sort((a, b) => (order[a.nivel_impacto] ?? 4) - (order[b.nivel_impacto] ?? 4));

  const totalEmployees = impacts.reduce((s, i) => s + i.funcionarios_afetados, 0);
  const highest = impacts[0]?.nivel_impacto || 'nenhum';

  return {
    impacts,
    total_positions_affected: impacts.length,
    total_employees_affected: totalEmployees,
    highest_impact: highest as ImpactLevel,
    cost_estimate_total: aggregateCosts(impacts),
  };
}

// ── Helpers ──

function computeAreaOverlap(pos: PositionSnapshot, areasImpactadas: string[]): string[] {
  const posAreas = new Set<string>();

  for (const nr of pos.nr_codigos) {
    const mapped = NR_AREA_MAP[nr];
    if (mapped) mapped.forEach(a => posAreas.add(a));
  }

  if (pos.exige_epi) posAreas.add('epi');
  if (pos.exige_exame_medico) posAreas.add('saude_ocupacional');

  return areasImpactadas.filter(a => posAreas.has(a));
}

function inferPositionImpactLevel(
  pos: PositionSnapshot,
  overlap: string[],
  _allAreas: string[],
): ImpactLevel {
  const score = overlap.length * 2 + pos.nr_codigos.length;
  if (score >= 8) return 'critico';
  if (score >= 5) return 'alto';
  if (score >= 3) return 'moderado';
  return 'baixo';
}

function buildPositionImpactAreas(overlap: string[], normCodigo: string): PositionImpactArea[] {
  return overlap.map(area => ({
    area,
    descricao: `Requisitos de ${area} alterados pela ${normCodigo}`,
    requisito_anterior: null,
    requisito_novo: `Conforme nova redação da ${normCodigo}`,
    gap_identificado: true,
  }));
}

function buildPositionActions(pos: PositionSnapshot, overlap: string[]): string[] {
  const acoes: string[] = [];
  if (overlap.includes('treinamentos')) acoes.push('Agendar reciclagem de treinamento');
  if (overlap.includes('epi')) acoes.push('Revisar catálogo de EPIs');
  if (overlap.includes('saude_ocupacional')) acoes.push('Atualizar PCMSO / exames periódicos');
  if (overlap.includes('seguranca_trabalho')) acoes.push('Revisar PGR / mapeamento de riscos');
  if (overlap.includes('folha_pagamento')) acoes.push('Recalcular adicionais / piso salarial');
  if (acoes.length === 0) acoes.push('Verificar impacto operacional');
  return acoes;
}

function estimatePositionCost(pos: PositionSnapshot, overlap: string[]): CostEstimate | null {
  if (overlap.length === 0) return null;
  const components: { item: string; valor: number }[] = [];

  if (overlap.includes('treinamentos')) {
    components.push({ item: 'Reciclagem treinamento', valor: pos.funcionarios_count * 150 });
  }
  if (overlap.includes('epi')) {
    components.push({ item: 'Atualização EPIs', valor: pos.funcionarios_count * 80 });
  }
  if (overlap.includes('saude_ocupacional')) {
    components.push({ item: 'Exames complementares', valor: pos.funcionarios_count * 120 });
  }

  if (components.length === 0) return null;
  const total = components.reduce((s, c) => s + c.valor, 0);
  return { valor_minimo: Math.round(total * 0.8), valor_maximo: Math.round(total * 1.3), moeda: 'BRL', componentes: components };
}

function inferPrazoPorImpacto(nivel: ImpactLevel): number | null {
  const prazos: Record<string, number> = { critico: 15, alto: 30, moderado: 60, baixo: 90 };
  return prazos[nivel] || null;
}

function aggregateCosts(impacts: PositionImpactAnalysis[]): CostEstimate | null {
  const allComponents: { item: string; valor: number }[] = [];
  let minTotal = 0, maxTotal = 0;

  for (const imp of impacts) {
    if (imp.custo_estimado) {
      minTotal += imp.custo_estimado.valor_minimo;
      maxTotal += imp.custo_estimado.valor_maximo;
      allComponents.push(...imp.custo_estimado.componentes);
    }
  }

  if (allComponents.length === 0) return null;
  return { valor_minimo: minTotal, valor_maximo: maxTotal, moeda: 'BRL', componentes: allComponents };
}
