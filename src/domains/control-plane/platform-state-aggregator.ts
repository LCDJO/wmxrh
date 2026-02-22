/**
 * PlatformStateAggregator — Collects state from ALL 5 platform sub-systems
 * into a single PlatformStateSnapshot for the Control Plane dashboard.
 *
 * Data Sources:
 *  1. ObservabilityCore  → HealthMonitor, ErrorTracker, MetricsCollector
 *  2. GovernanceAI       → GovernanceAIService (heuristic insights)
 *  3. SelfHealingEngine  → incidents, circuit breakers, recovery stats
 *  4. UnifiedGraphEngine → graph nodes/edges, risk signals, domains
 *  5. ModuleOrchestrator → modules, features, dependencies (via POSL)
 */

import type { PlatformRuntimeAPI } from '@/domains/platform-os/types';
import type { PlatformStateSnapshot, PlatformHealthLevel, SubsystemHealth } from './types';
import { getHealthMonitor } from '@/domains/observability/health-monitor';
import { getErrorTracker } from '@/domains/observability/error-tracker';
import { getMetricsCollector } from '@/domains/observability/metrics-collector';
import { getPerformanceProfiler } from '@/domains/observability/performance-profiler';
import { getGovernanceAIService } from '@/domains/governance-ai';
import { unifiedGraphEngine } from '@/domains/security/kernel/unified-graph-engine';
import { assessRisk } from '@/domains/security/kernel/unified-graph-engine/risk-assessment-service';
import { analyzeGraph } from '@/domains/security/kernel/unified-graph-engine/graph-analyzer';

const MAX_HISTORY = 120; // keep last 120 snapshots (≈ 1 per 30s tick = ~1h)

export class PlatformStateAggregator {
  private history: PlatformStateSnapshot[] = [];

  constructor(private runtime: PlatformRuntimeAPI) {}

