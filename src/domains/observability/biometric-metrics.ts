/**
 * Biometric Metrics — Prometheus-compatible counters for the Biometric Trust Layer.
 *
 * Metrics exported:
 *   biometric_enrollments_total            (counter, labels: method)
 *   biometric_verifications_total          (counter, labels: result)
 *   biometric_spoof_detections_total       (counter, labels: result)
 *   biometric_liveness_failures_total      (counter, labels: stage)
 *   biometric_match_success_total          (counter, labels: tenant_id)
 *   liveness_failures_total                (counter, labels: stage, reason)
 *   fraud_biometric_flags_total            (counter, labels: fraud_type, severity)
 *   deepfake_suspected_total              (counter, labels: confidence_bucket)
 */
import { getMetricsCollector } from './metrics-collector';

export function incrementBiometricEnrollments(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('biometric_enrollments_total', labels);
}

export function incrementBiometricVerifications(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('biometric_verifications_total', labels);
}

export function incrementBiometricSpoofDetections(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('biometric_spoof_detections_total', labels);
}

export function incrementBiometricLivenessFailures(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('biometric_liveness_failures_total', labels);
}

// ── New metrics (item 11) ───────────────────────────────────────

export function incrementBiometricMatchSuccess(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('biometric_match_success_total', labels);
}

export function incrementLivenessFailures(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('liveness_failures_total', labels);
}

export function incrementFraudBiometricFlags(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('fraud_biometric_flags_total', labels);
}

export function incrementDeepfakeSuspected(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('deepfake_suspected_total', labels);
}
