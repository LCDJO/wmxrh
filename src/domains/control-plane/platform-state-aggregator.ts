/**
 * PlatformStateAggregator — Collects state from all POSL sub-systems
 * into a single PlatformStateSnapshot for the Control Plane dashboard.
 */

import type { PlatformRuntimeAPI } from '@/domains/platform-os/types';
import type { PlatformStateSnapshot, PlatformHealthLevel, SubsystemHealth } from './types';
import { getHealthMonitor } from '@/domains/observability/health-monitor';
import { getErrorTracker } from '@/domains/observability/error-tracker';

const MAX_HISTORY = 60; // keep last 60 snapshots (≈ 1 per tick)

export class PlatformStateAggregator {
  private history: PlatformStateSnapshot[] = [];

  constructor(private runtime: PlatformRuntimeAPI) {}

  snapshot(): PlatformStateSnapshot {
    const status = this.runtime.status();
    const modules = this.runtime.modules.list();
    const activeModules = this.runtime.modules.listActive();
    const errorModules = modules.filter(m => m.status === 'error');
    const features = this.runtime.features.list();
    const activeFeatures = features.filter(f => f.enabled);
    const healthMonitor = getHealthMonitor();
    const errorTracker = getErrorTracker();

    const identity = this.runtime.identity.snapshot();

    // Build subsystem health from runtime health checks
    const subsystemHealth: SubsystemHealth[] = status.health.checks.map(c => ({
      name: c.name,
      status: c.status,
      message: c.message,
      last_check: c.checked_at,
    }));

    // Determine overall health
    let health: PlatformHealthLevel = 'healthy';
    if (status.phase === 'degraded' || errorModules.length > 0) health = 'degraded';
    if (status.health.overall === 'unhealthy') health = 'critical';
    if (status.phase === 'idle') health = 'unknown';

    // Error count approximation
    const errors = errorTracker.getErrors();
    const oneHourAgo = Date.now() - 3600000;
    const recentErrors = errors.filter(e => e.first_seen > oneHourAgo).reduce((sum, e) => sum + e.count, 0);

    // Count open circuit breakers (via modules with 'error' + circuit info in services)
    const openCircuits = errorModules.length; // approximation

    // Risk from identity
    const riskScore = identity.risk_score ?? 0;
    const riskLevel = riskScore > 75 ? 'critical' : riskScore > 50 ? 'high' : riskScore > 25 ? 'medium' : 'low';

    const snap: PlatformStateSnapshot = {
      timestamp: Date.now(),
      health,
      runtime_phase: status.phase,
      uptime_ms: status.uptime_ms,
      total_services: status.registered_services,
      total_modules: modules.length,
      active_modules: activeModules.length,
      error_modules: errorModules.length,
      total_features: features.length,
      active_features: activeFeatures.length,
      total_errors_last_hour: recentErrors,
      active_incidents: 0, // will be enriched by SelfHealing bridge
      open_circuit_breakers: openCircuits,
      active_sessions_estimate: identity.is_authenticated ? 1 : 0,
      active_impersonations: identity.is_impersonating ? 1 : 0,
      overall_risk_score: riskScore,
      risk_level: riskLevel,
      subsystem_health: subsystemHealth,
    };

    this.history.push(snap);
    if (this.history.length > MAX_HISTORY) this.history.shift();

    return snap;
  }

  getHistory(limit = 30): PlatformStateSnapshot[] {
    return this.history.slice(-limit);
  }

  /** Patch the latest snapshot with extra data (e.g. incident count from SelfHealing) */
  patchLatest(patch: Partial<PlatformStateSnapshot>): void {
    if (this.history.length > 0) {
      Object.assign(this.history[this.history.length - 1], patch);
    }
  }
}
