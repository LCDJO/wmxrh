/**
 * GrafanaIntegrationAdapter — Formats observability signals for Grafana-compatible
 * consumption across the three pillars:
 *
 *  1. Prometheus  → metrics text export (/metrics)
 *  2. Loki        → structured log streams with labels
 *  3. Tempo       → distributed traces (future-ready, W3C Trace Context)
 *
 * Also generates a Grafana Dashboard JSON model for one-click import.
 */

import { getMetricsCollector } from './metrics-collector';
import { getHealthMonitor } from './health-monitor';
import { getErrorTracker } from './error-tracker';
import { getPerformanceProfiler } from './performance-profiler';
import { getLogStreamAdapter, type LogEntry } from './log-stream-adapter';
import { getSecurityEventCollector } from './security-event-collector';
import { getGatewayPerformanceTracker } from './gateway-performance-tracker';
import { getBillingMetricsSnapshot } from './billing-metrics-collector';
import type { PrometheusMetric } from './types';

// ═══════════════════════════════════════════════════════════════
// 1. PROMETHEUS — Metrics Export
// ═══════════════════════════════════════════════════════════════

export interface PrometheusExportResult {
  text: string;
  metrics: PrometheusMetric[];
  timestamp: number;
}

export function exportPrometheus(): PrometheusExportResult {
  const collector = getMetricsCollector();

  // ── Standard metrics ───────────────────────────────────────
  // platform_requests_total — tracked via increment calls across the app
  // platform_error_total — tracked via increment calls across the app
  // (these are already populated by subsystems calling collector.increment)

  // module_health_status
  const health = getHealthMonitor().getSummary();
  collector.gauge('module_health_status', health.overall === 'healthy' ? 1 : health.overall === 'degraded' ? 0.5 : 0);
  collector.gauge('platform_modules_total', health.total_modules);
  collector.gauge('platform_modules_healthy', health.healthy_count);
  collector.gauge('platform_modules_degraded', health.degraded_count);
  collector.gauge('platform_modules_down', health.down_count);

  // Per-module health
  for (const mod of health.modules) {
    collector.gauge('module_health_status', mod.status === 'healthy' ? 1 : mod.status === 'degraded' ? 0.5 : 0, { module: mod.module_id });
  }

  // active_identity_sessions / tenant_active_count / impersonation_active_count
  const security = getSecurityEventCollector();
  const now = Date.now();
  const sessionWindow = 30 * 60_000; // 30 min
  const secEvents = security.getEvents({ since: now - sessionWindow });

  const recentSessions = secEvents.filter(e => e.type === 'access_granted');
  collector.gauge('active_identity_sessions', recentSessions.length);

  const activeTenants = new Set(secEvents.filter(e => e.tenant_id).map(e => e.tenant_id));
  collector.gauge('tenant_active_count', activeTenants.size);

  const activeImpersonations = secEvents.filter(e => e.type === 'impersonation_start');
  collector.gauge('impersonation_active_count', activeImpersonations.length);

  // Error stats
  const errors = getErrorTracker().getSummary();
  collector.gauge('platform_error_total', errors.total_errors_24h);
  collector.gauge('errors_1h_total', errors.total_errors_1h);
  collector.gauge('errors_24h_total', errors.total_errors_24h);
  collector.gauge('error_rate_per_min', errors.error_rate_per_min);

  // Perf stats
  const perf = getPerformanceProfiler().getSummary();
  if (perf.current) {
    collector.gauge('perf_page_load_ms', perf.current.page_load_ms);
    collector.gauge('perf_ttfb_ms', perf.current.ttfb_ms);
    collector.gauge('perf_fcp_ms', perf.current.fcp_ms);
    collector.gauge('perf_memory_used_mb', perf.current.memory_used_mb);
    collector.gauge('perf_dom_nodes', perf.current.dom_nodes);
  }

  // Trace stats
  const traceStats = getTraceCollector().getStats();
  collector.gauge('traces_total', traceStats.total);
  collector.gauge('traces_active', traceStats.active);
  collector.gauge('traces_avg_duration_ms', traceStats.avg_duration_ms);

  // Gateway / Module / AccessGraph performance
  const gwPerf = getGatewayPerformanceTracker().getSummary();
  collector.gauge('gateway_response_avg_ms', gwPerf.gateway.avg);
  collector.gauge('gateway_response_p95_ms', gwPerf.gateway.p95);
  collector.gauge('gateway_response_p99_ms', gwPerf.gateway.p99);
  collector.gauge('module_latency_avg_ms', gwPerf.module.avg);
  collector.gauge('module_latency_p95_ms', gwPerf.module.p95);
  collector.gauge('access_graph_recomposition_avg_ms', gwPerf.access_graph.avg);
  collector.gauge('access_graph_recomposition_p95_ms', gwPerf.access_graph.p95);

  for (const [mod, stats] of Object.entries(gwPerf.by_module)) {
    collector.gauge('module_latency_avg_ms', stats.avg, { module: mod });
    collector.gauge('module_latency_p95_ms', stats.p95, { module: mod });
  }

  // ── Self-Healing metrics ──────────────────────────────────
  try {
    const { getSelfHealingEngine } = require('@/domains/self-healing/self-healing-engine') as {
      getSelfHealingEngine: () => import('@/domains/self-healing/self-healing-engine').SelfHealingEngine | null;
    };
    const engine = getSelfHealingEngine();
    if (engine) {
      const shState = engine.getState();
      const shStats = engine.getStats();

      // incident_detected_total
      collector.gauge('incident_detected_total', shStats.total_incidents);

      // auto_recovery_success_rate (0-100)
      collector.gauge('auto_recovery_success_rate', shStats.uptime_pct);

      // self_healing_actions_total — per action type
      const actionCounts: Record<string, number> = {};
      for (const entry of shState.audit_log) {
        actionCounts[entry.action_type] = (actionCounts[entry.action_type] ?? 0) + 1;
      }
      for (const [action, count] of Object.entries(actionCounts)) {
        collector.gauge('self_healing_actions_total', count, { action });
      }

      // module_circuit_state — per module (0=closed, 1=open, 0.5=half_open)
      for (const cb of shState.circuit_breakers) {
        const val = cb.state === 'open' ? 1 : cb.state === 'half_open' ? 0.5 : 0;
        collector.gauge('module_circuit_state', val, { module: cb.module_id });
      }

      // Extra useful gauges
      collector.gauge('self_healing_active_incidents', shState.active_incidents.length);
      collector.gauge('self_healing_escalated_total', shStats.escalated);
      collector.gauge('self_healing_failed_total', shStats.failed_recoveries);
      collector.gauge('self_healing_avg_recovery_ms', shStats.avg_recovery_time_ms);
    }
  } catch {
    // Self-healing engine not initialised — skip
  }

  // ── Billing metrics ─────────────────────────────────────────
  try {
    const billingMetrics = getBillingMetricsSnapshot();
    collector.gauge('billing_mrr_total', billingMetrics.mrr_total);
    collector.gauge('billing_active_tenants', billingMetrics.active_tenants);
    collector.gauge('billing_active_subscriptions', billingMetrics.active_subscriptions);
    collector.gauge('billing_arr_total', billingMetrics.mrr_total * 12);
    collector.gauge('billing_invoice_errors', billingMetrics.invoice_errors);
    collector.gauge('billing_invoices_paid', billingMetrics.invoices_paid);
    collector.gauge('billing_invoices_pending', billingMetrics.invoices_pending);
    collector.gauge('billing_invoices_overdue', billingMetrics.invoices_overdue);

    // Per-plan usage: billing_plan_usage{plan="enterprise"} 12
    for (const entry of billingMetrics.plan_usage) {
      collector.gauge('billing_plan_usage', entry.count, { plan: entry.plan_name, tier: entry.tier });
    }
  } catch {
    // Billing metrics unavailable — skip
  }

  const metrics = collector.toPrometheus();
  const text = collector.toPrometheusText();

  return { text, metrics, timestamp: Date.now() };
}

