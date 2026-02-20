/**
 * Legal Diff Engine — Deep structural comparison of legal documents
 *
 * Goes beyond hash comparison to produce rich, actionable diffs:
 *  - Detects altered articles, new paragraphs, revocations
 *  - Classifies change type and severity
 *  - Estimates operational impact on HR/compliance processes
 *
 * Pure domain logic — no I/O.
 */

import { normalizeText, generateContentHash } from './legal-crawler.service';
import type { LegalSourceId } from './adapters/types';

// ── Types ──

export type TipoMudanca =
  | 'artigo_alterado'
  | 'paragrafo_adicionado'
  | 'paragrafo_removido'
  | 'artigo_adicionado'
  | 'artigo_revogado'
  | 'inciso_alterado'
  | 'inciso_adicionado'
  | 'inciso_revogado'
  | 'alinea_alterada'
  | 'prazo_alterado'
  | 'valor_alterado'
  | 'percentual_alterado'
  | 'texto_republicado'
  | 'caput_alterado'
  | 'ementa_alterada'
  | 'anexo_alterado'
  | 'revogacao_total'
  | 'revogacao_parcial';

export type GravidadeMudanca = 'informativa' | 'baixa' | 'media' | 'alta' | 'critica';

export type AreaImpacto =
  | 'folha_pagamento'
  | 'admissao'
  | 'demissao'
  | 'jornada'
  | 'ferias'
  | 'beneficios'
  | 'saude_ocupacional'
  | 'seguranca_trabalho'
  | 'treinamentos'
  | 'epi'
  | 'esocial'
  | 'adicional_insalubridade'
  | 'adicional_periculosidade'
  | 'adicional_noturno'
  | 'fgts'
  | 'inss'
  | 'irrf'
  | 'rescisao'
  | 'contrato'
  | 'sindical'
  | 'compliance'
  | 'ergonomia'
  | 'pcmso'
  | 'pgr';

export interface LegalArticleDiff {
  /** Identifier: "Art. 59", "NR-7 Item 7.4.1", "Cláusula 5ª" */
  artigo: string;
  tipo_mudanca: TipoMudanca;
  texto_anterior: string | null;
  texto_atual: string | null;
  palavras_adicionadas: string[];
  palavras_removidas: string[];
  delta_percentual: number;
}

export interface LegalChangeSummary {
  /** Unique identifier for this change set */
  change_id: string;
  /** Source document */
  source_id: LegalSourceId;
  document_code: string;
  document_title: string;
  /** When the diff was computed */
  analyzed_at: string;

  /** Change classification */
  tipo_mudanca: TipoMudanca;
  gravidade: GravidadeMudanca;
  impacto_estimado: ImpactoEstimado;

  /** Human-readable summary */
  resumo: string;
  /** Detailed explanation */
  detalhamento: string;

  /** Individual article-level diffs */
  artigos_alterados: LegalArticleDiff[];
  total_artigos_alterados: number;
  total_paragrafos_novos: number;
  total_revogacoes: number;

  /** Affected operational areas */
  areas_impactadas: AreaImpacto[];
  /** Recommended actions */
  acoes_recomendadas: AcaoRecomendada[];
  /** Deadline for compliance (if applicable) */
  prazo_adequacao: string | null;
}

export interface ImpactoEstimado {
  /** Overall severity score (0-100) */
  score: number;
  /** Estimated affected employee count hint */
  funcionarios_potencialmente_afetados: 'nenhum' | 'poucos' | 'muitos' | 'todos';
  /** Financial impact hint */
  impacto_financeiro: 'nenhum' | 'baixo' | 'moderado' | 'alto' | 'critico';
  /** Urgency of action */
  urgencia: 'informativa' | 'planejada' | 'prioritaria' | 'imediata';
  /** Whether this requires payroll recalculation */
  requer_recalculo_folha: boolean;
  /** Whether this requires eSocial event update */
  requer_atualizacao_esocial: boolean;
  /** Whether employee communications are needed */
  requer_comunicacao_funcionarios: boolean;
}

export interface AcaoRecomendada {
  prioridade: number;
  titulo: string;
  descricao: string;
  area: AreaImpacto;
  prazo_sugerido_dias: number;
  automatizavel: boolean;
}

// ── Token-Level Diff ──

interface Token {
  value: string;
  normalized: string;
}

function tokenize(text: string): Token[] {
  return text.split(/\s+/).filter(Boolean).map(w => ({
    value: w,
    normalized: normalizeText(w),
  }));
}

