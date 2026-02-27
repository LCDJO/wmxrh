/**
 * IncidentMetricsCollector — Prometheus-compatible metrics for incident management.
 *
 * Exported metrics:
 *   incident_open_total               (gauge)
 *   incident_open_by_severity         (gauge, labels: severity)
 *   incident_mttr_minutes             (gauge)
 *   incident_sla_breach_total         (gauge)
 *   incident_created_total            (gauge)
 *   incident_resolved_total           (gauge)
 *   platform_uptime_30d               (gauge)
 */
import { getMetricsCollector } from '../observability/metrics-collector';
import { supabase } from '@/integrations/supabase/client';

export interface IncidentMetricsSnapshot {
  open_total: number;
  by_severity: Record<string, number>;
  mttr_minutes: number;
  sla_breach_total: number;
  created_total: number;
  resolved_total: number;
  uptime_30d: number;
}

let _cached: IncidentMetricsSnapshot | null = null;
let _lastFetch = 0;
const CACHE_TTL = 60_000;

export async function collectIncidentMetrics(): Promise<IncidentMetricsSnapshot> {
  const now = Date.now();
  if (_cached && now - _lastFetch < CACHE_TTL) return _cached;

  const collector = getMetricsCollector();

  // Open incidents by severity
  const { data: open } = await (supabase.from('incidents' as any)
    .select('severity')
    .in('status', ['open', 'investigating', 'mitigated']) as any);

  const bySeverity: Record<string, number> = { sev1: 0, sev2: 0, sev3: 0, sev4: 0 };
  for (const i of (open ?? [])) bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;

  const openTotal = (open ?? []).length;

  // Totals
  const { count: createdTotal } = await (supabase.from('incidents' as any)
    .select('*', { count: 'exact', head: true }) as any);

  const { count: resolvedTotal } = await (supabase.from('incidents' as any)
    .select('*', { count: 'exact', head: true })
    .in('status', ['resolved', 'closed']) as any);

  const { count: breachTotal } = await (supabase.from('incidents' as any)
    .select('*', { count: 'exact', head: true })
    .eq('sla_breached', true) as any);

  // MTTR
  const { data: resolved } = await (supabase.from('incidents' as any)
    .select('created_at, resolved_at')
    .not('resolved_at', 'is', null)
    .order('resolved_at', { ascending: false })
    .limit(30) as any);

  let mttr = 0;
  const list = (resolved ?? []) as Array<{ created_at: string; resolved_at: string }>;
  if (list.length > 0) {
    const ttrs = list.map(r => (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 60_000);
    mttr = Math.round(ttrs.reduce((s, t) => s + t, 0) / ttrs.length);
  }

  // Uptime (from availability_records)
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: avail } = await (supabase.from('availability_records' as any)
    .select('uptime_percentage').gte('period_start', since30) as any);
  const records = (avail ?? []) as Array<{ uptime_percentage: number }>;
  const uptime30 = records.length > 0
    ? Math.round((records.reduce((s, r) => s + r.uptime_percentage, 0) / records.length) * 1000) / 1000
    : 100;

  const snapshot: IncidentMetricsSnapshot = {
    open_total: openTotal,
    by_severity: bySeverity,
    mttr_minutes: mttr,
    sla_breach_total: breachTotal ?? 0,
    created_total: createdTotal ?? 0,
    resolved_total: resolvedTotal ?? 0,
    uptime_30d: uptime30,
  };

  // Push to Prometheus
  collector.gauge('incident_open_total', snapshot.open_total);
  for (const [sev, count] of Object.entries(bySeverity)) {
    collector.gauge('incident_open_by_severity', count, { severity: sev });
  }
  collector.gauge('incident_mttr_minutes', snapshot.mttr_minutes);
  collector.gauge('incident_sla_breach_total', snapshot.sla_breach_total);
  collector.gauge('incident_created_total', snapshot.created_total);
  collector.gauge('incident_resolved_total', snapshot.resolved_total);
  collector.gauge('platform_uptime_30d', snapshot.uptime_30d);

  _cached = snapshot;
  _lastFetch = now;
  return snapshot;
}

export function getIncidentMetricsSnapshot(): IncidentMetricsSnapshot {
  return _cached ?? {
    open_total: 0, by_severity: {}, mttr_minutes: 0,
    sla_breach_total: 0, created_total: 0, resolved_total: 0, uptime_30d: 100,
  };
}