// ═══════════════════════════════════════════════════════════════
// 2. LOKI — Structured Log Export
// ═══════════════════════════════════════════════════════════════

export interface LokiStream {
  stream: Record<string, string>;
  values: Array<[string, string]>; // [timestamp_ns, line]
}

export function exportLogsAsLoki(opts?: { since?: number; limit?: number }): LokiStream[] {
  const logs = getLogStreamAdapter().query({
    since: opts?.since,
    limit: opts?.limit ?? 200,
  });

  // Group by source+level
  const groups = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const key = `${log.source}|${log.level}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(log);
  }

  const streams: LokiStream[] = [];
  for (const [key, entries] of groups) {
    const [source, level] = key.split('|');
    streams.push({
      stream: { source, level, job: 'platform_observability' },
      values: entries.map(e => [
        `${e.timestamp}000000`, // convert ms to ns
        e.module_id ? `[${e.module_id}] ${e.message}` : e.message,
      ]),
    });
  }

  return streams;
}

// ═══════════════════════════════════════════════════════════════
// 3. TEMPO — Distributed Traces (Future-Ready)
//
// Implements W3C Trace Context compatible span model.
// In-memory ring buffer for local trace collection.
// Export format matches Tempo/OTLP JSON ingestion.
// ═══════════════════════════════════════════════════════════════

export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';
export type SpanStatus = 'ok' | 'error' | 'unset';

export interface TraceSpan {
  /** 32-hex-char trace identifier (W3C traceparent) */
  trace_id: string;
  /** 16-hex-char span identifier */
  span_id: string;
  /** Parent span (null for root spans) */
  parent_span_id: string | null;
  /** Human-readable operation name */
  operation: string;
  /** Service / module that owns this span */
  service: string;
  kind: SpanKind;
  status: SpanStatus;
  /** Start timestamp in ms */
  start_ms: number;
  /** End timestamp in ms (null if still active) */
  end_ms: number | null;
  /** Duration in ms (computed on end) */
  duration_ms: number;
  /** Structured attributes */
  attributes: Record<string, string | number | boolean>;
  /** Events / logs within the span */
  events: Array<{
    name: string;
    timestamp_ms: number;
    attributes?: Record<string, string | number | boolean>;
  }>;
}

/** Tempo-compatible JSON export format (OTLP-like) */
export interface TempoExportResult {
  resource: {
    service_name: string;
    service_version: string;
    environment: string;
  };
  spans: TraceSpan[];
  total_traces: number;
  exported_at: number;
}

// ── Trace ID Generation (W3C Trace Context) ───────────────────

function generateHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function generateTraceId(): string {
  return generateHex(16); // 32 hex chars
}

function generateSpanId(): string {
  return generateHex(8); // 16 hex chars
}

// ── TraceCollector — In-Memory Span Ring Buffer ───────────────

const MAX_SPANS = 500;

class TraceCollector {
  private spans: TraceSpan[] = [];
  private activeSpans = new Map<string, TraceSpan>();

  /**
   * Start a new span. Returns span_id for later ending.
   *
   * Usage:
   *   const spanId = collector.startSpan({ operation: 'db.query', service: 'iam' });
   *   // ... work ...
   *   collector.endSpan(spanId);
   */
  startSpan(opts: {
    operation: string;
    service: string;
    trace_id?: string;
    parent_span_id?: string | null;
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  }): string {
    const span: TraceSpan = {
      trace_id: opts.trace_id ?? generateTraceId(),
      span_id: generateSpanId(),
      parent_span_id: opts.parent_span_id ?? null,
      operation: opts.operation,
      service: opts.service,
      kind: opts.kind ?? 'internal',
      status: 'unset',
      start_ms: Date.now(),
      end_ms: null,
      duration_ms: 0,
      attributes: opts.attributes ?? {},
      events: [],
    };

    this.activeSpans.set(span.span_id, span);
    return span.span_id;
  }

  /** Add an event/log to an active span. */
  addEvent(spanId: string, name: string, attributes?: Record<string, string | number | boolean>) {
    const span = this.activeSpans.get(spanId);
    if (!span) return;
    span.events.push({ name, timestamp_ms: Date.now(), attributes });
  }

  /** Set attributes on an active span. */
  setAttributes(spanId: string, attributes: Record<string, string | number | boolean>) {
    const span = this.activeSpans.get(spanId);
    if (!span) return;
    Object.assign(span.attributes, attributes);
  }

  /** End a span (moves from active → completed buffer). */
  endSpan(spanId: string, status: SpanStatus = 'ok') {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.end_ms = Date.now();
    span.duration_ms = span.end_ms - span.start_ms;
    span.status = status;

    this.activeSpans.delete(spanId);
    this.spans.push(span);

    // Trim oldest
    if (this.spans.length > MAX_SPANS) {
      this.spans.splice(0, this.spans.length - MAX_SPANS);
    }

    getMetricsCollector().increment('traces_completed', { service: span.service });
    getMetricsCollector().histogram('trace_duration_ms', span.duration_ms, { service: span.service });
  }

  /** Query completed spans. */
  query(opts?: {
    trace_id?: string;
    service?: string;
    operation?: string;
    status?: SpanStatus;
    since?: number;
    limit?: number;
  }): TraceSpan[] {
    let result = [...this.spans];
    if (opts?.trace_id) result = result.filter(s => s.trace_id === opts.trace_id);
    if (opts?.service) result = result.filter(s => s.service === opts.service);
    if (opts?.operation) result = result.filter(s => s.operation.includes(opts.operation));
    if (opts?.status) result = result.filter(s => s.status === opts.status);
    if (opts?.since) result = result.filter(s => s.start_ms >= opts.since);
    result.sort((a, b) => b.start_ms - a.start_ms);
    if (opts?.limit) result = result.slice(0, opts.limit);
    return result;
  }

  /** Get trace by trace_id (all spans in the trace). */
  getTrace(traceId: string): TraceSpan[] {
    return this.spans
      .filter(s => s.trace_id === traceId)
      .sort((a, b) => a.start_ms - b.start_ms);
  }

  /** Get statistics. */
  getStats(windowMs = 3_600_000) {
    const since = Date.now() - windowMs;
    const recent = this.spans.filter(s => s.start_ms >= since);
    const totalDuration = recent.reduce((sum, s) => sum + s.duration_ms, 0);

    const byService: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const s of recent) {
      byService[s.service] = (byService[s.service] ?? 0) + 1;
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    }

    return {
      total: recent.length,
      active: this.activeSpans.size,
      avg_duration_ms: recent.length > 0 ? Math.round(totalDuration / recent.length) : 0,
      by_service: byService,
      by_status: byStatus,
      error_rate: recent.length > 0
        ? Math.round(((byStatus['error'] ?? 0) / recent.length) * 100)
        : 0,
    };
  }

  /** Export in Tempo/OTLP-compatible format. */
  exportTempo(opts?: { since?: number; limit?: number }): TempoExportResult {
    const spans = this.query({ since: opts?.since, limit: opts?.limit ?? 200 });
    return {
      resource: {
        service_name: 'platform_observability',
        service_version: '1.0.0',
        environment: 'production',
      },
      spans,
      total_traces: new Set(spans.map(s => s.trace_id)).size,
      exported_at: Date.now(),
    };
  }

  /** Clear all spans. */
  clear() {
    this.spans = [];
    this.activeSpans.clear();
  }
}

let _traceCollector: TraceCollector | null = null;
export function getTraceCollector(): TraceCollector {
  if (!_traceCollector) _traceCollector = new TraceCollector();
  return _traceCollector;
}

export { TraceCollector };

// ═══════════════════════════════════════════════════════════════
// 4. GRAFANA DASHBOARD MODEL — Auto-generated panel definitions
// ═══════════════════════════════════════════════════════════════

export interface GrafanaDashboardPanel {
  title: string;
  type: 'graph' | 'gauge' | 'stat' | 'table' | 'logs' | 'traces';
  metric: string;
  description: string;
  datasource: 'prometheus' | 'loki' | 'tempo';
}

export function generateDashboardModel(): {
  title: string;
  datasources: Array<{ name: string; type: string; url_hint: string }>;
  panels: GrafanaDashboardPanel[];
  exported_at: number;
} {
  return {
    title: 'Platform Observability',
    exported_at: Date.now(),
    datasources: [
      { name: 'Prometheus', type: 'prometheus', url_hint: '/api/v1/metrics' },
      { name: 'Loki', type: 'loki', url_hint: '/api/v1/logs' },
      { name: 'Tempo', type: 'tempo', url_hint: '/api/v1/traces' },
    ],
    panels: [
      // ── Prometheus panels ──────────────────────────────────
      { title: 'Platform Health', type: 'gauge', metric: 'platform_health_status', description: 'Overall platform health (1=healthy, 0.5=degraded, 0=down)', datasource: 'prometheus' },
      { title: 'Modules Status', type: 'stat', metric: 'platform_modules_total', description: 'Total registered modules', datasource: 'prometheus' },
      { title: 'Healthy Modules', type: 'stat', metric: 'platform_modules_healthy', description: 'Modules in healthy state', datasource: 'prometheus' },
      { title: 'Error Rate', type: 'graph', metric: 'error_rate_per_min', description: 'Errors per minute (rolling)', datasource: 'prometheus' },
      { title: 'Errors 1h', type: 'stat', metric: 'errors_1h_total', description: 'Total errors in last hour', datasource: 'prometheus' },
      { title: 'Page Load Time', type: 'graph', metric: 'perf_page_load_ms', description: 'Page load time in milliseconds', datasource: 'prometheus' },
      { title: 'TTFB', type: 'graph', metric: 'perf_ttfb_ms', description: 'Time to first byte', datasource: 'prometheus' },
      { title: 'Memory Usage', type: 'gauge', metric: 'perf_memory_used_mb', description: 'JS heap memory in MB', datasource: 'prometheus' },
      { title: 'DOM Nodes', type: 'stat', metric: 'perf_dom_nodes', description: 'Total DOM node count', datasource: 'prometheus' },
      { title: 'Module Latency', type: 'graph', metric: 'module_latency_ms', description: 'Per-module latency histogram', datasource: 'prometheus' },
      { title: 'Security Events', type: 'graph', metric: 'security_events_total', description: 'Security events by type', datasource: 'prometheus' },
      { title: 'Traces Total', type: 'stat', metric: 'traces_total', description: 'Total completed traces in window', datasource: 'prometheus' },
      { title: 'Trace Avg Duration', type: 'gauge', metric: 'traces_avg_duration_ms', description: 'Average trace duration', datasource: 'prometheus' },
      // ── Self-Healing panels ────────────────────────────────
      { title: 'Healing Actions Total', type: 'stat', metric: 'self_healing_actions_total', description: 'Total recovery actions by type', datasource: 'prometheus' },
      { title: 'Circuit Breaker State', type: 'gauge', metric: 'module_circuit_state', description: 'Per-module circuit state (0=closed, 0.5=half_open, 1=open)', datasource: 'prometheus' },
      { title: 'Incidents Detected', type: 'stat', metric: 'incident_detected_total', description: 'Total incidents detected', datasource: 'prometheus' },
      { title: 'Auto-Recovery Rate', type: 'gauge', metric: 'auto_recovery_success_rate', description: 'Percentage of auto-recovered incidents', datasource: 'prometheus' },
      { title: 'Active Incidents', type: 'stat', metric: 'self_healing_active_incidents', description: 'Currently active incidents', datasource: 'prometheus' },
      { title: 'Avg Recovery Time', type: 'gauge', metric: 'self_healing_avg_recovery_ms', description: 'Average time to auto-recover (ms)', datasource: 'prometheus' },
      // ── Billing panels ────────────────────────────────────────
      { title: 'MRR Total (BRL)', type: 'stat', metric: 'billing_mrr_total', description: 'Monthly Recurring Revenue (BRL)', datasource: 'prometheus' },
      { title: 'Active Tenants', type: 'stat', metric: 'billing_active_tenants', description: 'Unique tenants with active subscriptions', datasource: 'prometheus' },
      { title: 'Plan Usage', type: 'graph', metric: 'billing_plan_usage', description: 'Subscriptions per plan tier (label: plan)', datasource: 'prometheus' },
      { title: 'Active Subscriptions', type: 'stat', metric: 'billing_active_subscriptions', description: 'Total active billing subscriptions', datasource: 'prometheus' },
      { title: 'ARR Total', type: 'stat', metric: 'billing_arr_total', description: 'Annual Recurring Revenue (BRL)', datasource: 'prometheus' },
      { title: 'Invoice Errors', type: 'stat', metric: 'billing_invoice_errors', description: 'Failed/overdue invoices count', datasource: 'prometheus' },
      { title: 'Invoices Paid', type: 'stat', metric: 'billing_invoices_paid', description: 'Total paid invoices', datasource: 'prometheus' },
      { title: 'Invoices Pending', type: 'stat', metric: 'billing_invoices_pending', description: 'Pending invoices awaiting payment', datasource: 'prometheus' },
      { title: 'Invoices Overdue', type: 'stat', metric: 'billing_invoices_overdue', description: 'Overdue invoices', datasource: 'prometheus' },
      // ── Growth / Landing Page panels ──────────────────────────
      { title: 'LP Views Total', type: 'graph', metric: 'landing_page_views_total', description: 'Total landing page views by page (label: page)', datasource: 'prometheus' },
      { title: 'LP Conversions', type: 'graph', metric: 'landing_conversion_total', description: 'Conversions by page and type (labels: page, type)', datasource: 'prometheus' },
      { title: 'FAB CTA Clicks', type: 'graph', metric: 'fab_cta_click_total', description: 'CTA clicks per page/section (labels: page, section)', datasource: 'prometheus' },
      { title: 'Revenue by LP', type: 'stat', metric: 'revenue_by_landing', description: 'Revenue attributed to each landing page (label: page)', datasource: 'prometheus' },
      // ── Loki panels ────────────────────────────────────────
      { title: 'Log Stream', type: 'logs', metric: 'logs_total', description: 'Structured log stream from all sources', datasource: 'loki' },
      // ── Tempo panels ───────────────────────────────────────
      { title: 'Trace Explorer', type: 'traces', metric: 'trace_duration_ms', description: 'Distributed trace waterfall (W3C Trace Context)', datasource: 'tempo' },
    ],
  };
}
