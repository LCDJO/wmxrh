/**
 * InsightDashboardService — Aggregates all sub-engines into a unified operational dashboard state.
 */

import type { OperationalDashboardState, OperationalInsight } from './types';
import { PlatformSignalCollector } from './platform-signal-collector';
import { BehaviorPatternAnalyzer } from './behavior-pattern-analyzer';
import { AutomationSuggestionEngine } from './automation-suggestion-engine';
import { RiskPredictionService } from './risk-prediction-service';
import { RevenueOptimizationAdvisor } from './revenue-optimization-advisor';
import { WorkflowOptimizer } from './workflow-optimizer';

let _insightSeq = 0;

export const InsightDashboardService = {
  /** Build the full operational dashboard state */
  buildDashboard(): OperationalDashboardState {
    const signals = PlatformSignalCollector.getRecent(24);
    const patterns = BehaviorPatternAnalyzer.analyze(24);
    const suggestions = AutomationSuggestionEngine.generate(patterns);
    const risks = RiskPredictionService.predict(patterns);
    const revenueOpts = RevenueOptimizationAdvisor.generatePreview();
    const workflowOpts = WorkflowOptimizer.generatePreview();

    const insights: OperationalInsight[] = [];

    // Convert patterns to insights
    for (const p of patterns) {
      insights.push({
        id: `ins_${++_insightSeq}`,
        category: 'pattern',
        title: `Padrão: ${p.type.replace(/_/g, ' ')}`,
        summary: p.description,
        severity: p.confidence >= 70 ? 'critical' : p.confidence >= 40 ? 'warning' : 'info',
        data: { pattern_id: p.id, confidence: p.confidence, data_points: p.data_points },
        created_at: p.detected_at,
        is_actionable: true,
        action_label: 'Ver sugestões',
      });
    }

    // Convert risks to insights
    for (const r of risks) {
      insights.push({
        id: `ins_${++_insightSeq}`,
        category: 'risk',
        title: r.title,
        summary: r.description,
        severity: r.composite_score >= 60 ? 'critical' : r.composite_score >= 30 ? 'warning' : 'info',
        data: { risk_id: r.id, probability: r.probability, impact: r.impact_score, composite: r.composite_score },
        created_at: r.predicted_at,
        is_actionable: true,
        action_label: 'Mitigar',
      });
    }

    // Convert revenue opts to insights
    for (const o of revenueOpts) {
      insights.push({
        id: `ins_${++_insightSeq}`,
        category: 'optimization',
        title: `Receita: ${o.recommended_action.replace(/_/g, ' ')} — ${o.tenant_name}`,
        summary: o.reasoning,
        severity: 'info',
        data: { revenue_id: o.id, mrr_impact: o.estimated_mrr_impact, confidence: o.confidence },
        created_at: o.created_at,
        is_actionable: true,
        action_label: 'Executar',
      });
    }

    // Convert workflow opts to insights
    for (const w of workflowOpts) {
      insights.push({
        id: `ins_${++_insightSeq}`,
        category: 'optimization',
        title: `Workflow: ${w.workflow_name} — ${w.optimization_type}`,
        summary: w.description,
        severity: 'info',
        data: { speedup_pct: w.estimated_speedup_pct, current_ms: w.current_avg_duration_ms, suggested_ms: w.suggested_duration_ms },
        created_at: new Date().toISOString(),
        is_actionable: false,
      });
    }

    // Determine overall health
    const criticalRisks = risks.filter(r => r.composite_score >= 60).length;
    const overall = criticalRisks >= 2 ? 'critical' : criticalRisks >= 1 || patterns.some(p => p.type === 'error_burst') ? 'degraded' : 'healthy';

    return {
      total_signals_24h: signals.length,
      active_patterns: patterns.length,
      pending_suggestions: suggestions.filter(s => s.status === 'pending').length,
      active_risks: risks.length,
      revenue_optimizations: revenueOpts.length,
      workflow_optimizations: workflowOpts.length,
      overall_health: overall,
      last_analysis: new Date().toISOString(),
      insights: insights.sort((a, b) => {
        const sev = { critical: 0, warning: 1, info: 2 };
        return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2);
      }),
    };
  },
};