function computeWordDiff(
  oldText: string,
  newText: string
): { added: string[]; removed: string[] } {
  const oldTokens = new Set(tokenize(oldText).map(t => t.normalized));
  const newTokens = new Set(tokenize(newText).map(t => t.normalized));

  const added: string[] = [];
  const removed: string[] = [];

  for (const t of newTokens) {
    if (!oldTokens.has(t)) added.push(t);
  }
  for (const t of oldTokens) {
    if (!newTokens.has(t)) removed.push(t);
  }

  return { added, removed };
}

// ── Article Parser ──

interface ParsedArticle {
  key: string;
  label: string;
  content: string;
  hash: string;
}

const ARTICLE_PATTERNS = [
  /^(art\.?\s*\d+[\w.-]*)/i,
  /^(nr-?\d+[\w.]*\s*(?:item|subitem)?\s*[\d.]*)/i,
  /^(clausula\s+\d+[ªº]?)/i,
  /^(§\s*\d+[ºª]?)/i,
  /^(paragrafo\s+(?:unico|\d+[ºª]?))/i,
  /^(inciso\s+[IVXLCDM]+)/i,
  /^(alinea\s+[a-z])/i,
  /^(anexo\s+[IVXLCDM\d]+)/i,
  /^(capitulo\s+[IVXLCDM\d]+)/i,
  /^(secao\s+[IVXLCDM\d]+)/i,
];

function parseArticles(content: string): ParsedArticle[] {
  const lines = content.split('\n');
  const articles: ParsedArticle[] = [];
  let currentKey = '__preamble__';
  let currentLabel = 'Preâmbulo';
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length > 0) {
      const text = buffer.join('\n').trim();
      if (text) {
        articles.push({
          key: currentKey,
          label: currentLabel,
          content: text,
          hash: generateContentHash(text),
        });
      }
    }
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    let matched = false;

    for (const pattern of ARTICLE_PATTERNS) {
      const m = trimmed.match(pattern);
      if (m) {
        flush();
        currentKey = normalizeText(m[1]).replace(/\s+/g, '_');
        currentLabel = m[1];
        buffer.push(trimmed);
        matched = true;
        break;
      }
    }

    if (!matched) {
      buffer.push(trimmed);
    }
  }

  flush();
  return articles;
}

// ── Severity Detection ──

const CRITICAL_KEYWORDS = [
  'revogad', 'extint', 'proibid', 'vedado', 'obrigatori',
  'multa', 'penalidade', 'infracao', 'embargo', 'interdicao',
  'salario minimo', 'piso salarial', 'reajuste',
];

const HIGH_KEYWORDS = [
  'adicional', 'insalubr', 'periculosidade', 'jornada',
  'hora extra', 'ferias', 'rescis', 'aviso previo', 'fgts',
  'esocial', 'prazo', 'exame', 'aso', 'pcmso', 'pgr',
];

const MEDIUM_KEYWORDS = [
  'treinamento', 'capacitacao', 'epi', 'cipa', 'sesmt',
  'ergonomia', 'intervalo', 'descanso', 'beneficio',
];

function detectGravidade(diffs: LegalArticleDiff[]): GravidadeMudanca {
  const allText = diffs.map(d => `${d.texto_atual ?? ''} ${d.texto_anterior ?? ''}`).join(' ').toLowerCase();

  const hasRevogacao = diffs.some(d =>
    d.tipo_mudanca === 'artigo_revogado' ||
    d.tipo_mudanca === 'revogacao_total' ||
    d.tipo_mudanca === 'revogacao_parcial'
  );

  if (hasRevogacao) return 'critica';
  if (CRITICAL_KEYWORDS.some(k => allText.includes(k))) return 'critica';
  if (HIGH_KEYWORDS.some(k => allText.includes(k))) return 'alta';
  if (MEDIUM_KEYWORDS.some(k => allText.includes(k))) return 'media';
  if (diffs.length > 5) return 'media';
  if (diffs.length > 0) return 'baixa';
  return 'informativa';
}

// ── Impact Area Detection ──

