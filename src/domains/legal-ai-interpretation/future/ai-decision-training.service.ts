/**
 * Future: AI Legal Decision Training Engine — Stub
 *
 * Will train AI models using historical interpretation logs
 * to improve accuracy of future legal recommendations.
 *
 * Data sources:
 *  - legal_interpretation_logs (audit trail)
 *  - User feedback on recommendations (accepted/rejected/modified)
 *  - Outcome tracking (was the recommendation effective?)
 *
 * Architecture:
 *  - Edge function collects training data batches
 *  - Sends to Lovable AI for fine-tuning context
 *  - Feedback loop updates confidence scores
 */

// ── Types ──

export interface TrainingDataPoint {
  interpretation_id: string;
  norm_codigo: string;
  mudanca_resumo: string;
  recomendacao_original: string;
  acao_tomada: 'aceita' | 'rejeitada' | 'modificada';
  modificacao_descricao?: string;
  resultado_observado?: 'positivo' | 'neutro' | 'negativo';
  feedback_score: number; // 1-5
  created_at: string;
}

export interface TrainingBatch {
  batch_id: string;
  tenant_id: string;
  data_points: TrainingDataPoint[];
  model_version: string;
  created_at: string;
}

export interface TrainingResult {
  batch_id: string;
  accuracy_before: number;
  accuracy_after: number;
  data_points_processed: number;
  modelo_atualizado: boolean;
  next_training_at: string | null;
}

export interface DecisionHistoryQuery {
  tenant_id: string;
  norm_codigo?: string;
  date_from?: string;
  date_to?: string;
  min_feedback_score?: number;
  limit?: number;
}

// ── Stubs ──

/** Stub: Collect training data from interpretation feedback. */
export async function collectTrainingData(
  _tenantId: string,
  _query?: Partial<DecisionHistoryQuery>,
): Promise<TrainingDataPoint[]> {
  console.warn('[AI Training] collectTrainingData is a stub — not yet implemented');
  return [];
}

/** Stub: Submit training batch for model improvement. */
export async function submitTrainingBatch(
  _batch: TrainingBatch,
): Promise<TrainingResult> {
  console.warn('[AI Training] submitTrainingBatch is a stub — not yet implemented');
  return {
    batch_id: _batch.batch_id,
    accuracy_before: 0,
    accuracy_after: 0,
    data_points_processed: 0,
    modelo_atualizado: false,
    next_training_at: null,
  };
}

/** Stub: Get confidence score for a given norm based on historical data. */
export function getHistoricalConfidence(
  _normCodigo: string,
  _tenantId: string,
): number {
  console.warn('[AI Training] getHistoricalConfidence is a stub — not yet implemented');
  return 0.5; // default mid-confidence
}
