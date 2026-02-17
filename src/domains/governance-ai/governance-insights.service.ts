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
import { detectExcessivePermissions, detectOperationalRisks } from './permission-anomaly-detector';
import { detectRoleOverlaps } from './role-optimization-advisor';
import { analyzeAccessRisk } from './access-risk-analyzer';

const SEVERITY_ORDER: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Run all governance heuristic analyzers and return sorted insights.
 */
export function runHeuristicScan(
  _snapshot: UnifiedGraphSnapshot,
  analysis: AnalysisResult,
  risk: RiskAssessment,
): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [
    ...detectSoDConflicts(analysis),
    ...detectExcessivePermissions(analysis, risk),
    ...detectRoleOverlaps(analysis),
    ...analyzeAccessRisk(risk),
    ...detectOperationalRisks(analysis),
  ];

  // Sort by severity (critical first), then confidence
  insights.sort((a, b) => {
    const sd = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return sd !== 0 ? sd : b.confidence - a.confidence;
  });

  return insights;
}
