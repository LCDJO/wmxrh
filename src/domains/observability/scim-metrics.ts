/**
 * SCIM Metrics — Helpers for incrementing SCIM-specific Prometheus counters.
 */
import { getMetricsCollector } from './metrics-collector';

export function incrementScimCreated(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('scim_users_created_total', labels);
}

export function incrementScimUpdated(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('scim_users_updated_total', labels);
}

export function incrementScimDeactivated(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('scim_users_deactivated_total', labels);
}

export function incrementScimErrors(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('scim_errors_total', labels);
}
