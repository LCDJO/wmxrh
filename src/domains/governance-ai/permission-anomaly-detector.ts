/**
 * PermissionAnomalyDetector — Detects permission anomalies across the access graph.
 *
 * Detections:
 *  1. Duplicate/redundant roles — users with roles that grant identical permissions
 *  2. Unused permissions         — permissions with zero active user assignments
 *  3. Role conflicts             — roles with contradictory scopes on the same user
 *  4. Excessive permissions      — users exceeding critical permission thresholds
 *  5. Operational risks          — high-severity operational risk signals
 */

import type { UnifiedGraphSnapshot, UnifiedNode, UnifiedEdge } from '@/domains/security/kernel/unified-graph-engine/types';
import type { AnalysisResult, RoleOverlap } from '@/domains/security/kernel/unified-graph-engine/graph-analyzer';
import type { RiskAssessment } from '@/domains/security/kernel/unified-graph-engine/types';
import type { GovernanceInsight } from './types';
import { insightId, buildRemediation } from './utils';

// ── Thresholds ──────────────────────────────────────────────────

const CRITICAL_PERM_THRESHOLD = 5;
const DUPLICATE_ROLE_OVERLAP = 0.9; // ≥90% overlap = effectively duplicate

// ── 1. Duplicate / Redundant Roles per User ─────────────────────

function detectDuplicateRoles(
  snapshot: UnifiedGraphSnapshot,
  analysis: AnalysisResult,
): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];

  // Find role overlaps that are near-duplicates (≥90%)
  const duplicates = analysis.roleOverlaps.filter(o => o.overlapRatio >= DUPLICATE_ROLE_OVERLAP);

  // For each near-duplicate pair, find users who hold BOTH roles
  for (const dup of duplicates) {
    const usersWithBoth = findUsersHoldingBothRoles(snapshot, dup);

    for (const user of usersWithBoth) {
      insights.push({
        id: insightId(),
        category: 'role_overlap',
        severity: 'warning',
        title: `Roles duplicadas: ${user.label}`,
        description: `Usuário possui "${dup.roleA.label}" e "${dup.roleB.label}" que compartilham ${Math.round(dup.overlapRatio * 100)}% das permissões. Uma delas é redundante.`,
        affected_entities: [
          { type: 'user', id: user.originalId, label: user.label, domain: user.domain },
          { type: 'role', id: dup.roleA.originalId, label: dup.roleA.label, domain: dup.roleA.domain },
          { type: 'role', id: dup.roleB.originalId, label: dup.roleB.label, domain: dup.roleB.domain },
        ],
        recommendation: `Remover a role com menor escopo ("${dup.roleB.label}") pois suas permissões já estão cobertas.`,
        auto_remediable: true,
        remediation_action: buildRemediation(
          'remove_role',
          `Remover role redundante "${dup.roleB.label}" do usuário ${user.label}`,
          `Elimina redundância sem impacto funcional`,
          [
            { order: 1, action: 'compare_permissions', target: dup.roleB.originalId, details: `Confirmar que todas as ${dup.sharedPermissions.length} permissões compartilhadas estão cobertas por "${dup.roleA.label}"` },
            { order: 2, action: 'remove_role', target: dup.roleB.originalId, details: `Remover "${dup.roleB.label}" do usuário` },
          ],
        ),
        confidence: 0.9,
        detected_at: Date.now(),
        source: 'heuristic',
        metadata: {
          overlap_ratio: dup.overlapRatio,
          shared_permissions: dup.sharedPermissions.length,
        },
      });
    }
  }

  return insights;
}

