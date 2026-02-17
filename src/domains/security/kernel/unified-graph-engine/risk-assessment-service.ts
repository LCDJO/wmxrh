/**
 * RiskAssessmentService — Evaluates governance risks from the unified graph.
 *
 * Consumes GraphAnalyzer results and produces risk signals:
 *   - Permissões excessivas
 *   - Conflitos de acesso (separation of duty)
 *   - Sobreposição de cargos
 *   - Risco operacional (orphans, depth, unused)
 *   - Super admin count
 *   - Cross-domain users
 */

import type {
  UnifiedGraphSnapshot,
  UnifiedNode,
  UnifiedEdge,
  RiskAssessment,
  RiskSignal,
  RiskLevel,
  UserRiskScore,
  UnifiedEdgeRelation,
} from './types';
import { analyzeGraph } from './graph-analyzer';

const MAX_SUPER_ADMINS = 3;

export function assessRisk(snapshot: UnifiedGraphSnapshot): RiskAssessment {
  const analysis = analyzeGraph(snapshot);
  const signals: RiskSignal[] = [];

  // ── 1. Permissões excessivas ──
  for (const ep of analysis.excessivePermissions) {
    signals.push({
      id: `excessive_perms_${ep.user.uid}`,
      level: 'high',
      domain: ep.user.domain,
      title: 'Permissões excessivas',
      detail: `Usuário "${ep.user.label}" possui ${ep.permissionCount} permissões resolvidas — avaliar princípio do menor privilégio.`,
      affectedNodeUids: [ep.user.uid, ...ep.permissions.map(p => p.uid)],
    });
  }

  // ── 2. Conflitos de acesso ──
  for (const conflict of analysis.accessConflicts) {
    signals.push({
      id: `access_conflict_${conflict.user.uid}_${conflict.rule}`,
      level: conflict.severity === 'critical' ? 'critical' : 'high',
      domain: conflict.user.domain,
      title: `Conflito: ${conflict.rule}`,
      detail: `${conflict.detail}. Usuário: "${conflict.user.label}", Cargos: ${conflict.roles.map(r => r.label).join(' + ')}.`,
      affectedNodeUids: [conflict.user.uid, ...conflict.roles.map(r => r.uid)],
    });
  }

  // ── 3. Sobreposição entre cargos ──
  for (const overlap of analysis.roleOverlaps) {
    signals.push({
      id: `role_overlap_${overlap.roleA.uid}_${overlap.roleB.uid}`,
      level: overlap.overlapRatio >= 0.95 ? 'high' : 'medium',
      domain: overlap.roleA.domain,
      title: 'Sobreposição de cargos',
      detail: `"${overlap.roleA.label}" e "${overlap.roleB.label}" compartilham ${(overlap.overlapRatio * 100).toFixed(0)}% das permissões (${overlap.sharedPermissions.length} em comum). Considerar consolidação.`,
      affectedNodeUids: [overlap.roleA.uid, overlap.roleB.uid],
    });
  }

  // ── 4. Riscos operacionais ──
  for (const risk of analysis.operationalRisks) {
    signals.push({
      id: risk.id,
      level: risk.level,
      domain: 'platform_access',
      title: risk.title,
      detail: risk.detail,
      affectedNodeUids: risk.affectedUids,
    });
  }

  // ── 5. Orphan nodes ──
  if (analysis.orphanNodes.length > 0) {
    signals.push({
      id: 'orphan_nodes',
      level: 'medium',
      domain: analysis.orphanNodes[0].domain,
      title: 'Nós órfãos detectados',
      detail: `${analysis.orphanNodes.length} nó(s) sem conexão: ${analysis.orphanNodes.slice(0, 5).map(n => n.label).join(', ')}`,
      affectedNodeUids: analysis.orphanNodes.map(n => n.uid),
    });
  }

  // ── 6. Super admin count ──
  const superAdmins = Array.from(snapshot.nodes.values()).filter(
    n => n.type === 'role' && n.meta?.slug === 'platform_super_admin',
  );
  const superAdminUserCount = snapshot.edges.filter(
    e => (e.relation === 'HAS_ROLE' || e.relation === 'HAS_PLATFORM_ROLE') && superAdmins.some(sa => sa.uid === e.to),
  ).length;

  if (superAdminUserCount > MAX_SUPER_ADMINS) {
    signals.push({
      id: 'excess_super_admins',
      level: 'critical',
      domain: 'platform_access',
      title: 'Excesso de Super Admins',
      detail: `${superAdminUserCount} usuários com role Super Admin (máximo recomendado: ${MAX_SUPER_ADMINS}).`,
      affectedNodeUids: superAdmins.map(n => n.uid),
    });
  }

  // ── 7. Cross-domain users ──
  if (analysis.crossDomainUsers.length > 0) {
    signals.push({
      id: 'cross_domain_users',
      level: 'medium',
      domain: 'identity',
      title: 'Usuários multi-domínio',
      detail: `${analysis.crossDomainUsers.length} usuário(s) operam em Platform + Tenant simultaneamente. Verificar se MFA está habilitado.`,
      affectedNodeUids: analysis.crossDomainUsers.map(n => n.uid),
    });
  }

  // ════════════════════════════════════
  // USER RISK SCORES
  // ════════════════════════════════════
  const userScores = computeUserRiskScores(snapshot);

  // ── Determine overall level ──
  const overallLevel: RiskLevel = signals.some(s => s.level === 'critical')
    ? 'critical'
    : signals.some(s => s.level === 'high')
      ? 'high'
      : signals.some(s => s.level === 'medium')
        ? 'medium'
        : 'low';

  return {
    overallLevel,
    signals,
    userScores,
    assessedAt: Date.now(),
  };
}

