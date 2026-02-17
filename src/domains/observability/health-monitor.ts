/**
 * HealthMonitor — Tracks module health, uptime, and heartbeats.
 *
 * Integrates with Module Federation via PlatformOS module orchestrator.
 * Emits canonical events through GlobalEventKernel when module health changes.
 */

import type { ModuleHealthReport, PlatformHealthSummary, HealthStatus } from './types';
import { getMetricsCollector } from './metrics-collector';
import { OBSERVABILITY_KERNEL_EVENTS, type ModuleHealthChangedPayload } from './observability-events';
import type { GlobalEventKernelAPI } from '@/domains/platform-os/types';

interface ModuleHeartbeat {
  module_id: string;
  module_label: string;
  registered_at: number;
  last_heartbeat: number;
  error_timestamps: number[];
  latency_samples: number[];
  status: HealthStatus;
}

const HEARTBEAT_STALE_MS = 60_000; // 1 min without heartbeat → degraded
const HEARTBEAT_DOWN_MS = 180_000; // 3 min → down
const ERROR_WINDOW_MS = 3_600_000; // 1 hour for error counting

class HealthMonitor {
  private modules = new Map<string, ModuleHeartbeat>();
  private listeners = new Set<() => void>();
  private eventKernel: GlobalEventKernelAPI | null = null;

  /** Bind to GlobalEventKernel for emitting canonical events */
  setEventKernel(kernel: GlobalEventKernelAPI) {
    this.eventKernel = kernel;
  }

  registerModule(moduleId: string, label: string) {
    if (this.modules.has(moduleId)) return;
    this.modules.set(moduleId, {
      module_id: moduleId,
      module_label: label,
      registered_at: Date.now(),
      last_heartbeat: Date.now(),
      error_timestamps: [],
      latency_samples: [],
      status: 'healthy',
    });
    getMetricsCollector().gauge('module.registered', 1, { module: moduleId });
  }

  heartbeat(moduleId: string, latencyMs?: number) {
    const mod = this.modules.get(moduleId);
    if (!mod) return;
    mod.last_heartbeat = Date.now();
    if (latencyMs != null) {
      mod.latency_samples.push(latencyMs);
      if (mod.latency_samples.length > 100) mod.latency_samples.splice(0, 50);
      getMetricsCollector().histogram('module.latency_ms', latencyMs, { module: moduleId });
    }
    this.refreshStatus(mod);
  }

  recordError(moduleId: string) {
    const mod = this.modules.get(moduleId);
    if (!mod) return;
    mod.error_timestamps.push(Date.now());
    getMetricsCollector().increment('module.errors_total', { module: moduleId });
    this.refreshStatus(mod);
    this.notify();
  }

  setStatus(moduleId: string, status: HealthStatus) {
    const mod = this.modules.get(moduleId);
    if (!mod) return;
    mod.status = status;
    getMetricsCollector().gauge('module.status', status === 'healthy' ? 1 : status === 'degraded' ? 0.5 : 0, { module: moduleId });
    this.notify();
  }

  getReport(moduleId: string): ModuleHealthReport | null {
    const mod = this.modules.get(moduleId);
    if (!mod) return null;
    this.refreshStatus(mod);
    return this.toReport(mod);
  }

  getSummary(): PlatformHealthSummary {
    const now = Date.now();
    const reports: ModuleHealthReport[] = [];

    for (const mod of this.modules.values()) {
      this.refreshStatus(mod);
      reports.push(this.toReport(mod));
    }

    const healthy = reports.filter(r => r.status === 'healthy').length;
    const degraded = reports.filter(r => r.status === 'degraded').length;
    const down = reports.filter(r => r.status === 'down').length;

    let overall: HealthStatus = 'healthy';
    if (down > 0) overall = 'down';
    else if (degraded > 0) overall = 'degraded';

    return {
      overall,
      modules: reports,
      total_modules: reports.length,
      healthy_count: healthy,
      degraded_count: degraded,
      down_count: down,
      checked_at: now,
    };
  }

  onUpdate(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  private refreshStatus(mod: ModuleHeartbeat) {
    const now = Date.now();
    const elapsed = now - mod.last_heartbeat;
    const previousStatus = mod.status;

    // Prune old errors
    mod.error_timestamps = mod.error_timestamps.filter(t => now - t < ERROR_WINDOW_MS);

    const errorRate = mod.error_timestamps.length;

    if (elapsed > HEARTBEAT_DOWN_MS) {
      mod.status = 'down';
    } else if (elapsed > HEARTBEAT_STALE_MS || errorRate > 10) {
      mod.status = 'degraded';
    } else {
      mod.status = 'healthy';
    }

    // Emit canonical event on status change
    if (previousStatus !== mod.status && this.eventKernel) {
      const report = this.toReport(mod);
      this.eventKernel.emit<ModuleHealthChangedPayload>(
        OBSERVABILITY_KERNEL_EVENTS.ModuleHealthChanged,
        'HealthMonitor',
        {
          module_id: mod.module_id,
          module_label: mod.module_label,
          previous_status: previousStatus,
          current_status: mod.status,
          error_count_1h: report.error_count_1h,
          latency_ms: report.latency_ms,
        },
        { priority: mod.status === 'down' ? 'critical' : 'high' },
      );
    }
  }

  private toReport(mod: ModuleHeartbeat): ModuleHealthReport {
    const now = Date.now();
    const recentErrors = mod.error_timestamps.filter(t => now - t < ERROR_WINDOW_MS);
    const avgLatency = mod.latency_samples.length > 0
      ? mod.latency_samples.reduce((a, b) => a + b, 0) / mod.latency_samples.length
      : 0;

    return {
      module_id: mod.module_id,
      module_label: mod.module_label,
      status: mod.status,
      uptime_ms: now - mod.registered_at,
      last_heartbeat: mod.last_heartbeat,
      latency_ms: Math.round(avgLatency),
      error_count_1h: recentErrors.length,
      error_rate_pct: 0,
    };
  }
}

let _monitor: HealthMonitor | null = null;
export function getHealthMonitor(): HealthMonitor {
  if (!_monitor) _monitor = new HealthMonitor();
  return _monitor;
}

export { HealthMonitor };
