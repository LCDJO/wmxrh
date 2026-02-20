/**
 * Future: Labor Risk Prediction Engine — Stub
 *
 * Will use AI + historical data to predict probability
 * of labor litigation, fines, and compliance failures.
 *
 * Data inputs:
 *  - legal_interpretation_logs (historical patterns)
 *  - career_risk_alerts (active risks)
 *  - Audit logs (compliance gaps)
 *  - Jurisprudence trends (case law direction)
 *  - Company profile (CNAE, grau_risco, headcount)
 *
 * Outputs:
 *  - Per-company risk scores
 *  - Predicted fine ranges (R$)
 *  - Risk timeline projections
 *  - Highest-risk positions/departments
 */

// ── Types ──

export type RiskCategory =
  | 'trabalhista_individual'
  | 'trabalhista_coletiva'
  | 'sst_autuacao'
  | 'esocial_penalidade'
  | 'sindical_conflito'
  | 'rescisao_indevida';

export type RiskTimeframe = '30d' | '90d' | '180d' | '365d';

export interface RiskPredictionInput {
  tenant_id: string;
  company_id: string;
  timeframe: RiskTimeframe;
  categories?: RiskCategory[];
}

export interface RiskPrediction {
  category: RiskCategory;
  probabilidade: number;        // 0-1
  impacto_financeiro_min: number;
  impacto_financeiro_max: number;
  fatores_contribuintes: RiskFactor[];
  tendencia: 'crescente' | 'estavel' | 'decrescente';
  confianca: number;            // 0-1
}

export interface RiskFactor {
  fator: string;
  peso: number;                 // 0-1
  descricao: string;
  mitigavel: boolean;
  acao_sugerida?: string;
}

export interface RiskPredictionResult {
  company_id: string;
  timeframe: RiskTimeframe;
  score_geral: number;          // 0-100
  predictions: RiskPrediction[];
  top_risks: RiskPrediction[];  // top 3 by probability
  exposicao_financeira_total: number;
  cargos_maior_risco: string[];
  departamentos_maior_risco: string[];
  modelo_versao: string;
  generated_at: string;
}

// ── Stubs ──

/** Stub: Generate labor risk predictions for a company. */
export async function predictLaborRisks(
  _input: RiskPredictionInput,
): Promise<RiskPredictionResult> {
  console.warn('[RiskPrediction] predictLaborRisks is a stub — not yet implemented');
  return {
    company_id: _input.company_id,
    timeframe: _input.timeframe,
    score_geral: 0,
    predictions: [],
    top_risks: [],
    exposicao_financeira_total: 0,
    cargos_maior_risco: [],
    departamentos_maior_risco: [],
    modelo_versao: 'stub-0.0.0',
    generated_at: new Date().toISOString(),
  };
}

/** Stub: Get risk trend for a company over multiple timeframes. */
export async function getRiskTrend(
  _tenantId: string,
  _companyId: string,
): Promise<{ timeframe: RiskTimeframe; score: number }[]> {
  console.warn('[RiskPrediction] getRiskTrend is a stub — not yet implemented');
  return [];
}
