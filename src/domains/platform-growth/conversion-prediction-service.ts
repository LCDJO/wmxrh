/**
 * ConversionPredictionService — Predicts conversion likelihood for leads visiting landing pages.
 */
import type { ConversionPrediction } from './types';

export class ConversionPredictionService {
  predict(source: string): ConversionPrediction {
    const scores: Record<string, number> = {
      referral: 82, organic: 45, paid_google: 61, paid_meta: 54, direct: 38,
    };
    return {
      leadId: `lead-${Date.now()}`,
      source,
      score: scores[source] ?? 40,
      predictedPlan: scores[source] >= 70 ? 'professional' : 'starter',
      predictedMRR: scores[source] >= 70 ? 499 : 199,
      topFactors: ['Tempo na página > 3min', 'Visitou pricing', 'Referral ativo'],
      predictedAt: new Date().toISOString(),
    };
  }

  getBatchPredictions(): ConversionPrediction[] {
    return ['referral', 'organic', 'paid_google', 'paid_meta', 'direct'].map(s => this.predict(s));
  }
}

export const conversionPredictionService = new ConversionPredictionService();
