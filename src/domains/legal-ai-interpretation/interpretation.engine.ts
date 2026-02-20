/**
 * Interpretation Engine — Executive Summary + Practical Interpretation
 *
 * Pure domain logic. Produces structured summaries and practical
 * interpretations from legislative change inputs.
 *
 * In production, the AI-powered version will call Lovable AI Gateway
 * via edge function. This engine provides the deterministic fallback
 * and prompt construction logic.
 */

import type {
  InterpretationInput,
  InterpretationResult,
  ExecutiveSummary,
  PracticalInterpretation,
  PracticalImplication,
  NonComplianceRisk,
  ImpactLevel,
  InterpretationConfidence,
} from './types';

// ── Area Mapping ──

const AREA_LABELS: Record<string, string> = {
  saude_ocupacional: 'Saúde Ocupacional',
  seguranca_trabalho: 'Segurança do Trabalho',
  treinamentos: 'Treinamentos',
  epi: 'Equipamentos de Proteção',
  folha_pagamento: 'Folha de Pagamento',
  jornada: 'Jornada de Trabalho',
  admissao: 'Admissão',
  demissao: 'Demissão / Rescisão',
  beneficios: 'Benefícios',
  esocial: 'eSocial',
  sindical: 'Relações Sindicais',
  ferias: 'Férias',
};

const AREA_DEPARTMENTS: Record<string, string[]> = {
  saude_ocupacional: ['SST', 'RH', 'Medicina do Trabalho'],
  seguranca_trabalho: ['SST', 'Engenharia de Segurança'],
  treinamentos: ['RH', 'SST', 'Gestão'],
  epi: ['SST', 'Compras', 'Almoxarifado'],
  folha_pagamento: ['DP', 'Financeiro', 'Contabilidade'],
  jornada: ['DP', 'RH', 'Gestão'],
  esocial: ['DP', 'TI', 'Contabilidade'],
  sindical: ['RH', 'Jurídico'],
};

// ── Main Engine ──

export function generateInterpretation(input: InterpretationInput): InterpretationResult {
  try {
    const summary = buildExecutiveSummary(input);
    const interpretation = buildPracticalInterpretation(input, summary);

    return {
      summary,
      interpretation,
      success: true,
      errors: [],
    };
  } catch (err) {
    return {
      summary: createEmptySummary(input),
      interpretation: createEmptyInterpretation(input),
      success: false,
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    };
  }
}

// ── Summary Builder ──

function buildExecutiveSummary(input: InterpretationInput): ExecutiveSummary {
  const impacto = inferImpactLevel(input);
  const prazo = inferPrazoAdequacao(input);
  const setores = input.areas_impactadas
    .map(a => AREA_LABELS[a] || a)
    .filter(Boolean);

  const pontosChave = buildKeyPoints(input);

  return {
    norm_codigo: input.norm_codigo,
    norm_titulo: input.norm_titulo,
    resumo: buildResumoText(input, impacto),
    pontos_chave: pontosChave,
    data_vigencia: input.data_vigencia,
    orgao_emissor: input.orgao_emissor,
    impacto_geral: impacto,
    setores_afetados: setores,
    prazo_adequacao_dias: prazo,
    confianca: inferConfidence(input),
    generated_at: new Date().toISOString(),
  };
}

function buildResumoText(input: InterpretationInput, impacto: ImpactLevel): string {
  const severity = impacto === 'critico' ? 'com impacto CRÍTICO' :
    impacto === 'alto' ? 'com impacto significativo' :
    impacto === 'moderado' ? 'com impacto moderado' : 'com impacto reduzido';

  return `A ${input.norm_codigo} (${input.norm_titulo}) publicada por ${input.orgao_emissor} ` +
    `introduz alterações ${severity} que afetam ${input.areas_impactadas.length} área(s) operacional(is). ` +
    `Vigência a partir de ${formatDate(input.data_vigencia)}.` +
    (input.diff_summary
      ? ` Foram identificadas ${input.diff_summary.artigos_alterados} alteração(ões), ` +
        `${input.diff_summary.artigos_adicionados} adição(ões) e ` +
        `${input.diff_summary.artigos_revogados} revogação(ões).`
      : '');
}

function buildKeyPoints(input: InterpretationInput): string[] {
  const points: string[] = [];

  if (input.diff_summary) {
    const d = input.diff_summary;
    if (d.artigos_revogados > 0) points.push(`${d.artigos_revogados} artigo(s) revogado(s) — verificar obrigações cessantes`);
    if (d.artigos_adicionados > 0) points.push(`${d.artigos_adicionados} novo(s) requisito(s) adicionado(s)`);
    if (d.artigos_alterados > 0) points.push(`${d.artigos_alterados} artigo(s) com redação alterada`);
    d.mudancas_chave.forEach(m => points.push(m));
  }

  input.areas_impactadas.forEach(area => {
    const label = AREA_LABELS[area] || area;
    points.push(`Área de ${label} requer revisão de procedimentos`);
  });

  return points.slice(0, 8);
}

// ── Practical Interpretation Builder ──

function buildPracticalInterpretation(
  input: InterpretationInput,
  summary: ExecutiveSummary,
): PracticalInterpretation {
  const implications = buildImplications(input);
  const risks = buildNonComplianceRisks(input, summary);

  return {
    id: crypto.randomUUID(),
    norm_codigo: input.norm_codigo,
    contexto_legal: `Alteração na ${input.norm_codigo} publicada em ${formatDate(input.data_publicacao)} por ${input.orgao_emissor}, com vigência a partir de ${formatDate(input.data_vigencia)}.`,
    interpretacao: buildInterpretationText(input, summary),
    implicacoes_praticas: implications,
    riscos_nao_conformidade: risks,
    referencias_legais: [
      { codigo: input.norm_codigo, artigo: null, descricao: input.norm_titulo, url: null },
    ],
    status: 'draft',
    revisado_por: null,
    confianca: summary.confianca,
    generated_at: new Date().toISOString(),
  };
}

