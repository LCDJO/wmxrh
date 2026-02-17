/**
 * RoleOptimizationAdvisor — Suggests role splits, merges, and permission cleanup.
 *
 * Detections:
 *  1. Role overlaps       → roles sharing ≥60% permissions → merge suggestion
 *  2. Large roles         → roles with ≥15 permissions → split suggestion
 *  3. Redundant perms     → permissions already inherited via role hierarchy
 */

import type { UnifiedGraphSnapshot, UnifiedNode, UnifiedEdge } from '@/domains/security/kernel/unified-graph-engine/types';
import type { AnalysisResult, ExcessivePermission } from '@/domains/security/kernel/unified-graph-engine/graph-analyzer';
import type { GovernanceInsight } from './types';
import { insightId, buildRemediation } from './utils';

// ── Thresholds ──────────────────────────────────────────────────

const OVERLAP_MERGE_THRESHOLD = 0.6;
const LARGE_ROLE_PERMISSION_COUNT = 15;

// ── Public types ────────────────────────────────────────────────

export interface RoleOptimizationHint {
  type: 'merge' | 'split' | 'remove_redundant';
  severity: 'info' | 'warning';
  roles: Array<{ id: string; label: string; permissionCount: number }>;
  description: string;
  estimated_reduction: number; // permissions that would be eliminated
}

// ── 1. Overlap → Merge Suggestions ──────────────────────────────

function detectRoleOverlapInsights(analysis: AnalysisResult): GovernanceInsight[] {
  return analysis.roleOverlaps
    .filter(overlap => overlap.overlapRatio >= OVERLAP_MERGE_THRESHOLD)
    .map(overlap => ({
      id: insightId(),
      category: 'role_overlap' as const,
      severity: overlap.overlapRatio >= 0.8 ? 'warning' as const : 'info' as const,
      title: `Sobreposição de cargos: ${overlap.roleA.label} ↔ ${overlap.roleB.label}`,
      description: `${Math.round(overlap.overlapRatio * 100)}% das permissões são compartilhadas (${overlap.sharedPermissions.length} permissões). Considere consolidar.`,
      affected_entities: [
        { type: 'role' as const, id: overlap.roleA.originalId, label: overlap.roleA.label, domain: overlap.roleA.domain },
        { type: 'role' as const, id: overlap.roleB.originalId, label: overlap.roleB.label, domain: overlap.roleB.domain },
      ],
      recommendation: `Consolidar em um único cargo ou definir diferenciação clara entre as ${overlap.sharedPermissions.length} permissões compartilhadas.`,
      auto_remediable: true,
      remediation_action: buildRemediation(
        'merge_roles',
        `Consolidar "${overlap.roleA.label}" e "${overlap.roleB.label}"`,
        `Simplifica a gestão de acesso e reduz superfície de ataque`,
        [
          { order: 1, action: 'analyze_unique_permissions', target: overlap.roleA.originalId, details: `Identificar permissões exclusivas de "${overlap.roleA.label}"` },
          { order: 2, action: 'analyze_unique_permissions', target: overlap.roleB.originalId, details: `Identificar permissões exclusivas de "${overlap.roleB.label}"` },
          { order: 3, action: 'create_merged_role', target: 'new_role', details: 'Criar cargo consolidado com permissões unificadas' },
          { order: 4, action: 'migrate_users', target: 'affected_users', details: 'Migrar usuários para o novo cargo' },
          { order: 5, action: 'deactivate_old_roles', target: 'old_roles', details: 'Desativar cargos antigos após migração' },
        ],
      ),
      confidence: 0.8 + (overlap.overlapRatio - 0.6) * 0.25, // 0.8–0.9
      detected_at: Date.now(),
      source: 'heuristic' as const,
      metadata: {
        hint_type: 'merge',
        overlap_ratio: overlap.overlapRatio,
        shared_count: overlap.sharedPermissions.length,
      },
    }));
}

// ── 2. Large Roles → Split Suggestions ──────────────────────────

