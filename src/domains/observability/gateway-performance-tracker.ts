/**
 * GatewayPerformanceTracker — Captures response time per Gateway call,
 * latency per module, and AccessGraph recomposition time.
 *
 * Provides histogram-style tracking with percentile computation.
 */

import { getMetricsCollector } from './metrics-collector';

const MAX_SAMPLES = 2000;

export interface LatencySample {
  /** e.g. 'iam', 'hr_core', 'payroll' */
  source: string;
  /** e.g. 'gateway_response', 'module_latency', 'access_graph_recomposition' */
  category: 'gateway_response' | 'module_latency' | 'access_graph_recomposition';
  duration_ms: number;
  /** Optional gateway action name */
  action?: string;
  timestamp: number;
}

class GatewayPerformanceTracker {
  private samples: LatencySample[] = [];
  private listeners = new Set<() => void>();

  // ── Record ──────────────────────────────────────────────────

  /** Track a Gateway response time */
  recordGatewayResponse(module: string, action: string, duration_ms: number) {
    this.push({
      source: module,
      category: 'gateway_response',
      action,
      duration_ms,
      timestamp: Date.now(),
    });
    getMetricsCollector().histogram('gateway_response_ms', duration_ms, { module, action });
  }

  /** Track module-level latency */
  recordModuleLatency(module: string, duration_ms: number) {
    this.push({
      source: module,
      category: 'module_latency',
      duration_ms,
      timestamp: Date.now(),
    });
    getMetricsCollector().histogram('module_latency_ms', duration_ms, { module });
  }

  /** Track AccessGraph recomposition time */
  recordAccessGraphRecomposition(duration_ms: number, metadata?: { nodes?: number; edges?: number }) {
    this.push({
      source: 'access_graph',
      category: 'access_graph_recomposition',
      duration_ms,
      timestamp: Date.now(),
    });
    getMetricsCollector().histogram('access_graph_recomposition_ms', duration_ms);
    if (metadata?.nodes) {
      getMetricsCollector().gauge('access_graph_nodes', metadata.nodes);
    }
    if (metadata?.edges) {
      getMetricsCollector().gauge('access_graph_edges', metadata.edges);
    }
  }

  /**
   * Wrap an async function and automatically record its duration.
   *
   * Usage:
   *   const result = await tracker.measure('iam', 'gateway_response', 'getUser', () => gateway.getUser(id));
   */
  async measure<T>(
    module: string,
    category: LatencySample['category'],
    action: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration_ms = Math.round(performance.now() - start);
      if (category === 'gateway_response') {
        this.recordGatewayResponse(module, action, duration_ms);
      } else if (category === 'module_latency') {
        this.recordModuleLatency(module, duration_ms);
      } else {
        this.recordAccessGraphRecomposition(duration_ms);
      }
    }
  }

  // ── Query ───────────────────────────────────────────────────

  getSamples(opts?: {
    category?: LatencySample['category'];
    source?: string;
    since?: number;
    limit?: number;
  }): LatencySample[] {
    let result = [...this.samples];
    if (opts?.category) result = result.filter(s => s.category === opts.category);
    if (opts?.source) result = result.filter(s => s.source === opts.source);
    if (opts?.since) result = result.filter(s => s.timestamp >= opts.since);
    result.sort((a, b) => b.timestamp - a.timestamp);
    if (opts?.limit) result = result.slice(0, opts.limit);
    return result;
  }

  /** Get percentile stats for a category within a time window */
  getStats(category: LatencySample['category'], windowMs = 3_600_000) {
    const since = Date.now() - windowMs;
    const samples = this.samples
      .filter(s => s.category === category && s.timestamp >= since)
      .map(s => s.duration_ms)
      .sort((a, b) => a - b);

    if (samples.length === 0) {
      return { count: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0 };
    }

    const sum = samples.reduce((a, b) => a + b, 0);
    return {
      count: samples.length,
      avg: Math.round(sum / samples.length),
      p50: samples[Math.floor(samples.length * 0.5)],
      p90: samples[Math.floor(samples.length * 0.9)],
      p95: samples[Math.floor(samples.length * 0.95)],
      p99: samples[Math.floor(samples.length * 0.99)],
      min: samples[0],
      max: samples[samples.length - 1],
    };
  }

  /** Per-module latency breakdown */
  getModuleBreakdown(windowMs = 3_600_000) {
    const since = Date.now() - windowMs;
    const recent = this.samples.filter(s => s.timestamp >= since);
    const byModule = new Map<string, number[]>();

    for (const s of recent) {
      if (!byModule.has(s.source)) byModule.set(s.source, []);
      byModule.get(s.source)!.push(s.duration_ms);
    }

    const result: Record<string, { count: number; avg: number; p95: number }> = {};
    for (const [mod, durations] of byModule) {
      durations.sort((a, b) => a - b);
      const sum = durations.reduce((a, b) => a + b, 0);
      result[mod] = {
        count: durations.length,
        avg: Math.round(sum / durations.length),
        p95: durations[Math.floor(durations.length * 0.95)],
      };
    }
    return result;
  }

  /** Summary for Prometheus export */
  getSummary(windowMs = 3_600_000) {
    return {
      gateway: this.getStats('gateway_response', windowMs),
      module: this.getStats('module_latency', windowMs),
      access_graph: this.getStats('access_graph_recomposition', windowMs),
      by_module: this.getModuleBreakdown(windowMs),
    };
  }

  clear() {
    this.samples = [];
    this.notify();
  }

  onUpdate(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ── Internal ────────────────────────────────────────────────

  private push(sample: LatencySample) {
    this.samples.push(sample);
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.splice(0, this.samples.length - MAX_SAMPLES);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }
}

let _tracker: GatewayPerformanceTracker | null = null;
export function getGatewayPerformanceTracker(): GatewayPerformanceTracker {
  if (!_tracker) _tracker = new GatewayPerformanceTracker();
  return _tracker;
}

export { GatewayPerformanceTracker };