const AREA_KEYWORD_MAP: Record<AreaImpacto, string[]> = {
  folha_pagamento: ['salario', 'remuneracao', 'folha', 'rubrica', 'proventos', 'descontos'],
  admissao: ['admissao', 'contratacao', 'registro', 'ctps'],
  demissao: ['demissao', 'rescisao', 'desligamento', 'aviso previo', 'homologacao'],
  jornada: ['jornada', 'hora extra', 'banco de horas', 'compensacao', 'escala'],
  ferias: ['ferias', 'abono pecuniario', 'fracionamento'],
  beneficios: ['beneficio', 'vale', 'cesta basica', 'auxilio'],
  saude_ocupacional: ['pcmso', 'aso', 'exame', 'saude ocupacional', 'atestado'],
  seguranca_trabalho: ['seguranca', 'acidente', 'cat', 'risco', 'pgr'],
  treinamentos: ['treinamento', 'capacitacao', 'reciclagem', 'nr-'],
  epi: ['epi', 'equipamento de protecao', 'ca ', 'certificado aprovacao'],
  esocial: ['esocial', 's-1', 's-2', 'evento', 'layout'],
  adicional_insalubridade: ['insalubridade', 'insalubre', 'agente nocivo'],
  adicional_periculosidade: ['periculosidade', 'perigosa', 'inflamavel', 'explosivo'],
  adicional_noturno: ['noturno', 'adicional noturno', '22h'],
  fgts: ['fgts', 'fundo de garantia'],
  inss: ['inss', 'previdencia', 'contribuicao social'],
  irrf: ['irrf', 'imposto de renda', 'retencao'],
  rescisao: ['rescisao', 'verbas rescisoria', 'multa 40%'],
  contrato: ['contrato', 'clausula', 'aditivo'],
  sindical: ['sindicato', 'convencao', 'acordo coletivo', 'cct', 'act'],
  compliance: ['compliance', 'conformidade', 'fiscalizacao', 'auditoria'],
  ergonomia: ['ergonomia', 'ergonomic', 'postura', 'aet', 'nr-17'],
  pcmso: ['pcmso', 'programa de controle medico'],
  pgr: ['pgr', 'programa de gerenciamento de riscos', 'gro'],
};

function detectAreasImpactadas(diffs: LegalArticleDiff[]): AreaImpacto[] {
  const allText = normalizeText(
    diffs.map(d => `${d.texto_atual ?? ''} ${d.texto_anterior ?? ''}`).join(' ')
  );

  const areas: AreaImpacto[] = [];
  for (const [area, keywords] of Object.entries(AREA_KEYWORD_MAP) as [AreaImpacto, string[]][]) {
    if (keywords.some(k => allText.includes(k))) {
      areas.push(area);
    }
  }
  return areas;
}

// ── Impact Estimation ──

function estimateImpact(
  gravidade: GravidadeMudanca,
  areas: AreaImpacto[],
  diffs: LegalArticleDiff[]
): ImpactoEstimado {
  const revogacoes = diffs.filter(d =>
    d.tipo_mudanca.includes('revogac') || d.tipo_mudanca.includes('revogad')
  ).length;

  const score = Math.min(100, (() => {
    let s = 0;
    switch (gravidade) {
      case 'critica': s += 60; break;
      case 'alta': s += 40; break;
      case 'media': s += 25; break;
      case 'baixa': s += 10; break;
      default: s += 0;
    }
    s += Math.min(areas.length * 5, 20);
    s += Math.min(diffs.length * 3, 15);
    s += Math.min(revogacoes * 10, 20);
    return s;
  })());

  const financialAreas: AreaImpacto[] = [
    'folha_pagamento', 'adicional_insalubridade', 'adicional_periculosidade',
    'adicional_noturno', 'fgts', 'inss', 'irrf', 'rescisao', 'beneficios',
  ];
  const hasFinancial = areas.some(a => financialAreas.includes(a));
  const hasEsocial = areas.includes('esocial');
  const hasPayroll = areas.includes('folha_pagamento') || hasFinancial;

  return {
    score,
    funcionarios_potencialmente_afetados:
      score >= 70 ? 'todos' : score >= 40 ? 'muitos' : score >= 20 ? 'poucos' : 'nenhum',
    impacto_financeiro:
      !hasFinancial ? 'nenhum' :
      score >= 70 ? 'critico' :
      score >= 50 ? 'alto' :
      score >= 30 ? 'moderado' : 'baixo',
    urgencia:
      gravidade === 'critica' ? 'imediata' :
      gravidade === 'alta' ? 'prioritaria' :
      gravidade === 'media' ? 'planejada' : 'informativa',
    requer_recalculo_folha: hasPayroll && score >= 30,
    requer_atualizacao_esocial: hasEsocial || (hasPayroll && score >= 40),
    requer_comunicacao_funcionarios: score >= 40,
  };
}

// ── Recommended Actions Generator ──

