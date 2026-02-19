/**
 * AI Operations Metrics Collector — Prometheus-compatible metrics for the
 * Autonomous Operations AI Engine (advisory-only).
 *
 * Exported metrics:
 *   ai_suggestions_total                 (gauge, labels: priority, status)
 *   ai_risk_predictions_total            (gauge, labels: risk_type, severity)
 *   ai_automation_recommendations_total  (gauge, labels: category)
 *   ai_revenue_optimizations_total       (gauge)
 *   ai_workflow_optimizations_total      (gauge)
 *
 * SECURITY: Read-only snapshot. No execution occurs from metric collection.
 */

import { BehaviorPatternAnalyzer } from '@/domains/autonomous-operations/behavior-pattern-analyzer';
import { AutomationSuggestionEngine } from '@/domains/autonomous-operations/automation-suggestion-engine';
import { RiskPredictionService } from '@/domains/autonomous-operations/risk-prediction-service';
import { RevenueOptimizationAdvisor } from '@/domains/autonomous-operations/revenue-optimization-advisor';
import { WorkflowOptimizer } from '@/domains/autonomous-operations/workflow-optimizer';

export interface AIOperationsMetricsSnapshot {
  suggestions_total: number;
  suggestions_by_priority: { priority: string; count: number }[];
  suggestions_by_status: { status: string; count: number }[];
  risk_predictions_total: number;
  risks_by_type: { risk_type: string; count: number }[];
  risks_by_severity: { severity: string; count: number }[];
  automation_recommendations_total: number;
  recommendations_by_category: { category: string; count: number }[];
  revenue_optimizations_total: number;
  workflow_optimizations_total: number;
  collected_at: number;
}

let _cachedSnapshot: AIOperationsMetricsSnapshot | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

export function getAIOperationsMetricsSnapshot(): AIOperationsMetricsSnapshot {
  const now = Date.now();
  if (_cachedSnapshot && now - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedSnapshot;
  }

  try {
    const patterns = BehaviorPatternAnalyzer.analyze(24);
    const suggestions = AutomationSuggestionEngine.generateAll(patterns);
    const risks = RiskPredictionService.predictAll(patterns);

    // Suggestions by priority
    const priorityMap = new Map<string, number>();
    const statusMap = new Map<string, number>();
    for (const s of suggestions) {
      priorityMap.set(s.priority, (priorityMap.get(s.priority) || 0) + 1);
      statusMap.set(s.status, (statusMap.get(s.status) || 0) + 1);
    }

    // Risks by category and severity
    const riskTypeMap = new Map<string, number>();
    const severityMap = new Map<string, number>();
    for (const r of risks) {
      riskTypeMap.set(r.category, (riskTypeMap.get(r.category) || 0) + 1);
      const sev = r.composite_score > 0.7 ? 'critical' : r.composite_score > 0.4 ? 'warning' : 'info';
      severityMap.set(sev, (severityMap.get(sev) || 0) + 1);
    }

    // Revenue optimizations
    let revenueTotal = 0;
    try {
      const revenueOpts = RevenueOptimizationAdvisor.analyze([]);
      revenueTotal = revenueOpts.length;
    } catch { /* no tenants available */ }

    // Workflow optimizations
    let workflowTotal = 0;
    try {
      const workflowOpts = WorkflowOptimizer.generatePreview();
      workflowTotal = workflowOpts.length;
    } catch { /* skip */ }

    // Automation recommendations = suggestions with actions
    const automationRecs = suggestions.filter(s => s.actions.length > 0);
    const categoryMap = new Map<string, number>();
    for (const rec of automationRecs) {
      const cat = rec.actions[0]?.type || 'unknown';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    }

    _cachedSnapshot = {
      suggestions_total: suggestions.length,
      suggestions_by_priority: Array.from(priorityMap, ([priority, count]) => ({ priority, count })),
      suggestions_by_status: Array.from(statusMap, ([status, count]) => ({ status, count })),
      risk_predictions_total: risks.length,
      risks_by_type: Array.from(riskTypeMap, ([risk_type, count]) => ({ risk_type, count })),
      risks_by_severity: Array.from(severityMap, ([severity, count]) => ({ severity, count })),
      automation_recommendations_total: automationRecs.length,
      recommendations_by_category: Array.from(categoryMap, ([category, count]) => ({ category, count })),
      revenue_optimizations_total: revenueTotal,
      workflow_optimizations_total: workflowTotal,
      collected_at: now,
    };
    _cacheTimestamp = now;
  } catch {
    _cachedSnapshot = {
      suggestions_total: 0,
      suggestions_by_priority: [],
      suggestions_by_status: [],
      risk_predictions_total: 0,
      risks_by_type: [],
      risks_by_severity: [],
      automation_recommendations_total: 0,
      recommendations_by_category: [],
      revenue_optimizations_total: 0,
      workflow_optimizations_total: 0,
      collected_at: now,
    };
    _cacheTimestamp = now;
  }

  return _cachedSnapshot;
}
