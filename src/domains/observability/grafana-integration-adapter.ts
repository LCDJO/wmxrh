/**
 * GrafanaIntegrationAdapter — Formats metrics and logs for Grafana-compatible
 * consumption via Prometheus text format and Loki-style log export.
 *
 * Provides:
 *  1. Prometheus /metrics text export
 *  2. Loki-compatible log label+stream format
 *  3. Dashboard JSON model generation for import into Grafana
 */

import { getMetricsCollector } from './metrics-collector';
import { getHealthMonitor } from './health-monitor';
import { getErrorTracker } from './error-tracker';
import { getPerformanceProfiler } from './performance-profiler';
import { getLogStreamAdapter, type LogEntry } from './log-stream-adapter';
import type { PrometheusMetric } from './types';

// ── Prometheus Export ──────────────────────────────────────────

export interface PrometheusExportResult {
  text: string;
  metrics: PrometheusMetric[];
  timestamp: number;
}

export function exportPrometheus(): PrometheusExportResult {
  const collector = getMetricsCollector();

  // Inject platform health as gauges
  const health = getHealthMonitor().getSummary();
  collector.gauge('platform_health_status', health.overall === 'healthy' ? 1 : health.overall === 'degraded' ? 0.5 : 0);
  collector.gauge('platform_modules_total', health.total_modules);
  collector.gauge('platform_modules_healthy', health.healthy_count);
  collector.gauge('platform_modules_degraded', health.degraded_count);
  collector.gauge('platform_modules_down', health.down_count);

  // Inject error stats
  const errors = getErrorTracker().getSummary();
  collector.gauge('errors_1h_total', errors.total_errors_1h);
  collector.gauge('errors_24h_total', errors.total_errors_24h);
  collector.gauge('error_rate_per_min', errors.error_rate_per_min);

  // Inject perf stats
  const perf = getPerformanceProfiler().getSummary();
  if (perf.current) {
    collector.gauge('perf_page_load_ms', perf.current.page_load_ms);
    collector.gauge('perf_ttfb_ms', perf.current.ttfb_ms);
    collector.gauge('perf_fcp_ms', perf.current.fcp_ms);
    collector.gauge('perf_memory_used_mb', perf.current.memory_used_mb);
    collector.gauge('perf_dom_nodes', perf.current.dom_nodes);
  }

  const metrics = collector.toPrometheus();
  const text = collector.toPrometheusText();

  return { text, metrics, timestamp: Date.now() };
}

// ── Loki-Style Log Export ──────────────────────────────────────

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

// ── Grafana Dashboard Model ────────────────────────────────────

export interface GrafanaDashboardPanel {
  title: string;
  type: 'graph' | 'gauge' | 'stat' | 'table' | 'logs';
  metric: string;
  description: string;
}

export function generateDashboardModel(): {
  title: string;
  panels: GrafanaDashboardPanel[];
  exported_at: number;
} {
  return {
    title: 'Platform Observability',
    exported_at: Date.now(),
    panels: [
      { title: 'Platform Health', type: 'gauge', metric: 'platform_health_status', description: 'Overall platform health (1=healthy, 0.5=degraded, 0=down)' },
      { title: 'Modules Status', type: 'stat', metric: 'platform_modules_total', description: 'Total registered modules' },
      { title: 'Healthy Modules', type: 'stat', metric: 'platform_modules_healthy', description: 'Modules in healthy state' },
      { title: 'Error Rate', type: 'graph', metric: 'error_rate_per_min', description: 'Errors per minute (rolling)' },
      { title: 'Errors 1h', type: 'stat', metric: 'errors_1h_total', description: 'Total errors in last hour' },
      { title: 'Page Load Time', type: 'graph', metric: 'perf_page_load_ms', description: 'Page load time in milliseconds' },
      { title: 'TTFB', type: 'graph', metric: 'perf_ttfb_ms', description: 'Time to first byte' },
      { title: 'Memory Usage', type: 'gauge', metric: 'perf_memory_used_mb', description: 'JS heap memory in MB' },
      { title: 'DOM Nodes', type: 'stat', metric: 'perf_dom_nodes', description: 'Total DOM node count' },
      { title: 'Module Latency', type: 'graph', metric: 'module_latency_ms', description: 'Per-module latency histogram' },
      { title: 'Security Events', type: 'graph', metric: 'security_events_total', description: 'Security events by type' },
      { title: 'Log Stream', type: 'logs', metric: 'logs_total', description: 'Structured log stream from all sources' },
    ],
  };
}