// ════════════════════════════════════
// CRITICAL PERMISSION SLUGS
// ════════════════════════════════════

/** Permissions considered "critical" for risk scoring */
const CRITICAL_PERMISSION_SLUGS = new Set([
  // Platform-level
  'platform.manage', 'tenant.manage', 'tenant.delete',
  'users.impersonate', 'billing.manage', 'finance.manage',
  'system.configure', 'audit.manage',
  // Tenant-level
  'employees.delete', 'payroll.approve', 'payroll.manage',
  'agreements.manage', 'compliance.enforce',
]);

// ════════════════════════════════════
// SCORE COMPUTATION
// ════════════════════════════════════

const ROLE_RELATIONS: UnifiedEdgeRelation[] = ['HAS_ROLE', 'HAS_PLATFORM_ROLE', 'HAS_TENANT_ROLE'];
const GRANT_RELATIONS: UnifiedEdgeRelation[] = ['GRANTS_PERMISSION', 'PLATFORM_GRANTS', 'TENANT_GRANTS'];
const INHERIT_RELATIONS: UnifiedEdgeRelation[] = ['INHERITS_ROLE', 'PLATFORM_INHERITS'];

function computeUserRiskScores(snapshot: UnifiedGraphSnapshot): UserRiskScore[] {
  const { nodes, edges } = snapshot;
  const scores: UserRiskScore[] = [];

  // Pre-index: impersonation targets
  const impersonatingUsers = new Set<string>();
  for (const e of edges) {
    if (e.relation === 'IMPERSONATES') impersonatingUsers.add(e.from);
  }

  // Pre-index: user → tenant connections
  const userTenants = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.relation === 'BELONGS_TO' || e.relation === 'BELONGS_TO_TENANT') {
      const targetNode = nodes.get(e.to);
      if (targetNode?.type === 'tenant') {
        if (!userTenants.has(e.from)) userTenants.set(e.from, new Set());
        userTenants.get(e.from)!.add(e.to);
      }
    }
  }

  // Also check indirect: user → role (scoped to tenant)
  for (const e of edges) {
    if (ROLE_RELATIONS.includes(e.relation)) {
      const roleNode = nodes.get(e.to);
      if (roleNode?.meta?.tenantId) {
        if (!userTenants.has(e.from)) userTenants.set(e.from, new Set());
        userTenants.get(e.from)!.add(roleNode.meta.tenantId as string);
      }
    }
  }

  const userNodes = Array.from(nodes.values()).filter(
    n => n.type === 'platform_user' || n.type === 'tenant_user',
  );

  for (const user of userNodes) {
    // ── 1. Critical permissions (0–40) ──
    const permNodes = resolvePermissions(user.uid, nodes, edges);
    const criticalCount = permNodes.filter(p => {
      const slug = (p.meta?.slug as string) ?? (p.meta?.code as string) ?? p.originalId;
      return CRITICAL_PERMISSION_SLUGS.has(slug);
    }).length;
    // 0 → 0, 1 → 10, 2 → 18, 5 → 34, 6+ → 40
    const criticalPermissionScore = Math.min(40, Math.round(criticalCount * (40 / 6)));

    // ── 2. Multi-tenant access (0–30) ──
    const tenantCount = userTenants.get(user.uid)?.size ?? 0;
    // Also check identity links
    const identityLinkedTenants = new Set<string>();
    for (const e of edges) {
      if (e.from === user.uid && e.relation === 'IDENTITY_LINK') {
        // Follow to tenant_access user, then check their tenants
        const linkedTenants = userTenants.get(e.to);
        if (linkedTenants) linkedTenants.forEach(t => identityLinkedTenants.add(t));
      }
    }
    const totalTenants = Math.max(tenantCount, identityLinkedTenants.size);
    // 0–1 → 0, 2 → 10, 3 → 18, 4+ → 30
    const multiTenantScore = totalTenants <= 1 ? 0 : Math.min(30, Math.round((totalTenants - 1) * 10));

    // ── 3. Active impersonation (0–30) ──
    // Check if this user's identity node has IMPERSONATES edge
    const hasImpersonation = impersonatingUsers.has(user.uid) ||
      Array.from(edges).some(
        e => e.relation === 'IMPERSONATES' &&
          nodes.get(e.from)?.originalId === user.originalId,
      );
    const impersonationScore = hasImpersonation ? 30 : 0;

    // ── Total ──
    const score = criticalPermissionScore + multiTenantScore + impersonationScore;
    const level: RiskLevel = score >= 70 ? 'critical'
      : score >= 45 ? 'high'
      : score >= 20 ? 'medium'
      : 'low';

    scores.push({
      userUid: user.uid,
      userLabel: user.label,
      domain: user.domain,
      score,
      level,
      factors: {
        criticalPermissionCount: criticalCount,
        criticalPermissionScore,
        multiTenantCount: totalTenants,
        multiTenantScore,
        hasActiveImpersonation: hasImpersonation,
        impersonationScore,
      },
    });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores;
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

function resolvePermissions(
  userUid: string,
  nodes: ReadonlyMap<string, UnifiedNode>,
  edges: readonly UnifiedEdge[],
): UnifiedNode[] {
  const roleUids = new Set<string>();
  const queue: string[] = [];

  for (const e of edges) {
    if (e.from === userUid && ROLE_RELATIONS.includes(e.relation)) {
      roleUids.add(e.to);
      queue.push(e.to);
    }
  }

  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const e of edges) {
      if (e.from === current && INHERIT_RELATIONS.includes(e.relation) && !roleUids.has(e.to)) {
        roleUids.add(e.to);
        queue.push(e.to);
      }
    }
  }

  const permSet = new Set<string>();
  for (const e of edges) {
    if (roleUids.has(e.from) && GRANT_RELATIONS.includes(e.relation)) {
      permSet.add(e.to);
    }
  }

  return Array.from(permSet)
    .map(uid => nodes.get(uid))
    .filter((n): n is UnifiedNode => n !== undefined && n.type === 'permission');
}