function generateAcoes(
  areas: AreaImpacto[],
  gravidade: GravidadeMudanca,
  impacto: ImpactoEstimado
): AcaoRecomendada[] {
  const acoes: AcaoRecomendada[] = [];
  let priority = 1;

  if (impacto.requer_recalculo_folha) {
    acoes.push({
      prioridade: priority++,
      titulo: 'Recalcular folha de pagamento',
      descricao: 'Atualizar rubricas e recalcular valores conforme nova legislação.',
      area: 'folha_pagamento',
      prazo_sugerido_dias: gravidade === 'critica' ? 5 : 15,
      automatizavel: true,
    });
  }

  if (impacto.requer_atualizacao_esocial) {
    acoes.push({
      prioridade: priority++,
      titulo: 'Atualizar eventos eSocial',
      descricao: 'Revisar e reenviar eventos impactados pela mudança legislativa.',
      area: 'esocial',
      prazo_sugerido_dias: gravidade === 'critica' ? 3 : 10,
      automatizavel: true,
    });
  }

  if (areas.includes('saude_ocupacional') || areas.includes('pcmso')) {
    acoes.push({
      prioridade: priority++,
      titulo: 'Revisar PCMSO',
      descricao: 'Verificar se o programa de saúde ocupacional atende às novas exigências.',
      area: 'saude_ocupacional',
      prazo_sugerido_dias: 30,
      automatizavel: false,
    });
  }

  if (areas.includes('treinamentos') || areas.includes('epi')) {
    acoes.push({
      prioridade: priority++,
      titulo: 'Atualizar programa de treinamentos',
      descricao: 'Verificar se treinamentos existentes atendem aos novos requisitos normativos.',
      area: 'treinamentos',
      prazo_sugerido_dias: 30,
      automatizavel: false,
    });
  }

  if (areas.includes('sindical')) {
    acoes.push({
      prioridade: priority++,
      titulo: 'Revisar convenção coletiva',
      descricao: 'Verificar impacto da mudança em cláusulas vigentes da CCT/ACT.',
      area: 'sindical',
      prazo_sugerido_dias: 15,
      automatizavel: false,
    });
  }

  if (impacto.requer_comunicacao_funcionarios) {
    acoes.push({
      prioridade: priority++,
      titulo: 'Comunicar colaboradores',
      descricao: 'Elaborar e enviar comunicado sobre mudanças que afetam direitos ou obrigações.',
      area: 'compliance',
      prazo_sugerido_dias: gravidade === 'critica' ? 3 : 10,
      automatizavel: true,
    });
  }

  if (areas.includes('compliance')) {
    acoes.push({
      prioridade: priority++,
      titulo: 'Atualizar base jurídica interna',
      descricao: 'Registrar a nova versão legislativa no sistema e atualizar referências cruzadas.',
      area: 'compliance',
      prazo_sugerido_dias: 5,
      automatizavel: true,
    });
  }

  return acoes;
}

// ── Main Diff Function ──

/**
 * Perform deep structural comparison between two versions of a legal document.
 * Returns a full LegalChangeSummary with classification, impact, and actions.
 */
