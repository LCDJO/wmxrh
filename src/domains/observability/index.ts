/**
 * Platform Observability & Monitoring — Barrel export.
 *
 * Architecture:
 *  ObservabilityCore
 *   ├── MetricsCollector         → counters, gauges, histograms + Prometheus export
 *   ├── HealthMonitor            → module health, heartbeats, uptime
 *   ├── ErrorTracker             → error capture, dedup, aggregation
 *   ├── PerformanceProfiler      → Web Vitals, memory, DOM stats
 *   ├── SecurityEventCollector   → access events, anomalies, impersonation
 *   ├── LogStreamAdapter         → structured log buffer with real-time streaming
 *   └── GrafanaIntegrationAdapter→ Prometheus/Loki export + dashboard model
 */
export { getMetricsCollector, MetricsCollector } from './metrics-collector';
export { getHealthMonitor, HealthMonitor } from './health-monitor';
export { getErrorTracker, ErrorTracker } from './error-tracker';
export { getPerformanceProfiler, PerformanceProfiler } from './performance-profiler';
export { getSecurityEventCollector, SecurityEventCollector } from './security-event-collector';
export { getLogStreamAdapter, LogStreamAdapter } from './log-stream-adapter';
export { exportPrometheus, exportLogsAsLoki, generateDashboardModel } from './grafana-integration-adapter';
export type * from './types';
