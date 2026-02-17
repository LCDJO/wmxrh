/**
 * RoleOptimizationAdvisor — Detects role overlaps and suggests consolidation.
 *
 * Identifies roles with high permission overlap ratios and recommends merging.
 */

import type { AnalysisResult } from '@/domains/security/kernel/unified-graph-engine/graph-analyzer';
import type { GovernanceInsight } from './types';
import { insightId, buildRemediation } from './utils';

export function detectRoleOverlaps(analysis: AnalysisResult): GovernanceInsight[] {
  return analysis.roleOverlaps
    .filter(overlap => overlap.overlapRatio >= 0.6)
    .map(overlap => ({
      id: insightId(),
      category: 'role_overlap' as const,
      severity: overlap.overlapRatio >= 0.8 ? 'warning' as const : 'info' as const,
      title: `Sobreposição de cargos: ${overlap.roleA.label} ↔ ${overlap.roleB.label}`,
      description: `${Math.round(overlap.overlapRatio * 100)}% das permissões são compartilhadas. Considere consolidar.`,
      affected_entities: [
        { type: 'role' as const, id: overlap.roleA.originalId, label: overlap.roleA.label, domain: overlap.roleA.domain },
        { type: 'role' as const, id: overlap.roleB.originalId, label: overlap.roleB.label, domain: overlap.roleB.domain },
      ],
      recommendation: `Consolidar em um único cargo ou definir diferenciação clara.`,
      auto_remediable: true,
      remediation_action: buildRemediation(
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
      source: 'heuristic' as const,
    }));
}