export function computeLegalDiff(
  sourceId: LegalSourceId,
  documentCode: string,
  documentTitle: string,
  previousContent: string | null,
  currentContent: string
): LegalChangeSummary {
  const currentNorm = normalizeText(currentContent);
  const currentArticles = parseArticles(currentNorm);

  const previousArticles = previousContent
    ? parseArticles(normalizeText(previousContent))
    : [];

  const prevMap = new Map(previousArticles.map(a => [a.key, a]));
  const currMap = new Map(currentArticles.map(a => [a.key, a]));

  const articleDiffs: LegalArticleDiff[] = [];

  // Detect modified and new articles
  for (const [key, curr] of currMap) {
    const prev = prevMap.get(key);

    if (!prev) {
      // New article
      const isParagraph = key.startsWith('§') || key.includes('paragrafo');
      const isInciso = key.includes('inciso');

      articleDiffs.push({
        artigo: curr.label,
        tipo_mudanca: isParagraph ? 'paragrafo_adicionado' : isInciso ? 'inciso_adicionado' : 'artigo_adicionado',
        texto_anterior: null,
        texto_atual: curr.content,
        palavras_adicionadas: tokenize(curr.content).map(t => t.value),
        palavras_removidas: [],
        delta_percentual: 100,
      });
    } else if (curr.hash !== prev.hash) {
      // Modified article
      const { added, removed } = computeWordDiff(prev.content, curr.content);
      const totalWords = Math.max(
        tokenize(prev.content).length,
        tokenize(curr.content).length,
        1
      );
      const delta = Math.round(((added.length + removed.length) / totalWords) * 100);

      // Detect specific change types
      const hasValueChange = added.some(w => /^\d+[.,]?\d*$/.test(w)) || removed.some(w => /^\d+[.,]?\d*$/.test(w));
      const hasPercentChange = added.some(w => w.includes('%')) || removed.some(w => w.includes('%'));
      const isParagraph = key.startsWith('§') || key.includes('paragrafo');
      const isInciso = key.includes('inciso');
      const isAlinea = key.includes('alinea');

      let tipo: TipoMudanca = 'artigo_alterado';
      if (hasPercentChange) tipo = 'percentual_alterado';
      else if (hasValueChange) tipo = 'valor_alterado';
      else if (isParagraph) tipo = 'paragrafo_adicionado';
      else if (isInciso) tipo = 'inciso_alterado';
      else if (isAlinea) tipo = 'alinea_alterada';
      else if (key === '__preamble__') tipo = 'ementa_alterada';

      articleDiffs.push({
        artigo: curr.label,
        tipo_mudanca: tipo,
        texto_anterior: prev.content,
        texto_atual: curr.content,
        palavras_adicionadas: added,
        palavras_removidas: removed,
        delta_percentual: delta,
      });
    }
  }

  // Detect revoked (removed) articles
  for (const [key, prev] of prevMap) {
    if (!currMap.has(key)) {
      const isParagraph = key.startsWith('§') || key.includes('paragrafo');
      const isInciso = key.includes('inciso');

      articleDiffs.push({
        artigo: prev.label,
        tipo_mudanca: isParagraph ? 'paragrafo_removido' : isInciso ? 'inciso_revogado' : 'artigo_revogado',
        texto_anterior: prev.content,
        texto_atual: null,
        palavras_adicionadas: [],
        palavras_removidas: tokenize(prev.content).map(t => t.value),
        delta_percentual: -100,
      });
    }
  }

  // Classify
  const gravidade = detectGravidade(articleDiffs);
  const areas = detectAreasImpactadas(articleDiffs);
  const impacto = estimateImpact(gravidade, areas, articleDiffs);
  const acoes = generateAcoes(areas, gravidade, impacto);

  // Determine overall change type
  const totalRevogacoes = articleDiffs.filter(d =>
    d.tipo_mudanca.includes('revogad') || d.tipo_mudanca.includes('removido')
  ).length;
  const totalNovos = articleDiffs.filter(d =>
    d.tipo_mudanca.includes('adicionado')
  ).length;
  const totalAlterados = articleDiffs.filter(d =>
    !d.tipo_mudanca.includes('adicionado') && !d.tipo_mudanca.includes('revogad') && !d.tipo_mudanca.includes('removido')
  ).length;

  const overallType: TipoMudanca =
    totalRevogacoes > 0 && totalAlterados === 0 && totalNovos === 0 ? 'revogacao_total' :
    totalRevogacoes > 0 ? 'revogacao_parcial' :
    totalNovos > 0 && totalAlterados === 0 ? 'artigo_adicionado' :
    'artigo_alterado';

  // Summary text
  const parts: string[] = [];
  if (totalAlterados > 0) parts.push(`${totalAlterados} artigo(s) alterado(s)`);
  if (totalNovos > 0) parts.push(`${totalNovos} dispositivo(s) adicionado(s)`);
  if (totalRevogacoes > 0) parts.push(`${totalRevogacoes} dispositivo(s) revogado(s)`);

  const resumo = articleDiffs.length === 0
    ? `Nenhuma alteração estrutural detectada em ${documentTitle}.`
    : `${documentTitle}: ${parts.join(', ')}. Gravidade: ${gravidade}.`;

  return {
    change_id: `diff_${sourceId}_${documentCode}_${Date.now()}`,
    source_id: sourceId,
    document_code: documentCode,
    document_title: documentTitle,
    analyzed_at: new Date().toISOString(),
    tipo_mudanca: overallType,
    gravidade,
    impacto_estimado: impacto,
    resumo,
    detalhamento: articleDiffs.map(d =>
      `• ${d.artigo}: ${d.tipo_mudanca} (delta ${d.delta_percentual}%)`
    ).join('\n'),
    artigos_alterados: articleDiffs,
    total_artigos_alterados: totalAlterados,
    total_paragrafos_novos: totalNovos,
    total_revogacoes: totalRevogacoes,
    areas_impactadas: areas,
    acoes_recomendadas: acoes,
    prazo_adequacao: gravidade === 'critica' ? '5 dias' : gravidade === 'alta' ? '15 dias' : gravidade === 'media' ? '30 dias' : null,
  };
}
