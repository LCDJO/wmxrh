/**
 * Accident Prediction AI — Type Definitions
 *
 * Preparation layer for future predictive AI integration.
 * Defines the input features, model output, and risk factors
 * for fleet accident prediction.
 *
 * Status: Types-ready (model integration pending)
 */

// ════════════════════════════════════════════════════════════════
// PREDICTION INPUT FEATURES
// ════════════════════════════════════════════════════════════════

export interface AccidentPredictionFeatures {
  employee_id: string;
  /** Behavioral score (0–100) */
  behavioral_score: number;
  /** Total behavior events in last 90 days */
  events_last_90d: number;
  /** Critical events in last 90 days */
  critical_events_last_90d: number;
  /** Average daily km driven (estimated from tracking) */
  avg_daily_km: number;
  /** Percentage of trips with overspeed events */
  overspeed_rate_pct: number;
  /** Percentage of trips outside allowed hours */
  after_hours_rate_pct: number;
  /** Number of geofence violations in last 30 days */
  geofence_violations_30d: number;
  /** Number of active warnings */
  active_warnings: number;
  /** Days since last incident */
  days_since_last_incident: number;
  /** Years of experience (from employee record) */
  years_experience: number;
  /** Device type factor */
  device_type: 'moto' | 'carro' | 'celular';
  /** Whether all mandatory agreements are signed */
  agreements_compliant: boolean;
  /** Hour of day most frequently driven (0-23) */
  peak_driving_hour: number;
  /** Route complexity score (0–10, from planned routes) */
  route_complexity: number;
}

// ════════════════════════════════════════════════════════════════
// PREDICTION OUTPUT
// ════════════════════════════════════════════════════════════════

export type AccidentRiskLevel = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';

export interface AccidentPrediction {
  employee_id: string;
  /** Risk probability 0.0–1.0 */
  risk_probability: number;
  risk_level: AccidentRiskLevel;
  /** Confidence of the prediction 0.0–1.0 */
  confidence: number;
  /** Top contributing factors ordered by importance */
  top_factors: AccidentRiskFactor[];
  /** Recommended preventive actions */
  recommended_actions: string[];
  /** Prediction model version */
  model_version: string;
  predicted_at: string;
}

export interface AccidentRiskFactor {
  feature: keyof AccidentPredictionFeatures;
  label: string;
  contribution_pct: number;
  direction: 'increases_risk' | 'decreases_risk';
  value: number | string | boolean;
}

// ════════════════════════════════════════════════════════════════
// PREDICTION SERVICE INTERFACE (for future implementation)
// ════════════════════════════════════════════════════════════════

export interface AccidentPredictionService {
  /** Predict accident risk for a single employee */
  predict(features: AccidentPredictionFeatures): Promise<AccidentPrediction>;

  /** Batch predict for multiple employees */
  predictBatch(features: AccidentPredictionFeatures[]): Promise<AccidentPrediction[]>;

  /** Get model metadata */
  getModelInfo(): { version: string; trainedAt: string; accuracy: number };
}

// ════════════════════════════════════════════════════════════════
// HEURISTIC PREDICTOR (rule-based fallback before ML model)
// ════════════════════════════════════════════════════════════════

/**
 * Simple heuristic-based accident risk estimator.
 * Used as fallback until a trained ML model is available.
 * Pure function — no I/O.
 */
export function estimateAccidentRisk(features: AccidentPredictionFeatures): AccidentPrediction {
  const factors: AccidentRiskFactor[] = [];
  let riskScore = 0;

  // Behavioral score (inverted — lower score = higher risk)
  const behaviorRisk = Math.max(0, (100 - features.behavioral_score) / 100);
  riskScore += behaviorRisk * 0.3;
  if (behaviorRisk > 0.4) {
    factors.push({
      feature: 'behavioral_score',
      label: 'Score comportamental baixo',
      contribution_pct: Math.round(behaviorRisk * 30),
      direction: 'increases_risk',
      value: features.behavioral_score,
    });
  }

  // Overspeed frequency
  const overspeedRisk = Math.min(1, features.overspeed_rate_pct / 50);
  riskScore += overspeedRisk * 0.2;
  if (overspeedRisk > 0.3) {
    factors.push({
      feature: 'overspeed_rate_pct',
      label: 'Taxa de excesso de velocidade',
      contribution_pct: Math.round(overspeedRisk * 20),
      direction: 'increases_risk',
      value: features.overspeed_rate_pct,
    });
  }

  // Critical events
  const criticalRisk = Math.min(1, features.critical_events_last_90d / 5);
  riskScore += criticalRisk * 0.15;
  if (criticalRisk > 0.2) {
    factors.push({
      feature: 'critical_events_last_90d',
      label: 'Eventos críticos recentes',
      contribution_pct: Math.round(criticalRisk * 15),
      direction: 'increases_risk',
      value: features.critical_events_last_90d,
    });
  }

  // After hours driving
  const afterHoursRisk = Math.min(1, features.after_hours_rate_pct / 30);
  riskScore += afterHoursRisk * 0.1;
  if (afterHoursRisk > 0.3) {
    factors.push({
      feature: 'after_hours_rate_pct',
      label: 'Condução fora do horário',
      contribution_pct: Math.round(afterHoursRisk * 10),
      direction: 'increases_risk',
      value: features.after_hours_rate_pct,
    });
  }

  // Vehicle type risk (moto > carro)
  const typeMultiplier = features.device_type === 'moto' ? 1.3 : 1.0;
  riskScore *= typeMultiplier;
  if (features.device_type === 'moto') {
    factors.push({
      feature: 'device_type',
      label: 'Veículo tipo motocicleta',
      contribution_pct: 10,
      direction: 'increases_risk',
      value: features.device_type,
    });
  }

  // Positive: days without incident
  if (features.days_since_last_incident > 60) {
    const bonus = Math.min(0.1, features.days_since_last_incident / 1000);
    riskScore = Math.max(0, riskScore - bonus);
    factors.push({
      feature: 'days_since_last_incident',
      label: 'Período sem incidentes',
      contribution_pct: Math.round(bonus * 100),
      direction: 'decreases_risk',
      value: features.days_since_last_incident,
    });
  }

  const probability = Math.max(0, Math.min(1, Math.round(riskScore * 100) / 100));

  const risk_level: AccidentRiskLevel =
    probability >= 0.8 ? 'very_high'
    : probability >= 0.6 ? 'high'
    : probability >= 0.4 ? 'moderate'
    : probability >= 0.2 ? 'low'
    : 'very_low';

  const recommended_actions: string[] = [];
  if (probability >= 0.6) {
    recommended_actions.push('Treinamento de direção defensiva obrigatório');
    recommended_actions.push('Acompanhamento semanal pelo gestor');
  }
  if (probability >= 0.4) {
    recommended_actions.push('Revisão de rotas e horários de condução');
    recommended_actions.push('Monitoramento em tempo real reforçado');
  }
  if (features.overspeed_rate_pct > 20) {
    recommended_actions.push('Instalação de limitador de velocidade');
  }
  if (!features.agreements_compliant) {
    recommended_actions.push('Regularizar termos obrigatórios pendentes');
  }

  return {
    employee_id: features.employee_id,
    risk_probability: probability,
    risk_level,
    confidence: 0.65, // heuristic = moderate confidence
    top_factors: factors.sort((a, b) => b.contribution_pct - a.contribution_pct).slice(0, 5),
    recommended_actions,
    model_version: 'heuristic-v1',
    predicted_at: new Date().toISOString(),
  };
}