function detectLargeRoles(snapshot: UnifiedGraphSnapshot): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];

  // Count permissions per role
  const rolePermCount = new Map<string, { node: UnifiedNode; perms: string[] }>();

  for (const edge of snapshot.edges) {
    if (edge.relation !== 'GRANTS_PERMISSION' && edge.relation !== 'PLATFORM_GRANTS' && edge.relation !== 'TENANT_GRANTS') continue;
    const roleNode = snapshot.nodes.get(edge.from);
    if (!roleNode || roleNode.type !== 'role') continue;

    if (!rolePermCount.has(edge.from)) rolePermCount.set(edge.from, { node: roleNode, perms: [] });
    rolePermCount.get(edge.from)!.perms.push(edge.to);
  }

  for (const [, { node: role, perms }] of rolePermCount) {
    if (perms.length < LARGE_ROLE_PERMISSION_COUNT) continue;

    // Suggest splitting into functional groups
    const permNodes = perms
      .map(uid => snapshot.nodes.get(uid))
      .filter((n): n is UnifiedNode => !!n);

    // Group by permission prefix (e.g. "users.read" → "users")
    const groups = new Map<string, string[]>();
    for (const p of permNodes) {
      const prefix = p.label.split('.')[0] || p.label.split(':')[0] || 'general';
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix)!.push(p.label);
    }

    const groupList = Array.from(groups.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);

    insights.push({
      id: insightId(),
      category: 'excessive_permissions',
      severity: perms.length >= 25 ? 'warning' : 'info',
      title: `Cargo muito amplo: ${role.label} (${perms.length} permissões)`,
      description: `Cargo possui ${perms.length} permissões distribuídas em ${groups.size} grupo(s) funcional(is): ${groupList.map(([g, p]) => `${g} (${p.length})`).join(', ')}. Considere dividir.`,
      affected_entities: [
        { type: 'role', id: role.originalId, label: role.label, domain: role.domain },
      ],
      recommendation: `Dividir em ${Math.min(groups.size, 3)} cargos menores organizados por domínio funcional.`,
      auto_remediable: false,
      confidence: 0.82,
      detected_at: Date.now(),
      source: 'heuristic',
      metadata: {
        hint_type: 'split',
        permission_count: perms.length,
        functional_groups: Object.fromEntries(groupList),
      },
    });
  }

  return insights;
}

// ── 3. Redundant Permissions ────────────────────────────────────

