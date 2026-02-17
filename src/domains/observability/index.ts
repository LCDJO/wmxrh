/**
 * Platform Observability & Monitoring — Barrel export.
 *
 * Architecture:
 *  ObservabilityModule
 *   ├── MetricsCollector       → counters, gauges, histograms + Prometheus export
 *   ├── HealthMonitor          → module health, heartbeats, uptime
 *   ├── ErrorTracker           → error capture, dedup, aggregation
 *   ├── PerformanceProfiler    → Web Vitals, memory, DOM stats
 *   └── SecurityEventCollector → access events, anomalies, impersonation
 */
export { getMetricsCollector, MetricsCollector } from './metrics-collector';
export { getHealthMonitor, HealthMonitor } from './health-monitor';
export { getErrorTracker, ErrorTracker } from './error-tracker';
export { getPerformanceProfiler, PerformanceProfiler } from './performance-profiler';
export { getSecurityEventCollector, SecurityEventCollector } from './security-event-collector';
export type * from './types';
