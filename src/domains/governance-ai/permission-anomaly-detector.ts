/**
 * PermissionAnomalyDetector — Detects excessive permissions and operational risks.
 *
 * Flags users with too many critical permissions and high-severity operational risks.
 */

import type { AnalysisResult } from '@/domains/security/kernel/unified-graph-engine/graph-analyzer';
import type { RiskAssessment } from '@/domains/security/kernel/unified-graph-engine/types';
import type { GovernanceInsight } from './types';
import { insightId } from './utils';

const CRITICAL_THRESHOLD = 5;

export function detectExcessivePermissions(
  _analysis: AnalysisResult,
  risk: RiskAssessment,
): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];

  for (const userScore of risk.userScores) {
    if (userScore.factors.criticalPermissionCount >= CRITICAL_THRESHOLD) {
      insights.push({
        id: insightId(),
        category: 'excessive_permissions',
        severity: 'warning',
        title: `Permissões excessivas: ${userScore.userLabel}`,
        description: `Usuário possui ${userScore.factors.criticalPermissionCount} permissões críticas. O princípio de menor privilégio recomenda reduzir.`,
        affected_entities: [
          { type: 'user', id: userScore.userUid, label: userScore.userLabel },
        ],
        recommendation: `Revisar e remover permissões não utilizadas nos últimos 30 dias.`,
        auto_remediable: false,
        confidence: 0.85,
        detected_at: Date.now(),
        source: 'heuristic',
      });
    }
  }

  return insights;
}

export function detectOperationalRisks(analysis: AnalysisResult): GovernanceInsight[] {
  return analysis.operationalRisks
    .filter(r => r.level === 'critical' || r.level === 'high')
    .map(risk => ({
      id: insightId(),
      category: 'compliance_gap' as const,
      severity: risk.level === 'critical' ? 'critical' as const : 'warning' as const,
      title: risk.title,
      description: `Risco operacional detectado: ${risk.id}. ${risk.detail ?? ''}`,
      affected_entities: [],
      recommendation: 'Investigar e mitigar o risco identificado.',
      auto_remediable: false,
      confidence: 0.85,
      detected_at: Date.now(),
      source: 'heuristic' as const,
    }));
}
