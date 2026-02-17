/**
 * MetricsCollector — Central metrics store with Prometheus-compatible export.
 *
 * Collects counters, gauges, and histograms from all platform subsystems.
 */

import type { MetricPoint, MetricType, MetricSeries, PrometheusMetric } from './types';

const MAX_POINTS = 1000;

class MetricsCollector {
  private points: MetricPoint[] = [];
  private counters = new Map<string, { value: number; labels: Record<string, string> }>();
  private gauges = new Map<string, { value: number; labels: Record<string, string> }>();

  // ── Record ──────────────────────────────────────────────────

  increment(name: string, labels: Record<string, string> = {}, delta = 1) {
    const key = this.key(name, labels);
    const existing = this.counters.get(key);
    const value = (existing?.value ?? 0) + delta;
    this.counters.set(key, { value, labels });
    this.push({ name, type: 'counter', value, labels, timestamp: Date.now() });
  }

  gauge(name: string, value: number, labels: Record<string, string> = {}) {
    const key = this.key(name, labels);
    this.gauges.set(key, { value, labels });
    this.push({ name, type: 'gauge', value, labels, timestamp: Date.now() });
  }

  histogram(name: string, value: number, labels: Record<string, string> = {}) {
    this.push({ name, type: 'histogram', value, labels, timestamp: Date.now() });
  }

  // ── Query ───────────────────────────────────────────────────

  getPoints(name?: string, since?: number): MetricPoint[] {
    let result = this.points;
    if (name) result = result.filter(p => p.name === name);
    if (since) result = result.filter(p => p.timestamp >= since);
    return result;
  }

  getSeries(name: string, since?: number): MetricSeries {
    const pts = this.getPoints(name, since);
    const first = pts[0];
    return {
      name,
      type: first?.type ?? 'gauge',
      labels: first?.labels ?? {},
      points: pts.map(p => ({ value: p.value, timestamp: p.timestamp })),
    };
  }

  getLatest(name: string): MetricPoint | null {
    for (let i = this.points.length - 1; i >= 0; i--) {
      if (this.points[i].name === name) return this.points[i];
    }
    return null;
  }

  // ── Prometheus Export ───────────────────────────────────────

  toPrometheus(): PrometheusMetric[] {
    const grouped = new Map<string, PrometheusMetric>();

    // Export counters
    for (const [, entry] of this.counters) {
      const key = this.key('counter', entry.labels);
      if (!grouped.has(key)) {
        // Find the metric name from the key
      }
    }

    // Group all unique metric names
    const metricNames = new Set(this.points.map(p => p.name));
    const result: PrometheusMetric[] = [];

    for (const name of metricNames) {
      const latest = this.getLatest(name);
      if (!latest) continue;

      const promName = name.replace(/[.-]/g, '_');
      result.push({
        name: promName,
        help: `${name} metric`,
        type: latest.type,
        samples: [{ labels: latest.labels, value: latest.value, timestamp: latest.timestamp }],
      });
    }

    return result;
  }

  toPrometheusText(): string {
    const metrics = this.toPrometheus();
    const lines: string[] = [];

    for (const metric of metrics) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      for (const sample of metric.samples) {
        const labels = Object.entries(sample.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const labelStr = labels ? `{${labels}}` : '';
        lines.push(`${metric.name}${labelStr} ${sample.value}${sample.timestamp ? ` ${sample.timestamp}` : ''}`);
      }
    }

    return lines.join('\n');
  }

  clear() {
    this.points = [];
    this.counters.clear();
    this.gauges.clear();
  }

  // ── Internal ────────────────────────────────────────────────

  private push(point: MetricPoint) {
    this.points.push(point);
    if (this.points.length > MAX_POINTS) {
      this.points.splice(0, this.points.length - MAX_POINTS);
    }
  }

  private key(name: string, labels: Record<string, string>): string {
    const sortedLabels = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return `${name}|${sortedLabels.map(([k, v]) => `${k}=${v}`).join(',')}`;
  }
}

// Singleton
let _collector: MetricsCollector | null = null;
export function getMetricsCollector(): MetricsCollector {
  if (!_collector) _collector = new MetricsCollector();
  return _collector;
}

export { MetricsCollector };
