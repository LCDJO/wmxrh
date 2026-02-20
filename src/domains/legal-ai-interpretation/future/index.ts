/**
 * Legal AI Interpretation — Future Modules Index
 *
 * Barrel export for all future preparation stubs.
 * These modules are designed but not yet implemented.
 */

// 1. AI trained on historical decisions
export {
  collectTrainingData,
  submitTrainingBatch,
  getHistoricalConfidence,
  type TrainingDataPoint,
  type TrainingBatch,
  type TrainingResult,
  type DecisionHistoryQuery,
} from './ai-decision-training.service';

// 2. Jurisprudence database integration
export {
  searchJurisprudence,
  enrichWithJurisprudence,
  type JurisprudenceSource,
  type JurisprudenceQuery,
  type JurisprudenceResult,
  type JurisprudenceSearchResult,
  type JurisprudenceEnrichment,
} from './jurisprudence-integration.service';

// 3. Labor risk prediction
export {
  predictLaborRisks,
  getRiskTrend,
  type RiskCategory,
  type RiskTimeframe,
  type RiskPredictionInput,
  type RiskPrediction,
  type RiskFactor,
  type RiskPredictionResult,
} from './labor-risk-prediction.service';

// 4. Preventive recommendations
export {
  generatePreventiveRecommendations,
  getUpcomingRiskDeadlines,
  type RecommendationType,
  type UrgencyLevel,
  type PreventiveRecommendation,
  type RecommendationSource,
  type PreventiveAnalysisInput,
  type PreventiveAnalysisResult,
} from './preventive-recommendation.service';
