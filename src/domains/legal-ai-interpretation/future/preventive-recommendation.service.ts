/**
 * Future: Preventive Recommendation Engine — Stub
 *
 * Proactive compliance recommendations BEFORE regulatory
 * infractions occur. Uses risk predictions + jurisprudence
 * trends + historical patterns to suggest preventive actions.
 *
 * Architecture:
 *  1. Scheduled analysis (daily/weekly) per tenant
 *  2. Cross-reference: active risks × upcoming deadlines × case law trends
 *  3. Generate prioritized preventive action cards
 *  4. Notify Admin/HR via Smart Notifications
 *
 * Dependencies:
 *  - Labor Risk Prediction Engine
 *  - Jurisprudence Integration
 *  - AI Decision Training (for accuracy)
 *  - Notification System (delivery)
 */

// ── Types ──

export type RecommendationType =
  | 'atualizar_documento'
  | 'treinar_equipe'
  | 'revisar_politica'
  | 'adequar_processo'
  | 'consultar_juridico'
  | 'atualizar_epi'
  | 'revisar_pgr'
  | 'atualizar_pcmso';

export type UrgencyLevel = 'preventivo' | 'atencao' | 'urgente' | 'critico';

export interface PreventiveRecommendation {
  id: string;
  tipo: RecommendationType;
  urgencia: UrgencyLevel;
  titulo: string;
  descricao: string;
  justificativa: string;
  base_legal: string[];
  risco_se_ignorado: string;
  impacto_financeiro_estimado: number | null;
  prazo_sugerido_dias: number;
  acoes_concretas: string[];
  departamentos_envolvidos: string[];
  cargos_afetados: string[];
  confianca: number;            // 0-1
  fontes: RecommendationSource[];
}

export interface RecommendationSource {
  tipo: 'historico' | 'jurisprudencia' | 'norma' | 'tendencia';
  referencia: string;
  relevancia: number;
}

export interface PreventiveAnalysisInput {
  tenant_id: string;
  company_id?: string;
  max_recommendations?: number;
}

export interface PreventiveAnalysisResult {
  tenant_id: string;
  company_id: string | null;
  recommendations: PreventiveRecommendation[];
  score_conformidade_atual: number;   // 0-100
  score_conformidade_projetado: number; // after applying recommendations
  economia_estimada: number;
  modelo_versao: string;
  generated_at: string;
}

// ── Stubs ──

/** Stub: Run preventive analysis and generate recommendations. */
export async function generatePreventiveRecommendations(
  _input: PreventiveAnalysisInput,
): Promise<PreventiveAnalysisResult> {
  console.warn('[Preventive] generatePreventiveRecommendations is a stub — not yet implemented');
  return {
    tenant_id: _input.tenant_id,
    company_id: _input.company_id ?? null,
    recommendations: [],
    score_conformidade_atual: 0,
    score_conformidade_projetado: 0,
    economia_estimada: 0,
    modelo_versao: 'stub-0.0.0',
    generated_at: new Date().toISOString(),
  };
}

/** Stub: Get upcoming compliance deadlines that need preventive action. */
export async function getUpcomingRiskDeadlines(
  _tenantId: string,
  _days: number,
): Promise<{ norma: string; prazo: string; risco: UrgencyLevel }[]> {
  console.warn('[Preventive] getUpcomingRiskDeadlines is a stub — not yet implemented');
  return [];
}
