/**
 * WhiteLabel Metrics — Prometheus-compatible counters for branding/personalization.
 *
 * Metrics exported:
 *   tenants_whitelabel_enabled_total    (gauge)
 *   branding_updates_total              (counter)
 *   custom_domain_active_total          (gauge)
 */
import { getMetricsCollector } from './metrics-collector';

export function setWhiteLabelEnabledTotal(value: number) {
  getMetricsCollector().gauge('tenants_whitelabel_enabled_total', value);
}

export function incrementBrandingUpdates(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('branding_updates_total', labels);
}

export function setCustomDomainActiveTotal(value: number) {
  getMetricsCollector().gauge('custom_domain_active_total', value);
}
