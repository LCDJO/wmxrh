/**
 * ObservabilityBridge — Connects APCP with ObservabilityCore for
 * metrics export and health monitoring integration.
 */

import type { PlatformRuntimeAPI } from '@/domains/platform-os/types';
import { getMetricsCollector } from '@/domains/observability/metrics-collector';
import { getHealthMonitor } from '@/domains/observability/health-monitor';
import { getErrorTracker } from '@/domains/observability/error-tracker';

export class ObservabilityBridge {
  constructor(private runtime: PlatformRuntimeAPI) {}

  /** Initialize APCP-specific metric baselines */
  registerMetrics(): void {
    const metrics = getMetricsCollector();
    metrics.increment('apcp_state_snapshots_total', {}, 0);
    metrics.increment('apcp_automation_executions_total', {}, 0);
    metrics.increment('apcp_actions_executed_total', {}, 0);
    metrics.increment('referral_links_created_total', {}, 0);
    metrics.increment('referral_conversion_total', {}, 0);
    metrics.increment('gamification_points_total', {}, 0);
    metrics.gauge('apcp_risk_score', 0);
    // Workflow / Automation baselines
    metrics.increment('workflow_executions_total', {}, 0);
    metrics.increment('workflow_failures_total', {}, 0);
    metrics.gauge('workflow_latency_avg_ms', 0);
    metrics.gauge('automation_active_workflows', 0);
    metrics.gauge('apcp_active_modules', 0);
    metrics.gauge('apcp_error_modules', 0);
    metrics.gauge('revenue_forecast_value', 0);
    // Marketing / A/B Testing baselines
    metrics.gauge('landing_ab_experiment_total', 0);
    metrics.gauge('landing_ab_experiment_running', 0);
    metrics.gauge('landing_ab_experiment_completed', 0);
    metrics.gauge('landing_variant_conversion_rate', 0);
    metrics.gauge('landing_revenue_generated', 0);
    metrics.gauge('landing_revenue_generated_total', 0);
    metrics.gauge('fab_engagement_score', 0);
  }

  /** Update gauges from current state */
  updateGauges(riskScore: number, activeModules: number, errorModules: number): void {
    const metrics = getMetricsCollector();
    metrics.gauge('apcp_risk_score', riskScore);
    metrics.gauge('apcp_active_modules', activeModules);
    metrics.gauge('apcp_error_modules', errorModules);
  }

  incrementSnapshots(): void {
    getMetricsCollector().increment('apcp_state_snapshots_total');
  }

  incrementAutomation(): void {
    getMetricsCollector().increment('apcp_automation_executions_total');
  }

  incrementActions(): void {
    getMetricsCollector().increment('apcp_actions_executed_total');
  }

  /** Get a health summary from ObservabilityCore */
  getHealthSummary() {
    const health = getHealthMonitor();
    const errors = getErrorTracker();
    return {
      summary: health.getSummary(),
      errors: errors.getErrors().slice(-20),
      errorCount: errors.getErrors().reduce((s, e) => s + e.count, 0),
    };
  }
}
