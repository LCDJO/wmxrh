/**
 * GovernanceInsightsService — Orchestrates all governance analyzers.
 *
 * Replaces the monolithic heuristic-engine with modular sub-analyzers:
 *  ├── AccessRiskAnalyzer
 *  ├── PermissionAnomalyDetector
 *  ├── RoleOptimizationAdvisor
 *  └── SegregationOfDutiesChecker
 */

import type { UnifiedGraphSnapshot } from '@/domains/security/kernel/unified-graph-engine/types';
import type { AnalysisResult } from '@/domains/security/kernel/unified-graph-engine/graph-analyzer';
import type { RiskAssessment } from '@/domains/security/kernel/unified-graph-engine/types';
import type { GovernanceInsight, InsightSeverity } from './types';

import { detectSoDConflicts } from './segregation-of-duties-checker';
import { detectPermissionAnomalies } from './permission-anomaly-detector';
import { detectRoleOverlaps } from './role-optimization-advisor';
import { analyzeAccessRisk } from './access-risk-analyzer';
import { analyzePlanUsage } from './plan-usage-analyzer';
import { analyzeReferralFraud } from './referral-fraud-analyzer';

const SEVERITY_ORDER: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Run all governance heuristic analyzers and return sorted insights.
 */
export function runHeuristicScan(
  snapshot: UnifiedGraphSnapshot,
  analysis: AnalysisResult,
  risk: RiskAssessment,
): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [
    ...detectSoDConflicts(analysis, snapshot),
    ...detectPermissionAnomalies(snapshot, analysis, risk),
    ...detectRoleOverlaps(analysis, snapshot),
    ...analyzeAccessRisk(risk),
  ];

  // Sort by severity (critical first), then confidence
  insights.sort((a, b) => {
    const sd = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return sd !== 0 ? sd : b.confidence - a.confidence;
  });

  return insights;
}

/**
 * Run async analyzers that require database access (plan usage, etc.)
 * and merge results with existing insights.
 */
export async function runAsyncAnalyzers(
  existingInsights: GovernanceInsight[] = [],
): Promise<GovernanceInsight[]> {
  const [planInsights, referralInsights] = await Promise.all([
    analyzePlanUsage(),
    analyzeReferralFraud(),
  ]);

  const all = [...existingInsights, ...planInsights, ...referralInsights];

  all.sort((a, b) => {
    const sd = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return sd !== 0 ? sd : b.confidence - a.confidence;
  });

  return all;
}