function findUsersHoldingBothRoles(
  snapshot: UnifiedGraphSnapshot,
  overlap: RoleOverlap,
): UnifiedNode[] {
  const roleAUid = findNodeUid(snapshot, overlap.roleA.originalId);
  const roleBUid = findNodeUid(snapshot, overlap.roleB.originalId);
  if (!roleAUid || !roleBUid) return [];

  // Build user→roles map from edges
  const userRoles = new Map<string, Set<string>>();
  for (const edge of snapshot.edges) {
    if (edge.relation === 'HAS_ROLE' || edge.relation === 'HAS_PLATFORM_ROLE' || edge.relation === 'HAS_TENANT_ROLE') {
      if (!userRoles.has(edge.from)) userRoles.set(edge.from, new Set());
      userRoles.get(edge.from)!.add(edge.to);
    }
  }

  const result: UnifiedNode[] = [];
  for (const [userUid, roles] of userRoles) {
    if (roles.has(roleAUid) && roles.has(roleBUid)) {
      const node = snapshot.nodes.get(userUid);
      if (node) result.push(node);
    }
  }

  return result;
}

function findNodeUid(snapshot: UnifiedGraphSnapshot, originalId: string): string | undefined {
  for (const [uid, node] of snapshot.nodes) {
    if (node.originalId === originalId) return uid;
  }
  return undefined;
}

// ── 2. Unused Permissions ───────────────────────────────────────

function detectUnusedPermissions(snapshot: UnifiedGraphSnapshot): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];

  // Find all permission nodes
  const permissionNodes: UnifiedNode[] = [];
  for (const node of snapshot.nodes.values()) {
    if (node.type === 'permission') permissionNodes.push(node);
  }

  // Find which permissions are actually assigned (targets of grants_permission edges)
  const assignedPerms = new Set<string>();
  for (const edge of snapshot.edges) {
    if (edge.relation === 'GRANTS_PERMISSION' || edge.relation === 'PLATFORM_GRANTS' || edge.relation === 'TENANT_GRANTS') {
      assignedPerms.add(edge.to);
    }
  }

  // Permissions that exist but are never granted to any role
  const orphanedPerms = permissionNodes.filter(p => {
    const uid = findNodeUidByRef(snapshot, p);
    return uid ? !assignedPerms.has(uid) : false;
  });

  if (orphanedPerms.length > 0) {
    insights.push({
      id: insightId(),
      category: 'orphaned_role',
      severity: orphanedPerms.length >= 10 ? 'warning' : 'info',
      title: `${orphanedPerms.length} permissão(ões) não atribuída(s)`,
      description: `Permissões definidas mas não vinculadas a nenhum cargo: ${orphanedPerms.slice(0, 5).map(p => p.label).join(', ')}${orphanedPerms.length > 5 ? ` e mais ${orphanedPerms.length - 5}` : ''}.`,
      affected_entities: orphanedPerms.slice(0, 10).map(p => ({
        type: 'permission' as const,
        id: p.originalId,
        label: p.label,
        domain: p.domain,
      })),
      recommendation: 'Revisar permissões órfãs e remover as obsoletas para reduzir superfície de ataque.',
      auto_remediable: false,
      confidence: 0.75,
      detected_at: Date.now(),
      source: 'heuristic',
      metadata: { orphaned_count: orphanedPerms.length },
    });
  }

  return insights;
}

function findNodeUidByRef(snapshot: UnifiedGraphSnapshot, node: UnifiedNode): string | undefined {
  for (const [uid, n] of snapshot.nodes) {
    if (n === node) return uid;
  }
  return undefined;
}

// ── 3. Role Conflicts (scope contradictions) ────────────────────

