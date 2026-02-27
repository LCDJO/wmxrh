/**
 * ChaosMetricsCollector — Prometheus-compatible metrics for Chaos Engineering.
 *
 * Exported metrics:
 *   chaos_tests_total                    (counter)
 *   chaos_tests_by_status                (gauge per status)
 *   chaos_sla_failures_total             (counter)
 *   chaos_rto_exceeded_total             (counter)
 *   chaos_rpo_exceeded_total             (counter)
 *   chaos_self_healing_triggered_total   (counter)
 *   chaos_safety_stops_total             (counter)
 *   chaos_incidents_created_total        (counter)
 *   chaos_avg_resilience_score           (gauge)
 *   chaos_avg_impact_score               (gauge)
 *   chaos_sla_compliance_pct             (gauge)
 *   chaos_rto_compliance_pct             (gauge)
 */
import { getMetricsCollector } from '../observability/metrics-collector';
import { supabase } from '@/integrations/supabase/client';

export async function collectChaosMetrics(): Promise<void> {
  const collector = getMetricsCollector();

  const { data: experiments } = await (supabase as any)
    .from('chaos_experiments')
    .select('status, sla_met, rto_met, rpo_met, self_healing_triggered, safety_stopped, incident_id, resilience_score, impact_score, escalation_triggered');

  const all = (experiments ?? []) as any[];
  const completed = all.filter(e => e.status === 'completed');

  // ── Counters ──
  collector.increment('chaos_tests_total', {}, all.length);

  // By status
  const statusCounts: Record<string, number> = {};
  for (const e of all) {
    statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1;
  }
  for (const [status, count] of Object.entries(statusCounts)) {
    collector.gauge('chaos_tests_by_status', count, { status });
  }

  // SLA failures
  const slaFailures = all.filter(e => e.sla_met === false).length;
  collector.increment('chaos_sla_failures_total', {}, slaFailures);

  // RTO exceeded
  const rtoExceeded = all.filter(e => e.rto_met === false).length;
  collector.increment('chaos_rto_exceeded_total', {}, rtoExceeded);

  // RPO exceeded
  const rpoExceeded = all.filter(e => e.rpo_met === false).length;
  collector.increment('chaos_rpo_exceeded_total', {}, rpoExceeded);

  // Self-healing triggered
  const selfHealing = all.filter(e => e.self_healing_triggered === true).length;
  collector.increment('chaos_self_healing_triggered_total', {}, selfHealing);

  // Safety stops
  const safetyStops = all.filter(e => e.safety_stopped === true).length;
  collector.increment('chaos_safety_stops_total', {}, safetyStops);

  // Incidents created
  const incidents = all.filter(e => e.incident_id != null).length;
  collector.increment('chaos_incidents_created_total', {}, incidents);

  // ── Gauges ──
  const avgResilience = completed.length
    ? Math.round(completed.reduce((s: number, e: any) => s + (e.resilience_score ?? 0), 0) / completed.length * 10) / 10
    : 0;
  collector.gauge('chaos_avg_resilience_score', avgResilience);

  const avgImpact = completed.length
    ? Math.round(completed.reduce((s: number, e: any) => s + (e.impact_score ?? 0), 0) / completed.length * 10) / 10
    : 0;
  collector.gauge('chaos_avg_impact_score', avgImpact);

  const slaCompliance = completed.length
    ? Math.round(completed.filter((e: any) => e.sla_met).length / completed.length * 100)
    : 100;
  collector.gauge('chaos_sla_compliance_pct', slaCompliance);

  const rtoCompliance = completed.length
    ? Math.round(completed.filter((e: any) => e.rto_met).length / completed.length * 100)
    : 100;
  collector.gauge('chaos_rto_compliance_pct', rtoCompliance);
}
