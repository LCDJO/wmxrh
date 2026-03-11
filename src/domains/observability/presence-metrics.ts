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

export function setActiveSessionsTotal(v: number) {
  getMetricsCollector().gauge('active_sessions_total', v);
}

export function setSessionDurationAvg(v: number) {
  getMetricsCollector().gauge('session_duration_avg_seconds', v);
}

export function recordGeoLoginDistribution(country: string) {
  getMetricsCollector().increment('geo_login_distribution', { country });
}

export function setLoginEventsTotal(v: number) {
  getMetricsCollector().gauge('login_events_total', v);
}
