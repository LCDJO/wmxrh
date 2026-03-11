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
    // SCIM baselines
    metrics.increment('scim_users_created_total', {}, 0);
    metrics.increment('scim_users_updated_total', {}, 0);
    metrics.increment('scim_users_deactivated_total', {}, 0);
    metrics.increment('scim_errors_total', {}, 0);
    // WorkTime baselines
    metrics.increment('clock_entries_total', {}, 0);
    metrics.increment('geo_violation_total', {}, 0);
    metrics.increment('fraud_flags_total', {}, 0);
    metrics.increment('device_integrity_failures_total', {}, 0);
    // Biometric baselines
    metrics.increment('biometric_enrollments_total', {}, 0);
    metrics.increment('biometric_verifications_total', {}, 0);
    metrics.increment('biometric_spoof_detections_total', {}, 0);
    metrics.increment('biometric_liveness_failures_total', {}, 0);
    // Behavioral AI baselines
    metrics.increment('behavior_anomalies_total', {}, 0);
    metrics.increment('high_risk_entries_total', {}, 0);
    metrics.increment('shared_device_suspicions_total', {}, 0);
    metrics.gauge('ai_model_accuracy_score', 0);
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
    // Subscription health baselines
    metrics.gauge('active_subscriptions_total', 0);
    metrics.gauge('past_due_total', 0);
    metrics.gauge('downgrades_scheduled_total', 0);
    metrics.increment('plan_limit_exceeded_total', {}, 0);
    metrics.gauge('fraud_flags_total', 0);
    // WhiteLabel baselines
    metrics.gauge('tenants_whitelabel_enabled_total', 0);
    metrics.increment('branding_updates_total', {}, 0);
    metrics.gauge('custom_domain_active_total', 0);
    // User Presence baselines
    metrics.gauge('active_sessions_total', 0);
    metrics.gauge('login_events_total', 0);
    metrics.gauge('session_duration_avg_seconds', 0);
    metrics.increment('geo_login_distribution', {}, 0);
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
