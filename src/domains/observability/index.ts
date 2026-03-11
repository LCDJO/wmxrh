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
 *   ├── GatewayPerformanceTracker→ gateway/module/AccessGraph latency
 *   └── GrafanaIntegrationAdapter
 *       ├── Prometheus  → metrics text export
 *       ├── Loki        → structured log streams
 *       └── Tempo       → distributed traces (W3C Trace Context)
 */
export { getMetricsCollector, MetricsCollector } from './metrics-collector';
export { getHealthMonitor, HealthMonitor } from './health-monitor';
export { getErrorTracker, ErrorTracker } from './error-tracker';
export { getPerformanceProfiler, PerformanceProfiler } from './performance-profiler';
export { getSecurityEventCollector, SecurityEventCollector } from './security-event-collector';
export { getLogStreamAdapter, LogStreamAdapter } from './log-stream-adapter';
export { getGatewayPerformanceTracker, GatewayPerformanceTracker } from './gateway-performance-tracker';
export {
  exportPrometheus,
  exportLogsAsLoki,
  generateDashboardModel,
  getTraceCollector,
  TraceCollector,
} from './grafana-integration-adapter';
export type * from './types';
export {
  recordPageView, recordConversion, recordFABClick, recordLandingRevenue,
  recordAIHeadline, recordFABImpression, recordFABClickForRate, recordAIHeadlineForAccumulator,
  collectGrowthMetrics,
} from './growth-metrics-collector';
export type { GrowthMetricsSnapshot } from './growth-metrics-collector';
export { OBSERVABILITY_KERNEL_EVENTS } from './observability-events';
export type * from './observability-events';
export { collectFederationMetrics, getFederationMetricsSnapshot } from './federation-metrics-collector';
export type { FederationMetricsSnapshot } from './federation-metrics-collector';
export {
  incrementScimCreated, incrementScimUpdated,
  incrementScimDeactivated, incrementScimErrors,
} from './scim-metrics';
export {
  incrementClockEntries, incrementGeoViolation,
  incrementFraudFlags, incrementDeviceIntegrityFailures,
} from './worktime-metrics';
export {
  incrementBiometricEnrollments, incrementBiometricVerifications,
  incrementBiometricSpoofDetections, incrementBiometricLivenessFailures,
  incrementBiometricMatchSuccess, incrementLivenessFailures,
  incrementFraudBiometricFlags, incrementDeepfakeSuspected,
} from './biometric-metrics';
export {
  incrementBehaviorAnomalies, incrementHighRiskEntries,
  incrementSharedDeviceSuspicions, setAIModelAccuracyScore,
} from './behavioral-ai-metrics';
export {
  setWhiteLabelEnabledTotal, incrementBrandingUpdates,
  setCustomDomainActiveTotal,
} from './whitelabel-metrics';
export {
  setOnlineUsersTotal, setIdleUsersTotal, incrementLoginEvents,
  setVpnSessionsTotal, setMobileSessionsPct, setUniqueCountriesTotal,
} from './presence-metrics';
