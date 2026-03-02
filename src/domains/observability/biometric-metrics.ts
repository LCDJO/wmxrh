/**
 * Biometric Metrics — Prometheus-compatible counters for the Biometric Trust Layer.
 *
 * Metrics exported:
 *   biometric_enrollments_total            (counter, labels: method)
 *   biometric_verifications_total          (counter, labels: result)
 *   biometric_spoof_detections_total       (counter, labels: result)
 *   biometric_liveness_failures_total      (counter, labels: stage)
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
