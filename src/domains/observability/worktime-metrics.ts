/**
 * WorkTime Metrics — Prometheus-compatible counters for the WorkTime Compliance Engine.
 *
 * Metrics exported:
 *   clock_entries_total                  (counter, labels: event_type, source)
 *   geo_violation_total                  (counter, labels: tenant_id)
 *   fraud_flags_total                    (counter, labels: fraud_type, severity)
 *   device_integrity_failures_total      (counter, labels: reason)
 *   rep_time_sync_failures_total         (counter, labels: tenant_id, server)
 *   afd_generated_total                  (counter, labels: tenant_id)
 *   aej_generated_total                  (counter, labels: tenant_id, format)
 *   rep_version_changes_total            (counter, labels: version)
 *   technical_log_entries_total          (counter, labels: tenant_id, event_type)
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

// ── REP-C Compliance Metrics ──

export function incrementTimeSyncFailures(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('rep_time_sync_failures_total', labels);
}

export function incrementAFDGenerated(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('afd_generated_total', labels);
}

export function incrementAEJGenerated(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('aej_generated_total', labels);
}

export function incrementREPVersionChanges(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('rep_version_changes_total', labels);
}

export function incrementTechnicalLogEntries(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('technical_log_entries_total', labels);
}
