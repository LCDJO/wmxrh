/**
 * Future: Jurisprudence Integration Engine — Stub
 *
 * Will connect to external jurisprudence databases (TST, TRT, STF)
 * to enrich legal interpretations with case law precedents.
 *
 * Planned integrations:
 *  - LexML Brasil (lexml.gov.br)
 *  - JusBrasil API
 *  - TST Jurisprudência Unificada
 *  - TRT Regional databases
 *
 * Flow:
 *  1. Legal change detected → query relevant case law
 *  2. AI summarizes precedents related to the change
 *  3. Attach precedent summaries to interpretation output
 */

// ── Types ──

export type JurisprudenceSource = 'tst' | 'trt' | 'stf' | 'stj' | 'lexml' | 'jusbrasil';

export interface JurisprudenceQuery {
  tema: string;
  norma_relacionada?: string;
  periodo_inicio?: string;
  periodo_fim?: string;
  tribunal?: JurisprudenceSource;
  limite?: number;
}

export interface JurisprudenceResult {
  id: string;
  tribunal: JurisprudenceSource;
  numero_processo: string;
  relator: string;
  data_julgamento: string;
  ementa: string;
  resumo_ia?: string;
  relevancia_score: number; // 0-100
  url_fonte: string;
  tese_vinculante: boolean;
  palavras_chave: string[];
}

export interface JurisprudenceSearchResult {
  success: boolean;
  total_encontrados: number;
  resultados: JurisprudenceResult[];
  fontes_consultadas: JurisprudenceSource[];
  latencia_ms: number;
  error?: string;
}

export interface JurisprudenceEnrichment {
  norm_codigo: string;
  precedentes_relevantes: JurisprudenceResult[];
  teses_vinculantes: JurisprudenceResult[];
  tendencia_decisoria: 'favoravel_empregador' | 'favoravel_empregado' | 'equilibrada' | 'indefinida';
  nivel_consolidacao: 'sumula' | 'jurisprudencia_dominante' | 'divergente' | 'materia_nova';
  recomendacao_baseada_em_precedentes: string | null;
  generated_at: string;
}

// ── Stubs ──

/** Stub: Search jurisprudence databases for relevant case law. */
export async function searchJurisprudence(
  _query: JurisprudenceQuery,
): Promise<JurisprudenceSearchResult> {
  console.warn('[Jurisprudence] searchJurisprudence is a stub — not yet implemented');
  return {
    success: false,
    total_encontrados: 0,
    resultados: [],
    fontes_consultadas: [],
    latencia_ms: 0,
    error: 'Jurisprudence integration not yet implemented',
  };
}

/** Stub: Enrich a legal interpretation with jurisprudence data. */
export async function enrichWithJurisprudence(
  _normCodigo: string,
  _tema: string,
): Promise<JurisprudenceEnrichment> {
  console.warn('[Jurisprudence] enrichWithJurisprudence is a stub — not yet implemented');
  return {
    norm_codigo: _normCodigo,
    precedentes_relevantes: [],
    teses_vinculantes: [],
    tendencia_decisoria: 'indefinida',
    nivel_consolidacao: 'materia_nova',
    recomendacao_baseada_em_precedentes: null,
    generated_at: new Date().toISOString(),
  };
}