function detectRoleConflicts(
  snapshot: UnifiedGraphSnapshot,
  analysis: AnalysisResult,
): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];

  // Users with roles from different domains (e.g. platform role + tenant role with conflicting scope)
  const userRoles = new Map<string, { node: UnifiedNode; roles: UnifiedNode[] }>();

  const roleRelations = new Set(['HAS_ROLE', 'HAS_PLATFORM_ROLE', 'HAS_TENANT_ROLE'] as const);
  for (const edge of snapshot.edges) {
    if (!(roleRelations as Set<string>).has(edge.relation)) continue;
    const userNode = snapshot.nodes.get(edge.from);
    const roleNode = snapshot.nodes.get(edge.to);
    if (!userNode || !roleNode || (userNode.type !== 'platform_user' && userNode.type !== 'tenant_user')) continue;

    if (!userRoles.has(edge.from)) userRoles.set(edge.from, { node: userNode, roles: [] });
    userRoles.get(edge.from)!.roles.push(roleNode);
  }

  for (const [, { node: user, roles }] of userRoles) {
    // Check for scope contradictions: read_only + admin-level role
    const hasReadOnly = roles.some(r => r.label.toLowerCase().includes('read_only') || r.label.toLowerCase().includes('readonly'));
    const hasAdmin = roles.some(r =>
      r.label.toLowerCase().includes('admin') ||
      r.label.toLowerCase().includes('super') ||
      r.label.toLowerCase().includes('operations'),
    );

    if (hasReadOnly && hasAdmin) {
      insights.push({
        id: insightId(),
        category: 'anomalous_pattern',
        severity: 'warning',
        title: `Conflito de escopo: ${user.label}`,
        description: `Usuário possui simultaneamente um cargo read-only e um cargo administrativo, criando ambiguidade de permissões.`,
        affected_entities: [
          { type: 'user', id: user.originalId, label: user.label, domain: user.domain },
          ...roles.map(r => ({ type: 'role' as const, id: r.originalId, label: r.label, domain: r.domain })),
        ],
        recommendation: 'Remover o cargo read-only ou o cargo administrativo para eliminar ambiguidade.',
        auto_remediable: true,
        remediation_action: buildRemediation(
          'remove_role',
          `Resolver conflito de escopo para ${user.label}`,
          `Elimina ambiguidade de permissões`,
          [
            { order: 1, action: 'identify_intent', target: user.originalId, details: 'Determinar se o usuário deve ter acesso read-only ou administrativo' },
            { order: 2, action: 'remove_role', target: 'conflicting_role', details: 'Remover o cargo que contradiz a intenção' },
          ],
        ),
        confidence: 0.88,
        detected_at: Date.now(),
        source: 'heuristic',
      });
    }
  }

  return insights;
}

// ── 4. Excessive Permissions (preserved) ────────────────────────

export function detectExcessivePermissions(
  _analysis: AnalysisResult,
  risk: RiskAssessment,
): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];

  for (const userScore of risk.userScores) {
    if (userScore.factors.criticalPermissionCount >= CRITICAL_PERM_THRESHOLD) {
      insights.push({
        id: insightId(),
        category: 'excessive_permissions',
        severity: userScore.factors.criticalPermissionCount >= 8 ? 'critical' : 'warning',
        title: `Permissões excessivas: ${userScore.userLabel}`,
        description: `Usuário possui ${userScore.factors.criticalPermissionCount} permissões críticas. O princípio de menor privilégio recomenda no máximo ${CRITICAL_PERM_THRESHOLD - 1}.`,
        affected_entities: [
          { type: 'user', id: userScore.userUid, label: userScore.userLabel },
        ],
        recommendation: 'Revisar e remover permissões não utilizadas nos últimos 30 dias.',
        auto_remediable: false,
        confidence: 0.85,
        detected_at: Date.now(),
        source: 'heuristic',
        metadata: { critical_permission_count: userScore.factors.criticalPermissionCount },
      });
    }
  }

  return insights;
}

// ── 5. Operational Risks (preserved) ────────────────────────────

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

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Run all permission anomaly detections.
 */
export function detectPermissionAnomalies(
  snapshot: UnifiedGraphSnapshot,
  analysis: AnalysisResult,
  risk: RiskAssessment,
): GovernanceInsight[] {
  return [
    ...detectDuplicateRoles(snapshot, analysis),
    ...detectUnusedPermissions(snapshot),
    ...detectRoleConflicts(snapshot, analysis),
    ...detectExcessivePermissions(analysis, risk),
    ...detectOperationalRisks(analysis),
  ];
}
