/**
 * SupportMetricsCollector — Prometheus-compatible metrics for the support system.
 *
 * Exported metrics:
 *   support_ticket_total              (gauge)
 *   support_ticket_closed_total       (gauge)
 *   support_agent_score_avg           (gauge)
 *   support_system_score_avg          (gauge)
 */
import { getMetricsCollector } from './metrics-collector';
import { supabase } from '@/integrations/supabase/client';

export interface SupportMetricsSnapshot {
  ticket_total: number;
  ticket_closed_total: number;
  agent_score_avg: number;
  system_score_avg: number;
}

let _cachedSnapshot: SupportMetricsSnapshot | null = null;
let _lastFetch = 0;
const CACHE_TTL_MS = 60_000; // 1 min

export async function collectSupportMetrics(): Promise<SupportMetricsSnapshot> {
  const now = Date.now();
  if (_cachedSnapshot && now - _lastFetch < CACHE_TTL_MS) return _cachedSnapshot;

  const collector = getMetricsCollector();

  // Ticket totals
  const { count: totalCount } = await supabase
    .from('support_tickets')
    .select('*', { count: 'exact', head: true });

  const { count: closedCount } = await supabase
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .in('status', ['resolved', 'closed']);

  // Agent score avg
  const { data: evals } = await supabase
    .from('support_evaluations')
    .select('agent_score, system_score');

  const agentScores = (evals ?? []).filter(e => e.agent_score != null).map(e => e.agent_score!);
  const avgAgent = agentScores.length > 0
    ? Math.round((agentScores.reduce((a, b) => a + b, 0) / agentScores.length) * 100) / 100
    : 0;

  // System score avg
  const { data: sysRatings } = await supabase
    .from('support_system_ratings')
    .select('rating');

  const sysScores = (sysRatings ?? []).map(r => r.rating);
  const avgSystem = sysScores.length > 0
    ? Math.round((sysScores.reduce((a, b) => a + b, 0) / sysScores.length) * 100) / 100
    : 0;

  const snapshot: SupportMetricsSnapshot = {
    ticket_total: totalCount ?? 0,
    ticket_closed_total: closedCount ?? 0,
    agent_score_avg: avgAgent,
    system_score_avg: avgSystem,
  };

  // Push to Prometheus collector
  collector.gauge('support_ticket_total', snapshot.ticket_total);
  collector.gauge('support_ticket_closed_total', snapshot.ticket_closed_total);
  collector.gauge('support_agent_score_avg', snapshot.agent_score_avg);
  collector.gauge('support_system_score_avg', snapshot.system_score_avg);

  _cachedSnapshot = snapshot;
  _lastFetch = now;
  return snapshot;
}

export function getSupportMetricsSnapshot(): SupportMetricsSnapshot {
  return _cachedSnapshot ?? { ticket_total: 0, ticket_closed_total: 0, agent_score_avg: 0, system_score_avg: 0 };
}
