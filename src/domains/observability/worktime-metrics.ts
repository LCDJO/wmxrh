/**
 * WorkTime Metrics — Prometheus-compatible counters for the WorkTime Compliance Engine.
 *
 * Metrics exported:
 *   clock_entries_total                  (counter, labels: event_type, source)
 *   geo_violation_total                  (counter, labels: tenant_id)
 *   fraud_flags_total                    (counter, labels: fraud_type, severity)
 *   device_integrity_failures_total      (counter, labels: reason)
 */
import { getMetricsCollector } from './metrics-collector';

export function incrementClockEntries(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('clock_entries_total', labels);
}

export function incrementGeoViolation(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('geo_violation_total', labels);
}

export function incrementFraudFlags(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('fraud_flags_total', labels);
}

export function incrementDeviceIntegrityFailures(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('device_integrity_failures_total', labels);
}
