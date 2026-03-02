/**
 * Behavioral AI Metrics — Prometheus-compatible counters for the Fraud Engine.
 *
 * Metrics exported:
 *   behavior_anomalies_total           (counter, labels: type, severity)
 *   high_risk_entries_total            (counter, labels: risk_level)
 *   shared_device_suspicions_total     (counter, labels: match_type)
 *   ai_model_accuracy_score            (gauge)
 */
import { getMetricsCollector } from './metrics-collector';

export function incrementBehaviorAnomalies(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('behavior_anomalies_total', labels);
}

export function incrementHighRiskEntries(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('high_risk_entries_total', labels);
}

export function incrementSharedDeviceSuspicions(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('shared_device_suspicions_total', labels);
}

export function setAIModelAccuracyScore(value: number) {
  getMetricsCollector().gauge('ai_model_accuracy_score', value);
}
