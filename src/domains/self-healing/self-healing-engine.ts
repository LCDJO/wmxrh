/**
 * SelfHealingEngine — Main orchestrator integrating all sub-systems.
 *
 * Integrations:
 *  - GlobalEventKernel (health/error events)
 *  - HealthMonitor (module health)
 *  - ErrorTracker (error spikes)
 *  - ModuleOrchestrator (restart/deactivate)
 *  - GovernanceAI (risk correlation)
 */

import type { GlobalEventKernelAPI, ModuleOrchestratorAPI } from '@/domains/platform-os/types';
import type { HealthSignal, Incident, SelfHealingState, SelfHealingStats, HealthSignalType } from './types';
import { IncidentDetector } from './incident-detector';
import { RecoveryOrchestrator } from './recovery-orchestrator';
import { CircuitBreakerManager } from './circuit-breaker-manager';
import { HealingAuditLogger } from './healing-audit-logger';
import { getHealthMonitor } from '@/domains/observability/health-monitor';
import { getErrorTracker } from '@/domains/observability/error-tracker';

const MAX_RESOLVED = 100;
let _signalCounter = 0;

export class SelfHealingEngine {
  private enabled = true;
  private activeIncidents: Incident[] = [];
  private resolvedIncidents: Incident[] = [];
  private disposers: Array<() => void> = [];

  readonly circuitBreakers = new CircuitBreakerManager();
  readonly auditLogger = new HealingAuditLogger();
  readonly incidentDetector = new IncidentDetector();
  readonly recoveryOrchestrator: RecoveryOrchestrator;

  private listeners = new Set<() => void>();

  constructor(
    private events: GlobalEventKernelAPI,
    private modules: ModuleOrchestratorAPI,
  ) {
    this.recoveryOrchestrator = new RecoveryOrchestrator(
      this.circuitBreakers, this.auditLogger, events, modules,
    );
  }

  /** Start listening to platform events. */
  start(): void {
    if (this.disposers.length > 0) return; // already started

    // Listen to HealthMonitor changes
    this.disposers.push(
      getHealthMonitor().onUpdate(() => {
        if (!this.enabled) return;
        const summary = getHealthMonitor().getSummary();
        for (const mod of summary.modules) {
          if (mod.status === 'down') {
            this.ingestSignal('module_down', mod.module_id, { error_count: mod.error_count_1h });
          } else if (mod.status === 'degraded') {
            this.ingestSignal('module_degraded', mod.module_id, { error_count: mod.error_count_1h });
          }
        }
      }),
    );

    // Listen to ErrorTracker for spikes
    this.disposers.push(
      getErrorTracker().onUpdate(() => {
        if (!this.enabled) return;
        const summary = getErrorTracker().getSummary();
        if (summary.error_rate_per_min > 5) {
          // Find top module
          const topModule = Object.entries(summary.by_module)
            .sort(([,a], [,b]) => b - a)[0];
          if (topModule) {
            this.ingestSignal('error_spike', topModule[0], { rate: summary.error_rate_per_min });
          }
        }
      }),
    );

    // Listen to relevant kernel events
    this.disposers.push(
      this.events.on('platform:module_error', (evt) => {
        const p = evt.payload as any;
        this.ingestSignal('module_down', p?.key ?? 'unknown', p);
      }),
    );

    // Circuit breaker tick every 10s
    const tickInterval = setInterval(() => {
      for (const cb of this.circuitBreakers.listAll()) {
        const prev = cb.state;
        this.circuitBreakers.tick(cb.module_id);
        if (prev === 'open' && cb.state === 'half_open') {
          // Attempt module restart
          this.modules.activate(cb.module_id).then(() => {
            this.circuitBreakers.recordSuccess(cb.module_id);
          }).catch(() => {
            this.circuitBreakers.recordFailure(cb.module_id);
          });
        }
      }
    }, 10_000);
    this.disposers.push(() => clearInterval(tickInterval));

    this.events.emit('self_healing:started', 'SelfHealingEngine', {}, { priority: 'normal' });
  }

  stop(): void {
    this.disposers.forEach(fn => fn());
    this.disposers = [];
    this.events.emit('self_healing:stopped', 'SelfHealingEngine', {});
  }

  /** Ingest a health signal and trigger incident detection + recovery. */
  ingestSignal(type: HealthSignalType, sourceModule: string, metadata: Record<string, unknown> = {}): void {
    if (!this.enabled) return;

    const signal: HealthSignal = {
      id: `hs_${++_signalCounter}_${Date.now()}`,
      type,
      source_module: sourceModule,
      severity: type === 'module_down' || type === 'auth_failure_burst' ? 'critical' : 'warning',
      detected_at: Date.now(),
      metadata,
    };

    this.events.emit('self_healing:signal', 'SelfHealingEngine', signal);

    const incident = this.incidentDetector.ingest(signal);
    if (incident) {
      this.activeIncidents.push(incident);
      this.events.emit('self_healing:incident_detected', 'SelfHealingEngine', {
        id: incident.id, title: incident.title, severity: incident.severity,
      }, { priority: 'critical' });
      this.notify();

      // Auto-recover async
      this.recoveryOrchestrator.recover(incident).then(() => {
        // Move to resolved
        this.activeIncidents = this.activeIncidents.filter(i => i.id !== incident.id);
        this.resolvedIncidents.push(incident);
        if (this.resolvedIncidents.length > MAX_RESOLVED) {
          this.resolvedIncidents.splice(0, this.resolvedIncidents.length - MAX_RESOLVED);
        }
        this.incidentDetector.clearIncidentKey(`${signal.type}:${sourceModule}`);
        this.notify();
      });
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.events.emit('self_healing:toggle', 'SelfHealingEngine', { enabled });
  }

  getState(): SelfHealingState {
    return {
      enabled: this.enabled,
      active_incidents: [...this.activeIncidents],
      resolved_incidents: [...this.resolvedIncidents],
      circuit_breakers: this.circuitBreakers.listAll(),
      audit_log: this.auditLogger.getAll(),
      stats: this.getStats(),
    };
  }

  getStats(): SelfHealingStats {
    const all = [...this.activeIncidents, ...this.resolvedIncidents];
    const recovered = all.filter(i => i.auto_recovered);
    const durations = recovered
      .filter(i => i.resolved_at)
      .map(i => i.resolved_at! - i.detected_at);

    return {
      total_incidents: all.length,
      auto_recovered: recovered.length,
      escalated: all.filter(i => i.status === 'escalated').length,
      failed_recoveries: all.filter(i => i.status === 'failed').length,
      avg_recovery_time_ms: durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
      uptime_pct: all.length > 0
        ? Math.round((recovered.length / all.length) * 10000) / 100
        : 100,
    };
  }

  onUpdate(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }
}

// ── Singleton ───────────────────────────────────────────────────

let _engine: SelfHealingEngine | null = null;

export function getSelfHealingEngine(
  events?: GlobalEventKernelAPI,
  modules?: ModuleOrchestratorAPI,
): SelfHealingEngine {
  if (!_engine) {
    if (!events || !modules) {
      throw new Error('[SelfHealingEngine] Must provide events + modules on first call');
    }
    _engine = new SelfHealingEngine(events, modules);
  }
  return _engine;
}

/** Reset (testing only) */
export function resetSelfHealingEngine(): void {
  _engine?.stop();
  _engine = null;
}
