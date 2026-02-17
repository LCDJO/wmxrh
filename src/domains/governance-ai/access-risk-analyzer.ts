/**
 * AccessRiskAnalyzer — Detects high-risk users based on risk scores.
 *
 * Extracted from heuristic-engine for modular governance architecture.
 */

import type { RiskAssessment } from '@/domains/security/kernel/unified-graph-engine/types';
import type { GovernanceInsight } from './types';
import { insightId } from './utils';

const HIGH_SCORE = 70;

export function analyzeAccessRisk(risk: RiskAssessment): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];

  for (const userScore of risk.userScores) {
    if (userScore.score >= HIGH_SCORE) {
      insights.push({
        id: insightId(),
        category: 'privilege_escalation',
        severity: userScore.score >= 85 ? 'critical' : 'warning',
        title: `Risco elevado: ${userScore.userLabel} (score ${userScore.score})`,
        description: `Score de risco ${userScore.score}/100. Fatores: ${userScore.factors.criticalPermissionCount} permissões críticas, ${userScore.factors.multiTenantCount > 1 ? 'acesso multi-tenant' : 'single-tenant'}.`,
        affected_entities: [
          { type: 'user', id: userScore.userUid, label: userScore.userLabel },
        ],
        recommendation: userScore.factors.hasActiveImpersonation
          ? 'Encerrar sessão de impersonation e revisar necessidade.'
          : 'Aplicar MFA obrigatório e revisão periódica de acesso.',
        auto_remediable: false,
        confidence: 0.9,
        detected_at: Date.now(),
        source: 'heuristic',
      });
    }
  }

  return insights;
}
