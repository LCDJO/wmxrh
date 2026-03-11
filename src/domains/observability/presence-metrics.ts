/**
 * User Presence metrics — Prometheus-compatible counters/gauges
 * integrated with the ObservabilityCore MetricsCollector.
 */
import { getMetricsCollector } from '@/domains/observability/metrics-collector';

export function setOnlineUsersTotal(v: number) {
  getMetricsCollector().gauge('presence_online_users_total', v);
}

export function setIdleUsersTotal(v: number) {
  getMetricsCollector().gauge('presence_idle_users_total', v);
}

export function incrementLoginEvents(labels: Record<string, string> = {}) {
  getMetricsCollector().increment('presence_login_events_total', labels);
}

export function setVpnSessionsTotal(v: number) {
  getMetricsCollector().gauge('presence_vpn_sessions_total', v);
}

export function setMobileSessionsPct(v: number) {
  getMetricsCollector().gauge('presence_mobile_sessions_pct', v);
}

export function setUniqueCountriesTotal(v: number) {
  getMetricsCollector().gauge('presence_unique_countries_total', v);
}
