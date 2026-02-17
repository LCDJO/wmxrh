/**
 * SegregationOfDutiesChecker — Detects SoD conflicts in the access graph.
 *
 * Identifies users holding conflicting roles that violate separation of duties.
 */

import type { AnalysisResult } from '@/domains/security/kernel/unified-graph-engine/graph-analyzer';
import type { GovernanceInsight } from './types';
import { insightId, buildRemediation } from './utils';

export function detectSoDConflicts(analysis: AnalysisResult): GovernanceInsight[] {
  return analysis.accessConflicts.map(conflict => ({
    id: insightId(),
    category: 'sod_conflict' as const,
    severity: 'critical' as const,
    title: `Conflito SoD: ${conflict.user.label}`,
    description: `Usuário possui cargos conflitantes: ${conflict.rule}. Isso viola o princípio de segregação de funções.`,
    affected_entities: [
      { type: 'user' as const, id: conflict.user.originalId, label: conflict.user.label, domain: conflict.user.domain },
      ...conflict.roles.map(r => ({ type: 'role' as const, id: r.originalId, label: r.label, domain: r.domain })),
    ],
    recommendation: `Remover um dos cargos conflitantes ou criar um cargo combinado com restrições adequadas.`,
    auto_remediable: true,
    remediation_action: buildRemediation(
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
