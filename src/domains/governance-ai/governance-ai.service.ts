/**
 * GovernanceAIService — Orchestrator for hybrid governance analysis.
 *
 * 1. Runs local heuristic scan on UGE snapshot (instant)
 * 2. On demand, sends context to AI edge function for deep analysis
 */

import { unifiedGraphEngine } from '@/domains/security/kernel/unified-graph-engine';
import { analyzeGraph } from '@/domains/security/kernel/unified-graph-engine/graph-analyzer';
import { assessRisk } from '@/domains/security/kernel/unified-graph-engine/risk-assessment-service';
import { runHeuristicScan } from './heuristic-engine';
import type { GovernanceInsight, GovernanceAIRequest, GovernanceAIResponse, GovernanceAIState } from './types';
import { supabase } from '@/integrations/supabase/client';

export class GovernanceAIService {
  private state: GovernanceAIState = {
    insights: [],
    last_scan_at: null,
    scanning: false,
    ai_analysis: null,
    ai_loading: false,
  };

  private listeners = new Set<(state: GovernanceAIState) => void>();

  subscribe(fn: (state: GovernanceAIState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snapshot = { ...this.state };
    this.listeners.forEach(fn => fn(snapshot));
  }

  getState(): GovernanceAIState {
    return { ...this.state };
  }

  /**
   * Run local heuristic scan — instant, no network.
   */
  scan(sessionId?: string): GovernanceInsight[] {
    this.state.scanning = true;
    this.notify();

    try {
      const snapshot = unifiedGraphEngine.compose(undefined, sessionId);
      const analysis = analyzeGraph(snapshot);
      const risk = assessRisk(snapshot);

      const insights = runHeuristicScan(snapshot, analysis, risk);

      this.state.insights = insights;
      this.state.last_scan_at = Date.now();
      this.state.scanning = false;
      this.notify();

      return insights;
    } catch (err) {
      console.error('[GovernanceAI] Heuristic scan failed:', err);
      this.state.scanning = false;
      this.notify();
      return [];
    }
  }

  /**
   * Request AI deep analysis via edge function.
   */
  async requestAIAnalysis(
    type: GovernanceAIRequest['analysis_type'] = 'deep_risk',
    tenantId?: string,
  ): Promise<GovernanceAIResponse | null> {
    this.state.ai_loading = true;
    this.notify();

    try {
      // Run a fresh scan first
      if (this.state.insights.length === 0) this.scan();

      const snapshot = unifiedGraphEngine.compose();
      const risk = assessRisk(snapshot);

      const request: GovernanceAIRequest = {
        analysis_type: type,
        context: {
          insights: this.state.insights.slice(0, 20), // top 20
          risk_score: risk.userScores.reduce((max, u) => Math.max(max, u.score), 0),
          risk_level: risk.overallLevel,
          node_count: snapshot.nodes.size,
          edge_count: snapshot.edges.length,
          sod_conflicts: this.state.insights.filter(i => i.category === 'sod_conflict').length,
          user_scores: risk.userScores.map(u => ({
            userId: u.userUid,
            label: u.userLabel,
            score: u.score,
          })),
        },
        tenant_id: tenantId,
      };

      const { data, error } = await supabase.functions.invoke('governance-ai-analyze', {
        body: request,
      });

      if (error) throw error;

      const response = data as GovernanceAIResponse;
      this.state.ai_analysis = response;
      this.state.ai_loading = false;
      this.notify();

      return response;
    } catch (err) {
      console.error('[GovernanceAI] AI analysis failed:', err);
      this.state.ai_loading = false;
      this.notify();
      return null;
    }
  }

  clearAnalysis() {
    this.state.ai_analysis = null;
    this.notify();
  }
}

// Singleton
let _instance: GovernanceAIService | null = null;
export function getGovernanceAIService(): GovernanceAIService {
  if (!_instance) _instance = new GovernanceAIService();
  return _instance;
}
