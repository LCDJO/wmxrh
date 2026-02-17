/**
 * PerformanceProfiler — Collects Web Vitals and runtime metrics.
 */

import type { PerformanceMetrics, PerformanceSummary } from './types';
import { getMetricsCollector } from './metrics-collector';

const MAX_HISTORY = 60;

class PerformanceProfiler {
  private history: PerformanceMetrics[] = [];

  collect(): PerformanceMetrics {
    const now = Date.now();
    const metrics = getMetricsCollector();

    const perf: PerformanceMetrics = {
      page_load_ms: 0,
      ttfb_ms: 0,
      fcp_ms: 0,
      lcp_ms: 0,
      cls: 0,
      fid_ms: 0,
      memory_used_mb: 0,
      memory_total_mb: 0,
      dom_nodes: 0,
      js_heap_mb: 0,
      timestamp: now,
    };

    // Navigation timing
    if (typeof window !== 'undefined' && window.performance) {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (nav) {
        perf.page_load_ms = Math.round(nav.loadEventEnd - nav.startTime);
        perf.ttfb_ms = Math.round(nav.responseStart - nav.requestStart);
      }

      // Paint timing
      const paintEntries = performance.getEntriesByType('paint');
      const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');
      if (fcp) perf.fcp_ms = Math.round(fcp.startTime);

      // Memory
      const mem = (performance as any).memory;
      if (mem) {
        perf.memory_used_mb = Math.round(mem.usedJSHeapSize / 1048576);
        perf.memory_total_mb = Math.round(mem.totalJSHeapSize / 1048576);
        perf.js_heap_mb = Math.round(mem.usedJSHeapSize / 1048576);
      }

      // DOM nodes
      perf.dom_nodes = document.querySelectorAll('*').length;
    }

    // Store
    this.history.push(perf);
    if (this.history.length > MAX_HISTORY) this.history.splice(0, this.history.length - MAX_HISTORY);

    // Publish metrics
    metrics.gauge('perf.page_load_ms', perf.page_load_ms);
    metrics.gauge('perf.ttfb_ms', perf.ttfb_ms);
    metrics.gauge('perf.fcp_ms', perf.fcp_ms);
    metrics.gauge('perf.memory_used_mb', perf.memory_used_mb);
    metrics.gauge('perf.dom_nodes', perf.dom_nodes);

    return perf;
  }

  getSummary(): PerformanceSummary {
    const loads = this.history.map(h => h.page_load_ms).filter(v => v > 0);
    const ttfbs = this.history.map(h => h.ttfb_ms).filter(v => v > 0);

    return {
      avg_page_load_ms: loads.length ? Math.round(loads.reduce((a, b) => a + b, 0) / loads.length) : 0,
      p95_page_load_ms: loads.length ? loads.sort((a, b) => a - b)[Math.floor(loads.length * 0.95)] ?? 0 : 0,
      avg_ttfb_ms: ttfbs.length ? Math.round(ttfbs.reduce((a, b) => a + b, 0) / ttfbs.length) : 0,
      current: this.history[this.history.length - 1] ?? null,
      history: [...this.history],
    };
  }
}

let _profiler: PerformanceProfiler | null = null;
export function getPerformanceProfiler(): PerformanceProfiler {
  if (!_profiler) _profiler = new PerformanceProfiler();
  return _profiler;
}

export { PerformanceProfiler };
