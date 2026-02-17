/**
 * Predictive Risk Service — Historical trend analysis + AI forecasting.
 *
 * READ-ONLY: Captures risk snapshots over time and uses AI
 * to predict future risk trajectory.
 */

import { supabase } from '@/integrations/supabase/client';
import { unifiedGraphEngine } from '@/domains/security/kernel/unified-graph-engine';
import type { UnifiedNode } from '@/domains/security/kernel/unified-graph-engine';
import type {
  RiskTrendSnapshot,
  RiskTrendMetadata,
  RiskTrendAnalysis,
  RiskForecast,
} from './governance.types';

// ════════════════════════════════════
// CAPTURE TREND SNAPSHOT
// ════════════════════════════════════

export async function captureRiskTrendSnapshot(tenantId: string): Promise<RiskTrendSnapshot> {
  const report = unifiedGraphEngine.buildFullReport();
  const { risk, snapshot } = report;

  const allNodes: UnifiedNode[] = Array.from(snapshot.nodes.values());
  const userScores = risk.userScores;
  const highRiskUsers = userScores.filter(u => u.level === 'high' || u.level === 'critical').length;

  // Calculate score (0-100 based on signal severity)
  const riskScore = calculateRiskScore(risk);

  // Get previous snapshot for trend
  const previous = await fetchLatestTrendSnapshot(tenantId);
  const trend = computeTrend(riskScore, previous);

  const record = {
    tenant_id: tenantId,
    risk_level: risk.overallLevel,
    risk_score: riskScore,
    signal_count: risk.signals.length,
    critical_count: risk.signals.filter(s => s.level === 'critical').length,
    high_count: risk.signals.filter(s => s.level === 'high').length,
    medium_count: risk.signals.filter(s => s.level === 'medium').length,
    low_count: risk.signals.filter(s => s.level === 'low').length,
    user_count: allNodes.filter(n => n.type === 'platform_user' || n.type === 'tenant_user').length,
    high_risk_users: highRiskUsers,
    top_signals: risk.signals.slice(0, 5).map(s => ({
      id: s.id,
      level: s.level,
      domain: s.domain,
      title: s.title,
      detail: s.detail,
      affected_count: s.affectedNodeUids.length,
    })),
    trend_metadata: trend,
    ai_forecast: null,
    forecast_risk_level: null,
    forecast_confidence: 0,
  };

  const { data, error } = await supabase
    .from('risk_trend_snapshots')
    .insert(record as any)
    .select()
    .single();

  if (error) throw new Error(`Failed to save risk trend: ${error.message}`);
  return data as unknown as RiskTrendSnapshot;
}

// ════════════════════════════════════
// FETCH
// ════════════════════════════════════

export async function fetchLatestTrendSnapshot(tenantId: string): Promise<RiskTrendSnapshot | null> {
  const { data } = await supabase
    .from('risk_trend_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as unknown as RiskTrendSnapshot | null;
}

export async function fetchTrendHistory(
  tenantId: string,
  days = 30,
): Promise<RiskTrendSnapshot[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('risk_trend_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('snapshot_at', since.toISOString())
    .order('snapshot_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch trends: ${error.message}`);
  return (data ?? []) as unknown as RiskTrendSnapshot[];
}

// ════════════════════════════════════
// TREND ANALYSIS
// ════════════════════════════════════

export async function analyzeTrends(tenantId: string, days = 30): Promise<RiskTrendAnalysis> {
  const snapshots = await fetchTrendHistory(tenantId, days);

  const latestScore = snapshots.length > 0 ? snapshots[snapshots.length - 1].risk_score : 0;
  const trend = snapshots.length >= 2
    ? computeTrendFromHistory(snapshots)
    : { trend: 'unknown' as const };

  return {
    tenant_id: tenantId,
    period_start: new Date(Date.now() - days * 86400000).toISOString(),
    period_end: new Date().toISOString(),
    snapshots,
    trend,
    forecast: null, // Filled by AI edge function
  };
}

// ════════════════════════════════════
// AI FORECAST (calls edge function)
// ════════════════════════════════════

export async function requestAIForecast(
  tenantId: string,
  trendData: RiskTrendAnalysis,
): Promise<RiskForecast | null> {
  try {
    const { data, error } = await supabase.functions.invoke('governance-ai', {
      body: {
        action: 'predict_risk',
        tenant_id: tenantId,
        trend_data: {
          snapshots: trendData.snapshots.slice(-14), // Last 14 data points
          trend: trendData.trend,
          current_score: trendData.snapshots.length > 0
            ? trendData.snapshots[trendData.snapshots.length - 1].risk_score
            : 0,
        },
      },
    });

    if (error) {
      console.error('[PredictiveRisk] AI forecast error:', error);
      return null;
    }

    return data?.forecast ?? null;
  } catch (err) {
    console.error('[PredictiveRisk] AI forecast failed:', err);
    return null;
  }
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

function calculateRiskScore(risk: { signals: Array<{ level: string }>; overallLevel: string }): number {
  let score = 0;
  for (const s of risk.signals) {
    switch (s.level) {
      case 'critical': score += 25; break;
      case 'high': score += 15; break;
      case 'medium': score += 8; break;
      case 'low': score += 3; break;
    }
  }
  return Math.min(100, score);
}

function computeTrend(currentScore: number, previous: RiskTrendSnapshot | null): RiskTrendMetadata {
  if (!previous) {
    return { trend: 'unknown' };
  }

  const delta = currentScore - previous.risk_score;
  const trend: RiskTrendMetadata['trend'] =
    delta < -5 ? 'improving' :
    delta > 5 ? 'degrading' :
    'stable';

  return {
    score_delta: delta,
    trend,
    velocity: delta, // per snapshot interval
  };
}

function computeTrendFromHistory(snapshots: RiskTrendSnapshot[]): RiskTrendMetadata {
  if (snapshots.length < 2) return { trend: 'unknown' };

  const scores = snapshots.map(s => s.risk_score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const latest = scores[scores.length - 1];
  const first = scores[0];
  const delta = latest - first;

  const daysDiff = Math.max(1,
    (new Date(snapshots[snapshots.length - 1].snapshot_at).getTime() -
     new Date(snapshots[0].snapshot_at).getTime()) / 86400000,
  );

  const velocity = delta / daysDiff;

  return {
    score_delta: delta,
    moving_average: Math.round(avg * 100) / 100,
    trend: delta < -5 ? 'improving' : delta > 5 ? 'degrading' : 'stable',
    velocity: Math.round(velocity * 100) / 100,
  };
}