function buildInterpretationText(input: InterpretationInput, summary: ExecutiveSummary): string {
  const parts: string[] = [
    `A alteração na ${input.norm_codigo} introduz mudanças que impactam diretamente as operações de ${summary.setores_afetados.join(', ')}.`,
  ];

  if (summary.prazo_adequacao_dias) {
    parts.push(`O prazo estimado para adequação é de ${summary.prazo_adequacao_dias} dias.`);
  }

  if (summary.impacto_geral === 'critico' || summary.impacto_geral === 'alto') {
    parts.push('Recomenda-se ação imediata para garantir conformidade e evitar sanções.');
  }

  return parts.join(' ');
}

function buildImplications(input: InterpretationInput): PracticalImplication[] {
  return input.areas_impactadas.map(area => ({
    area: AREA_LABELS[area] || area,
    descricao: `Revisão necessária nos processos de ${(AREA_LABELS[area] || area).toLowerCase()} conforme ${input.norm_codigo}.`,
    acao_necessaria: true,
    prazo_dias: inferAreaPrazo(area),
    departamentos_envolvidos: AREA_DEPARTMENTS[area] || ['RH'],
  }));
}

function buildNonComplianceRisks(input: InterpretationInput, summary: ExecutiveSummary): NonComplianceRisk[] {
  if (summary.impacto_geral === 'nenhum' || summary.impacto_geral === 'baixo') return [];

  const risks: NonComplianceRisk[] = [{
    descricao: `Não adequação à ${input.norm_codigo} dentro do prazo pode resultar em autuação.`,
    severidade: summary.impacto_geral,
    multa_estimada: inferMultaEstimada(summary.impacto_geral),
    base_legal: input.norm_codigo,
    probabilidade: summary.impacto_geral === 'critico' ? 'alta' : 'media',
  }];

  if (input.areas_impactadas.includes('esocial')) {
    risks.push({
      descricao: 'Divergência nos eventos do eSocial pode gerar pendências junto à Receita Federal.',
      severidade: 'alto',
      multa_estimada: 'R$ 402,53 a R$ 181.284,63 por evento',
      base_legal: 'Decreto 8.373/2014',
      probabilidade: 'alta',
    });
  }

  return risks;
}

// ── Inference Helpers ──

function inferImpactLevel(input: InterpretationInput): ImpactLevel {
  if (!input.diff_summary) {
    return input.areas_impactadas.length >= 3 ? 'alto' : 'moderado';
  }
  const d = input.diff_summary;
  const score = d.artigos_revogados * 3 + d.artigos_alterados * 2 + d.artigos_adicionados;
  if (score >= 10 || d.gravidade === 'critica') return 'critico';
  if (score >= 6 || d.gravidade === 'alta') return 'alto';
  if (score >= 3) return 'moderado';
  return 'baixo';
}

function inferConfidence(input: InterpretationInput): InterpretationConfidence {
  if (!input.diff_summary) return 'requer_validacao_humana';
  if (input.texto_alteracao.length < 100) return 'baixa';
  if (input.diff_summary.gravidade === 'critica') return 'media';
  return 'alta';
}

function inferPrazoAdequacao(input: InterpretationInput): number | null {
  const areas = input.areas_impactadas;
  if (areas.includes('esocial')) return 30;
  if (areas.includes('saude_ocupacional') || areas.includes('seguranca_trabalho')) return 60;
  if (areas.includes('folha_pagamento')) return 30;
  if (areas.includes('treinamentos')) return 90;
  return 60;
}

function inferAreaPrazo(area: string): number {
  const prazos: Record<string, number> = {
    esocial: 30, folha_pagamento: 30, saude_ocupacional: 60,
    seguranca_trabalho: 60, treinamentos: 90, epi: 45,
    jornada: 30, admissao: 30, demissao: 30,
  };
  return prazos[area] || 60;
}

function inferMultaEstimada(impacto: ImpactLevel): string | null {
  const multas: Record<string, string> = {
    critico: 'R$ 6.708,09 a R$ 67.080,90 por infração',
    alto: 'R$ 2.396,35 a R$ 6.708,09 por infração',
    moderado: 'R$ 1.131,00 a R$ 2.396,35 por infração',
  };
  return multas[impacto] || null;
}

// ── Fallback Builders ──

function createEmptySummary(input: InterpretationInput): ExecutiveSummary {
  return {
    norm_codigo: input.norm_codigo, norm_titulo: input.norm_titulo,
    resumo: '', pontos_chave: [], data_vigencia: input.data_vigencia,
    orgao_emissor: input.orgao_emissor, impacto_geral: 'nenhum',
    setores_afetados: [], prazo_adequacao_dias: null,
    confianca: 'requer_validacao_humana', generated_at: new Date().toISOString(),
  };
}

function createEmptyInterpretation(input: InterpretationInput): PracticalInterpretation {
  return {
    id: crypto.randomUUID(), norm_codigo: input.norm_codigo,
    contexto_legal: '', interpretacao: '', implicacoes_praticas: [],
    riscos_nao_conformidade: [], referencias_legais: [], status: 'draft',
    revisado_por: null, confianca: 'requer_validacao_humana',
    generated_at: new Date().toISOString(),
  };
}

// ── Util ──

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return iso; }
}
