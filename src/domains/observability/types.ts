/**
 * Platform Observability & Monitoring — Type Definitions
 *
 * Provides metrics collection, health monitoring, error tracking,
 * and performance profiling with Prometheus/OpenTelemetry export.
 */

// ── Metrics ─────────────────────────────────────────────────────

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricPoint {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export interface MetricSeries {
  name: string;
  type: MetricType;
  labels: Record<string, string>;
  points: Array<{ value: number; timestamp: number }>;
}

// ── Module Health ───────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface ModuleHealthReport {
  module_id: string;
  module_label: string;
  status: HealthStatus;
  uptime_ms: number;
  last_heartbeat: number;
  latency_ms: number;
  error_count_1h: number;
  error_rate_pct: number;
  metadata?: Record<string, unknown>;
}

export interface PlatformHealthSummary {
  overall: HealthStatus;
  modules: ModuleHealthReport[];
  total_modules: number;
  healthy_count: number;
  degraded_count: number;
  down_count: number;
  checked_at: number;
}

// ── Security Events ─────────────────────────────────────────────

export type SecurityEventType =
  | 'access_denied'
  | 'access_granted'
  | 'impersonation_start'
  | 'impersonation_end'
  | 'anomaly_detected'
  | 'brute_force_attempt'
  | 'privilege_escalation'
  | 'session_expired';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  user_id?: string;
  user_label?: string;
  tenant_id?: string;
  resource: string;
  action: string;
  result: 'allowed' | 'denied' | 'flagged';
  risk_score?: number;
  ip_address?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ── Error Tracking ──────────────────────────────────────────────

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'fatal';

export interface TrackedError {
  id: string;
  message: string;
  stack?: string;
  source: 'frontend' | 'edge_function' | 'database';
  severity: ErrorSeverity;
  module_id?: string;
  user_id?: string;
  url?: string;
  count: number;
  first_seen: number;
  last_seen: number;
  resolved: boolean;
  metadata?: Record<string, unknown>;
}

export interface ErrorSummary {
  total_errors_1h: number;
  total_errors_24h: number;
  error_rate_per_min: number;
  top_errors: TrackedError[];
  by_source: Record<string, number>;
  by_severity: Record<string, number>;
}

// ── Performance ─────────────────────────────────────────────────

export interface PerformanceMetrics {
  page_load_ms: number;
  ttfb_ms: number;
  fcp_ms: number;
  lcp_ms: number;
  cls: number;
  fid_ms: number;
  memory_used_mb: number;
  memory_total_mb: number;
  dom_nodes: number;
  js_heap_mb: number;
  timestamp: number;
}

export interface PerformanceSummary {
  avg_page_load_ms: number;
  p95_page_load_ms: number;
  avg_ttfb_ms: number;
  current: PerformanceMetrics | null;
  history: PerformanceMetrics[];
}

// ── Prometheus Export ────────────────────────────────────────────

export interface PrometheusMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  samples: Array<{
    labels: Record<string, string>;
    value: number;
    timestamp?: number;
  }>;
}

// ── Observability State ─────────────────────────────────────────

export interface ObservabilityState {
  health: PlatformHealthSummary | null;
  errors: ErrorSummary | null;
  security_events: SecurityEvent[];
  performance: PerformanceSummary | null;
  metrics: MetricPoint[];
  last_refresh: number | null;
}