  snapshot(): PlatformStateSnapshot {
    const now = Date.now();
    const oneHourAgo = now - 3_600_000;

    // ── 1. ModuleOrchestrator (via POSL) ────────────────────────
    const status = this.runtime.status();
    const modules = this.runtime.modules.list();
    const activeModules = this.runtime.modules.listActive();
    const errorModules = modules.filter(m => m.status === 'error');
    const suspendedModules = modules.filter(m => m.status === 'suspended');
    const features = this.runtime.features.list();
    const activeFeatures = features.filter(f => f.enabled);
    const depGraph = this.runtime.modules.dependencyGraph();
    const maxDepth = this.computeMaxDepth(depGraph);

    // ── 2. ObservabilityCore ────────────────────────────────────
    const healthMonitor = getHealthMonitor();
    const errorTracker = getErrorTracker();
    const metricsCollector = getMetricsCollector();
    const healthSummary = healthMonitor.getSummary();
    const allErrors = errorTracker.getErrors();
    const recentErrors = allErrors
      .filter(e => e.first_seen > oneHourAgo)
      .reduce((sum, e) => sum + e.count, 0);

    // Average latency from module health reports
    const latencies = healthSummary.modules
      .map(m => m.latency_ms)
      .filter(l => l > 0);
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

    // Error rate: recent errors / total modules (approximation)
    const errorRate = modules.length > 0
      ? Math.round((recentErrors / Math.max(modules.length, 1)) * 100) / 100
      : 0;

    // Total metrics collected
    const metricsCount = metricsCollector.getPoints().length;

    // ── 3. SelfHealingEngine ────────────────────────────────────
    const selfHealingService = this.runtime.services.resolve<{ getState: () => { enabled: boolean; active_incidents: { id: string }[]; resolved_incidents: { id: string }[]; circuit_breakers: { state: string }[] }; getStats: () => { auto_recovered: number; escalated: number; avg_recovery_time_ms: number; uptime_pct: number } }>('SelfHealingEngine');
    let selfHealingData = {
      enabled: false,
      active_incidents: 0,
      resolved_incidents_total: 0,
      open_circuit_breakers: 0,
      auto_recovered_total: 0,
      escalated_total: 0,
      avg_recovery_time_ms: 0,
      uptime_pct: 100,
    };

    if (selfHealingService && typeof selfHealingService.getState === 'function') {
      const shState = selfHealingService.getState();
      const shStats = selfHealingService.getStats();
      selfHealingData = {
        enabled: shState.enabled,
        active_incidents: shState.active_incidents.length,
        resolved_incidents_total: shState.resolved_incidents.length,
        open_circuit_breakers: shState.circuit_breakers.filter(
          (cb) => cb.state === 'open'
        ).length,
        auto_recovered_total: shStats.auto_recovered,
        escalated_total: shStats.escalated,
        avg_recovery_time_ms: shStats.avg_recovery_time_ms,
        uptime_pct: shStats.uptime_pct,
      };
    }

    // ── 4. GovernanceAI ─────────────────────────────────────────
    let governanceData = {
      total_insights: 0,
      critical_insights: 0,
      warning_insights: 0,
      sod_conflicts: 0,
      excessive_permissions: 0,
      role_overlaps: 0,
      last_scan_at: null as number | null,
      ai_analysis_available: false,
    };

    try {
      const govService = getGovernanceAIService();
      const govState = govService.getState();
      const insights = govState.insights;

      governanceData = {
        total_insights: insights.length,
        critical_insights: insights.filter(i => i.severity === 'critical').length,
        warning_insights: insights.filter(i => i.severity === 'warning').length,
        sod_conflicts: insights.filter(i => i.category === 'sod_conflict').length,
        excessive_permissions: insights.filter(i => i.category === 'excessive_permissions').length,
        role_overlaps: insights.filter(i => i.category === 'role_overlap').length,
        last_scan_at: govState.last_scan_at,
        ai_analysis_available: govState.ai_analysis !== null,
      };
    } catch {
      // GovernanceAI may not be initialized yet
    }

    // ── 5. UnifiedGraphEngine (UGE) ─────────────────────────────
    let graphData = {
      total_nodes: 0,
      total_edges: 0,
      registered_domains: [] as string[],
      graph_version: 0,
      built_at: null as number | null,
      risk_signals_count: 0,
      high_risk_users: 0,
    };

    try {
      const registeredDomains = unifiedGraphEngine.getRegisteredDomains();
      if (registeredDomains.length > 0) {
        const graphSnapshot = unifiedGraphEngine.compose(undefined, `apcp-${now}`);
        const riskResult = assessRisk(graphSnapshot);

        graphData = {
          total_nodes: graphSnapshot.nodes.size,
          total_edges: graphSnapshot.edges.length,
          registered_domains: [...graphSnapshot.domains],
          graph_version: graphSnapshot.version,
          built_at: graphSnapshot.builtAt,
          risk_signals_count: riskResult.signals.length,
          high_risk_users: riskResult.userScores.filter(
            (u) => u.level === 'high' || u.level === 'critical'
          ).length,
        };
      }
    } catch {
      // UGE may not have providers registered yet
    }

    // ── Identity (POSL) ─────────────────────────────────────────
    const identity = this.runtime.identity.snapshot();

    // ── Build subsystem health ──────────────────────────────────
    const subsystemHealth: SubsystemHealth[] = [
      ...status.health.checks.map(c => ({
        name: c.name,
        status: c.status,
        message: c.message,
        last_check: c.checked_at,
      })),
      {
        name: 'SelfHealingEngine',
        status: selfHealingData.enabled
          ? selfHealingData.active_incidents > 0 ? 'warn' as const : 'ok' as const
          : 'warn' as const,
        message: selfHealingData.enabled
          ? `${selfHealingData.active_incidents} incidentes ativos, ${selfHealingData.open_circuit_breakers} circuits abertos`
          : 'Desabilitado',
        last_check: now,
      },
      {
        name: 'GovernanceAI',
        status: governanceData.critical_insights > 0 ? 'warn' as const : 'ok' as const,
        message: `${governanceData.total_insights} insights (${governanceData.critical_insights} críticos)`,
        last_check: now,
      },
      {
        name: 'UnifiedGraphEngine',
        status: graphData.registered_domains.length > 0 ? 'ok' as const : 'warn' as const,
        message: `${graphData.total_nodes} nodes, ${graphData.total_edges} edges, ${graphData.registered_domains.length} domains`,
        last_check: now,
      },
      {
        name: 'ObservabilityCore',
        status: healthSummary.down_count > 0 ? 'fail' as const
          : healthSummary.degraded_count > 0 ? 'warn' as const
          : 'ok' as const,
        message: `${healthSummary.healthy_count}✓ ${healthSummary.degraded_count}⚠ ${healthSummary.down_count}✗`,
        last_check: now,
      },
    ];

    // ── Determine overall health ────────────────────────────────
    let health: PlatformHealthLevel = 'healthy';
    const hasFails = subsystemHealth.some(s => s.status === 'fail');
    const hasWarns = subsystemHealth.some(s => s.status === 'warn');
    if (status.phase === 'idle') health = 'unknown';
    else if (hasFails || status.health.overall === 'unhealthy' || selfHealingData.active_incidents >= 3) health = 'critical';
    else if (hasWarns || status.phase === 'degraded' || errorModules.length > 0) health = 'degraded';

    // ── Aggregated risk score ───────────────────────────────────
    // Weighted average: Identity 30%, Governance 25%, SelfHealing 20%, Modules 15%, Graph 10%
    const identityRisk = identity.risk_score ?? 0;
    const governanceRisk = governanceData.critical_insights > 0
      ? Math.min(100, governanceData.critical_insights * 30 + governanceData.warning_insights * 10)
      : governanceData.warning_insights * 10;
    const selfHealingRisk = selfHealingData.active_incidents > 0
      ? Math.min(100, selfHealingData.active_incidents * 25 + selfHealingData.open_circuit_breakers * 15)
      : 0;
    const moduleRisk = modules.length > 0
      ? Math.round((errorModules.length / modules.length) * 100)
      : 0;
    const graphRisk = graphData.high_risk_users > 0
      ? Math.min(100, graphData.high_risk_users * 20)
      : 0;

    const overallRisk = Math.round(
      identityRisk * 0.30 +
      governanceRisk * 0.25 +
      selfHealingRisk * 0.20 +
      moduleRisk * 0.15 +
      graphRisk * 0.10
    );

    const riskLevel = overallRisk > 75 ? 'critical'
      : overallRisk > 50 ? 'high'
      : overallRisk > 25 ? 'medium'
      : 'low';

    // ── Assemble snapshot ───────────────────────────────────────
    const snap: PlatformStateSnapshot = {
      timestamp: now,
      health,
      runtime_phase: status.phase,
      uptime_ms: status.uptime_ms,

      // ModuleOrchestrator
      total_services: status.registered_services,
      total_modules: modules.length,
      active_modules: activeModules.length,
      error_modules: errorModules.length,
      suspended_modules: suspendedModules.length,
      total_features: features.length,
      active_features: activeFeatures.length,
      module_dependency_depth: maxDepth,

      // ObservabilityCore
      observability: {
        total_errors_last_hour: recentErrors,
        healthy_modules: healthSummary.healthy_count,
        degraded_modules: healthSummary.degraded_count,
        down_modules: healthSummary.down_count,
        avg_latency_ms: avgLatency,
        error_rate_pct: errorRate,
        metrics_collected: metricsCount,
      },

      // SelfHealingEngine
      self_healing: selfHealingData,

      // GovernanceAI
      governance: governanceData,

      // UnifiedGraphEngine
      unified_graph: graphData,

      // Identity
      active_sessions_estimate: identity.is_authenticated ? 1 : 0,
      active_impersonations: identity.is_impersonating ? 1 : 0,

      // Aggregated Risk
      overall_risk_score: overallRisk,
      risk_level: riskLevel,

      // Subsystem health
      subsystem_health: subsystemHealth,
    };

    this.history.push(snap);
    if (this.history.length > MAX_HISTORY) this.history.shift();

    return snap;
  }

  getHistory(limit = 30): PlatformStateSnapshot[] {
    return this.history.slice(-limit);
  }

  /** Patch the latest snapshot with extra data */
  patchLatest(patch: Partial<PlatformStateSnapshot>): void {
    if (this.history.length > 0) {
      Object.assign(this.history[this.history.length - 1], patch);
    }
  }

  /** Compute max depth of the module dependency graph */
  private computeMaxDepth(graph: Record<string, string[]>): number {
    const visited = new Set<string>();
    let maxDepth = 0;

    const dfs = (key: string, depth: number) => {
      if (visited.has(key)) return;
      visited.add(key);
      maxDepth = Math.max(maxDepth, depth);
      for (const dep of (graph[key] ?? [])) {
        dfs(dep, depth + 1);
      }
      visited.delete(key);
    };

    for (const key of Object.keys(graph)) {
      dfs(key, 0);
    }

    return maxDepth;
  }
}
