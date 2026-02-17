/**
 * GovernanceHeuristicEngine — Local deterministic analysis.
 *
 * Analyzes UGE snapshots to detect governance issues without AI calls.
 * Fast, zero-latency, runs entirely in the browser.
 */

import type { UnifiedGraphSnapshot } from '@/domains/security/kernel/unified-graph-engine/types';
import type { AnalysisResult } from '@/domains/security/kernel/unified-graph-engine/graph-analyzer';
import type { RiskAssessment } from '@/domains/security/kernel/unified-graph-engine/types';
import type { GovernanceInsight, InsightCategory, InsightSeverity, AffectedEntity, RemediationAction, RemediationStep } from './types';

let _insightCounter = 0;
function insightId() { return `gi_${++_insightCounter}_${Date.now()}`; }

function remediation(
  type: RemediationAction['type'],
  description: string,
  impact: string,
  steps: RemediationStep[],
): RemediationAction {
  return {
    id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    description,
    impact_summary: impact,
    steps,
    status: 'pending',
    requires_approval: true,
    created_at: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════
// HEURISTIC DETECTORS
// ═══════════════════════════════════════════════════════════════

function detectSoDConflicts(analysis: AnalysisResult): GovernanceInsight[] {
  return analysis.accessConflicts.map(conflict => ({
    id: insightId(),
    category: 'sod_conflict' as InsightCategory,
    severity: 'critical' as InsightSeverity,
    title: `Conflito SoD: ${conflict.user.label}`,
    description: `Usuário possui cargos conflitantes: ${conflict.rule}. Isso viola o princípio de segregação de funções.`,
    affected_entities: [
      { type: 'user' as const, id: conflict.user.originalId, label: conflict.user.label, domain: conflict.user.domain },
      ...conflict.roles.map(r => ({ type: 'role' as const, id: r.originalId, label: r.label, domain: r.domain })),
    ],
    recommendation: `Remover um dos cargos conflitantes ou criar um cargo combinado com restrições adequadas.`,
    auto_remediable: true,
    remediation_action: remediation(
      'remove_role',
      `Remover cargo de menor prioridade do usuário ${conflict.user.label}`,
      `Reduz risco de fraude por segregação inadequada`,
      conflict.roles.map((r, i) => ({
        order: i + 1,
        action: 'evaluate_role_removal',
        target: r.originalId,
        details: `Avaliar remoção do cargo "${r.label}" do usuário`,
      })),
    ),
    confidence: 0.95,
    detected_at: Date.now(),
    source: 'heuristic' as const,
  }));
}

function detectExcessivePermissions(
  analysis: AnalysisResult,
  risk: RiskAssessment,
): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];
  const CRITICAL_THRESHOLD = 5;

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

function detectRoleOverlaps(analysis: AnalysisResult): GovernanceInsight[] {
  return analysis.roleOverlaps
    .filter(overlap => overlap.overlapRatio >= 0.6)
    .map(overlap => ({
      id: insightId(),
      category: 'role_overlap' as InsightCategory,
      severity: (overlap.overlapRatio >= 0.8 ? 'warning' : 'info') as InsightSeverity,
      title: `Sobreposição de cargos: ${overlap.roleA.label} ↔ ${overlap.roleB.label}`,
      description: `${Math.round(overlap.overlapRatio * 100)}% das permissões são compartilhadas. Considere consolidar.`,
      affected_entities: [
        { type: 'role', id: overlap.roleA.originalId, label: overlap.roleA.label, domain: overlap.roleA.domain },
        { type: 'role', id: overlap.roleB.originalId, label: overlap.roleB.label, domain: overlap.roleB.domain },
      ],
      recommendation: `Consolidar em um único cargo ou definir diferenciação clara.`,
      auto_remediable: true,
      remediation_action: remediation(
        'merge_roles',
        `Consolidar "${overlap.roleA.label}" e "${overlap.roleB.label}"`,
        `Simplifica a gestão de acesso e reduz superfície de ataque`,
        [
          { order: 1, action: 'analyze_unique_permissions', target: overlap.roleA.originalId, details: 'Identificar permissões exclusivas' },
          { order: 2, action: 'create_merged_role', target: 'new_role', details: 'Criar cargo consolidado' },
          { order: 3, action: 'migrate_users', target: 'affected_users', details: 'Migrar usuários para o novo cargo' },
        ],
      ),
      confidence: 0.8,
      detected_at: Date.now(),
      source: 'heuristic',
    }));
}

function detectHighRiskUsers(risk: RiskAssessment): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];
  const HIGH_SCORE = 70;

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

function detectOperationalRisks(analysis: AnalysisResult): GovernanceInsight[] {
  return analysis.operationalRisks
    .filter(r => r.level === 'critical' || r.level === 'high')
    .map(risk => ({
      id: insightId(),
      category: 'compliance_gap' as InsightCategory,
      severity: risk.level === 'critical' ? 'critical' : 'warning',
      title: risk.title,
      description: `Risco operacional detectado: ${risk.id}. ${risk.detail ?? ''}`,
      affected_entities: [],
      recommendation: 'Investigar e mitigar o risco identificado.',
      auto_remediable: false,
      confidence: 0.85,
      detected_at: Date.now(),
      source: 'heuristic',
    }));
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

export function runHeuristicScan(
  snapshot: UnifiedGraphSnapshot,
  analysis: AnalysisResult,
  risk: RiskAssessment,
): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [
    ...detectSoDConflicts(analysis),
    ...detectExcessivePermissions(analysis, risk),
    ...detectRoleOverlaps(analysis),
    ...detectHighRiskUsers(risk),
    ...detectOperationalRisks(analysis),
  ];

  // Sort by severity (critical first), then confidence
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  insights.sort((a, b) => {
    const sd = severityOrder[a.severity] - severityOrder[b.severity];
    return sd !== 0 ? sd : b.confidence - a.confidence;
  });

  return insights;
}