function detectRedundantPermissions(snapshot: UnifiedGraphSnapshot): GovernanceInsight[] {
  const insights: GovernanceInsight[] = [];

  // Build role inheritance tree
  const roleInherits = new Map<string, string[]>(); // child → parents
  for (const edge of snapshot.edges) {
    if (edge.relation !== 'INHERITS_ROLE' && edge.relation !== 'PLATFORM_INHERITS') continue;
    if (!roleInherits.has(edge.from)) roleInherits.set(edge.from, []);
    roleInherits.get(edge.from)!.push(edge.to);
  }

  // For each role, get direct permissions
  const roleDirectPerms = new Map<string, Set<string>>();
  for (const edge of snapshot.edges) {
    if (edge.relation !== 'GRANTS_PERMISSION' && edge.relation !== 'PLATFORM_GRANTS' && edge.relation !== 'TENANT_GRANTS') continue;
    if (!roleDirectPerms.has(edge.from)) roleDirectPerms.set(edge.from, new Set());
    roleDirectPerms.get(edge.from)!.add(edge.to);
  }

  // Resolve inherited permissions (BFS up the hierarchy)
  function getInheritedPerms(roleUid: string, visited = new Set<string>()): Set<string> {
    const inherited = new Set<string>();
    const parents = roleInherits.get(roleUid) || [];
    for (const parentUid of parents) {
      if (visited.has(parentUid)) continue;
      visited.add(parentUid);
      const parentPerms = roleDirectPerms.get(parentUid) || new Set();
      for (const p of parentPerms) inherited.add(p);
      // Recursive
      for (const p of getInheritedPerms(parentUid, visited)) inherited.add(p);
    }
    return inherited;
  }

  // Find roles where direct perms overlap with inherited perms
  for (const [roleUid, directPerms] of roleDirectPerms) {
    const parents = roleInherits.get(roleUid);
    if (!parents || parents.length === 0) continue;

    const inheritedPerms = getInheritedPerms(roleUid);
    const redundant: string[] = [];
    for (const perm of directPerms) {
      if (inheritedPerms.has(perm)) redundant.push(perm);
    }

    if (redundant.length === 0) continue;

    const roleNode = snapshot.nodes.get(roleUid);
    if (!roleNode) continue;

    const redundantLabels = redundant
      .map(uid => snapshot.nodes.get(uid)?.label || uid)
      .slice(0, 8);

    insights.push({
      id: insightId(),
      category: 'role_overlap',
      severity: redundant.length >= 5 ? 'warning' : 'info',
      title: `Permissões redundantes: ${roleNode.label}`,
      description: `${redundant.length} permissão(ões) já herdada(s) de cargo pai: ${redundantLabels.join(', ')}${redundant.length > 8 ? '...' : ''}.`,
      affected_entities: [
        { type: 'role', id: roleNode.originalId, label: roleNode.label, domain: roleNode.domain },
      ],
      recommendation: `Remover ${redundant.length} permissão(ões) direta(s) que já são fornecidas via herança de cargo.`,
      auto_remediable: true,
      remediation_action: buildRemediation(
        'remove_permission',
        `Remover ${redundant.length} permissões redundantes de "${roleNode.label}"`,
        `Simplifica o cargo sem impacto funcional — permissões já cobertas por herança`,
        redundant.slice(0, 5).map((permUid, i) => ({
          order: i + 1,
          action: 'remove_direct_grant',
          target: permUid,
          details: `Remover grant direto de "${snapshot.nodes.get(permUid)?.label || permUid}"`,
        })),
      ),
      confidence: 0.92,
      detected_at: Date.now(),
      source: 'heuristic',
      metadata: {
        hint_type: 'remove_redundant',
        redundant_count: redundant.length,
        redundant_labels: redundantLabels,
      },
    });
  }

  return insights;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Extract structured optimization hints for UI display.
 */
export function buildOptimizationHints(
  snapshot: UnifiedGraphSnapshot,
  analysis: AnalysisResult,
): RoleOptimizationHint[] {
  const hints: RoleOptimizationHint[] = [];

  // Merge hints from overlaps
  for (const overlap of analysis.roleOverlaps.filter(o => o.overlapRatio >= OVERLAP_MERGE_THRESHOLD)) {
    hints.push({
      type: 'merge',
      severity: overlap.overlapRatio >= 0.8 ? 'warning' : 'info',
      roles: [
        { id: overlap.roleA.originalId, label: overlap.roleA.label, permissionCount: overlap.sharedPermissions.length },
        { id: overlap.roleB.originalId, label: overlap.roleB.label, permissionCount: overlap.sharedPermissions.length },
      ],
      description: `${Math.round(overlap.overlapRatio * 100)}% overlap — consolidar`,
      estimated_reduction: overlap.sharedPermissions.length,
    });
  }

  // Split hints from large roles
  const rolePermCounts = new Map<string, number>();
  for (const edge of snapshot.edges) {
    if (edge.relation === 'GRANTS_PERMISSION' || edge.relation === 'PLATFORM_GRANTS' || edge.relation === 'TENANT_GRANTS') {
      rolePermCounts.set(edge.from, (rolePermCounts.get(edge.from) ?? 0) + 1);
    }
  }
  for (const [uid, count] of rolePermCounts) {
    if (count < LARGE_ROLE_PERMISSION_COUNT) continue;
    const node = snapshot.nodes.get(uid);
    if (!node || node.type !== 'role') continue;
    hints.push({
      type: 'split',
      severity: count >= 25 ? 'warning' : 'info',
      roles: [{ id: node.originalId, label: node.label, permissionCount: count }],
      description: `${count} permissões — dividir em cargos menores`,
      estimated_reduction: Math.floor(count * 0.3),
    });
  }

  return hints;
}

/**
 * Generate governance insights from role optimization analysis.
 */
export function detectRoleOverlaps(analysis: AnalysisResult, snapshot?: UnifiedGraphSnapshot): GovernanceInsight[] {
  const insights = [...detectRoleOverlapInsights(analysis)];

  if (snapshot) {
    insights.push(...detectLargeRoles(snapshot));
    insights.push(...detectRedundantPermissions(snapshot));
  }

  return insights;
}
