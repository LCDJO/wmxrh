/**
 * GraphAnalyzer — Structural & governance analysis over the unified graph.
 *
 * Detects:
 *   1. Permissões excessivas    → users with too many direct permission edges
 *   2. Conflitos de acesso      → forbidden role×permission combos (e.g. Support + Finance)
 *   3. Sobreposição entre cargos → roles that grant identical permission sets
 *   4. Risco operacional        → orphans, depth, fan-out, cross-domain overlap
 */

import type {
  UnifiedGraphSnapshot,
  UnifiedNode,
  UnifiedEdge,
  GraphDomain,
  UnifiedEdgeRelation,
} from './types';

// ════════════════════════════════════
// RESULT TYPES
// ════════════════════════════════════

export interface ExcessivePermission {
  user: UnifiedNode;
  permissionCount: number;
  permissions: UnifiedNode[];
}

export interface AccessConflict {
  user: UnifiedNode;
  roles: UnifiedNode[];
  /** Which policy was violated */
  rule: string;
  severity: 'warning' | 'critical';
  detail: string;
}

export interface RoleOverlap {
  roleA: UnifiedNode;
  roleB: UnifiedNode;
  /** Permissions shared by both roles */
  sharedPermissions: string[];
  /** 0..1 — 1 means identical permission sets */
  overlapRatio: number;
}

export interface OperationalRisk {
  id: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  detail: string;
  affectedUids: string[];
}

export interface AnalysisResult {
  // ── Original detections ──
  orphanNodes: UnifiedNode[];
  highFanOutNodes: Array<{ node: UnifiedNode; edgeCount: number }>;
  crossDomainUsers: UnifiedNode[];
  activeDomains: GraphDomain[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    avgFanOut: number;
    maxDepth: number;
  };

  // ── Enhanced detections ──
  excessivePermissions: ExcessivePermission[];
  accessConflicts: AccessConflict[];
  roleOverlaps: RoleOverlap[];
  operationalRisks: OperationalRisk[];
}

// ════════════════════════════════════
// THRESHOLDS
// ════════════════════════════════════

const HIGH_FAN_OUT_THRESHOLD = 10;
const EXCESSIVE_PERMISSION_THRESHOLD = 15;
const ROLE_OVERLAP_THRESHOLD = 0.8; // 80%+ shared permissions → flag

// ════════════════════════════════════
// CONFLICT POLICIES
// ════════════════════════════════════

/**
 * Separation-of-duty matrix: roles that must NEVER coexist on the same user.
 * Each entry: [roleSlugA, roleSlugB, humanReason]
 */
const CONFLICT_POLICIES: Array<[string, string, string]> = [
  ['platform_support', 'platform_finance', 'Suporte não deve ter acesso financeiro'],
  ['platform_support', 'platform_fiscal', 'Suporte não deve ter acesso fiscal'],
  ['platform_read_only', 'platform_super_admin', 'Read-only conflita com Super Admin'],
  ['platform_delegated_support', 'platform_finance', 'Suporte delegado não deve ter acesso financeiro'],
  ['platform_compliance', 'platform_operations', 'Compliance deve ser independente de Operations'],
];

// ════════════════════════════════════
// MAIN ANALYSIS
// ════════════════════════════════════

export function analyzeGraph(snapshot: UnifiedGraphSnapshot): AnalysisResult {
  const { nodes, edges } = snapshot;

  // ── Pre-compute adjacency structures ──
  const fanOut = new Map<string, number>();
  const hasIncoming = new Set<string>();
  const outEdges = new Map<string, UnifiedEdge[]>();

  for (const e of edges) {
    fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1);
    hasIncoming.add(e.to);
    if (!outEdges.has(e.from)) outEdges.set(e.from, []);
    outEdges.get(e.from)!.push(e);
  }

  // ════════════════════════════════════
  // 1. ORPHAN NODES
  // ════════════════════════════════════
  const orphanNodes: UnifiedNode[] = [];
  for (const [uid, node] of nodes) {
    if (!fanOut.has(uid) && !hasIncoming.has(uid)) {
      orphanNodes.push(node);
    }
  }

  // ════════════════════════════════════
  // 2. HIGH FAN-OUT
  // ════════════════════════════════════
  const highFanOutNodes: AnalysisResult['highFanOutNodes'] = [];
  for (const [uid, count] of fanOut) {
    if (count >= HIGH_FAN_OUT_THRESHOLD) {
      const node = nodes.get(uid);
      if (node) highFanOutNodes.push({ node, edgeCount: count });
    }
  }
  highFanOutNodes.sort((a, b) => b.edgeCount - a.edgeCount);

  // ════════════════════════════════════
  // 3. CROSS-DOMAIN USERS
  // ════════════════════════════════════
  const usersByDomain = new Map<string, Set<GraphDomain>>();
  for (const node of nodes.values()) {
    if (node.type === 'platform_user' || node.type === 'tenant_user' || node.type === 'identity_session') {
      const key = node.originalId;
      if (!usersByDomain.has(key)) usersByDomain.set(key, new Set());
      usersByDomain.get(key)!.add(node.domain);
    }
  }
  const crossDomainUsers: UnifiedNode[] = [];
  for (const [originalId, domains] of usersByDomain) {
    if (domains.has('platform_access') && domains.has('tenant_access')) {
      const node = Array.from(nodes.values()).find(
        n => n.originalId === originalId && n.domain === 'platform_access',
      );
      if (node) crossDomainUsers.push(node);
    }
  }

  // ════════════════════════════════════
  // 4. MAX DEPTH (BFS)
  // ════════════════════════════════════
  let maxDepth = 0;
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjacency.has(e.from)) adjacency.set(e.from, []);
    adjacency.get(e.from)!.push(e.to);
  }
  const roots = Array.from(nodes.keys()).filter(uid => !hasIncoming.has(uid));
  for (const root of roots) {
    const visited = new Set<string>();
    const queue: Array<{ uid: string; depth: number }> = [{ uid: root, depth: 0 }];
    while (queue.length > 0) {
      const { uid, depth } = queue.shift()!;
      if (visited.has(uid)) continue;
      visited.add(uid);
      if (depth > maxDepth) maxDepth = depth;
      for (const next of adjacency.get(uid) ?? []) {
        if (!visited.has(next)) queue.push({ uid: next, depth: depth + 1 });
      }
    }
  }

  // ════════════════════════════════════
  // 5. PERMISSÕES EXCESSIVAS
  // ════════════════════════════════════
  const excessivePermissions: ExcessivePermission[] = [];
  {
    // For each user node, count reachable permission nodes via HAS_ROLE → GRANTS_PERMISSION
    const userNodes = Array.from(nodes.values()).filter(
      n => n.type === 'platform_user' || n.type === 'tenant_user',
    );

    for (const user of userNodes) {
      const perms = resolveUserPermissions(user.uid, nodes, edges);
      if (perms.length >= EXCESSIVE_PERMISSION_THRESHOLD) {
        excessivePermissions.push({
          user,
          permissionCount: perms.length,
          permissions: perms,
        });
      }
    }
    excessivePermissions.sort((a, b) => b.permissionCount - a.permissionCount);
  }

  // ════════════════════════════════════
  // 6. CONFLITOS DE ACESSO
  // ════════════════════════════════════
  const accessConflicts: AccessConflict[] = [];
  {
    // Build user → roles map
    const userRoles = new Map<string, UnifiedNode[]>();
    for (const e of edges) {
      if (e.relation === 'HAS_ROLE' || e.relation === 'HAS_PLATFORM_ROLE' || e.relation === 'HAS_TENANT_ROLE') {
        const roleNode = nodes.get(e.to);
        if (!roleNode || roleNode.type !== 'role') continue;
        if (!userRoles.has(e.from)) userRoles.set(e.from, []);
        userRoles.get(e.from)!.push(roleNode);
      }
    }

    for (const [userUid, roles] of userRoles) {
      const userNode = nodes.get(userUid);
      if (!userNode) continue;

      const roleSlugs = roles.map(r => (r.meta?.slug as string) ?? r.originalId);

      for (const [slugA, slugB, reason] of CONFLICT_POLICIES) {
        if (roleSlugs.includes(slugA) && roleSlugs.includes(slugB)) {
          accessConflicts.push({
            user: userNode,
            roles: roles.filter(r => {
              const s = (r.meta?.slug as string) ?? r.originalId;
              return s === slugA || s === slugB;
            }),
            rule: `${slugA} ⊗ ${slugB}`,
            severity: 'critical',
            detail: reason,
          });
        }
      }
    }
  }

  // ════════════════════════════════════
  // 7. SOBREPOSIÇÃO ENTRE CARGOS
  // ════════════════════════════════════
  const roleOverlaps: RoleOverlap[] = [];
  {
    // Build role → permission UIDs
    const rolePermissions = new Map<string, Set<string>>();
    const roleNodes: UnifiedNode[] = [];

    for (const node of nodes.values()) {
      if (node.type === 'role') roleNodes.push(node);
    }

    for (const role of roleNodes) {
      const permUids = new Set<string>();
      for (const e of edges) {
        if (e.from === role.uid && (e.relation === 'GRANTS_PERMISSION' || e.relation === 'PLATFORM_GRANTS' || e.relation === 'TENANT_GRANTS')) {
          permUids.add(e.to);
        }
      }
      rolePermissions.set(role.uid, permUids);
    }

    // Pairwise comparison
    for (let i = 0; i < roleNodes.length; i++) {
      for (let j = i + 1; j < roleNodes.length; j++) {
        const a = roleNodes[i];
        const b = roleNodes[j];
        const permsA = rolePermissions.get(a.uid)!;
        const permsB = rolePermissions.get(b.uid)!;

        if (permsA.size === 0 && permsB.size === 0) continue;

        const shared = Array.from(permsA).filter(p => permsB.has(p));
        const union = new Set([...permsA, ...permsB]).size;
        const ratio = union > 0 ? shared.length / union : 0;

        if (ratio >= ROLE_OVERLAP_THRESHOLD && shared.length > 0) {
          roleOverlaps.push({
            roleA: a,
            roleB: b,
            sharedPermissions: shared.map(uid => nodes.get(uid)?.label ?? uid),
            overlapRatio: +ratio.toFixed(2),
          });
        }
      }
    }
    roleOverlaps.sort((a, b) => b.overlapRatio - a.overlapRatio);
  }

  // ════════════════════════════════════
  // 8. RISCO OPERACIONAL
  // ════════════════════════════════════
  const operationalRisks: OperationalRisk[] = [];

  // 8a. Orphan roles (roles with no users)
  const rolesWithUsers = new Set<string>();
  for (const e of edges) {
    if (e.relation === 'HAS_ROLE' || e.relation === 'HAS_PLATFORM_ROLE' || e.relation === 'HAS_TENANT_ROLE') {
      rolesWithUsers.add(e.to);
    }
  }
  const orphanRoles = Array.from(nodes.values()).filter(
    n => n.type === 'role' && !rolesWithUsers.has(n.uid),
  );
  if (orphanRoles.length > 0) {
    operationalRisks.push({
      id: 'orphan_roles',
      level: 'medium',
      title: 'Cargos sem usuários atribuídos',
      detail: `${orphanRoles.length} cargo(s) sem nenhum usuário: ${orphanRoles.slice(0, 5).map(r => r.label).join(', ')}. Considerar remoção ou atribuição.`,
      affectedUids: orphanRoles.map(r => r.uid),
    });
  }

  // 8b. Permissions not granted by any role
  const grantedPermissions = new Set<string>();
  for (const e of edges) {
    if (e.relation === 'GRANTS_PERMISSION' || e.relation === 'PLATFORM_GRANTS' || e.relation === 'TENANT_GRANTS') {
      grantedPermissions.add(e.to);
    }
  }
  const unusedPermissions = Array.from(nodes.values()).filter(
    n => n.type === 'permission' && !grantedPermissions.has(n.uid),
  );
  if (unusedPermissions.length > 0) {
    operationalRisks.push({
      id: 'unused_permissions',
      level: 'low',
      title: 'Permissões não utilizadas',
      detail: `${unusedPermissions.length} permissão(ões) não concedida(s) por nenhum cargo: ${unusedPermissions.slice(0, 5).map(p => p.label).join(', ')}.`,
      affectedUids: unusedPermissions.map(p => p.uid),
    });
  }

  // 8c. Deep inheritance chains (depth > 4)
  if (maxDepth > 4) {
    operationalRisks.push({
      id: 'deep_inheritance',
      level: 'high',
      title: 'Cadeia de herança profunda',
      detail: `Profundidade máxima do grafo: ${maxDepth} níveis. Cadeias longas dificultam auditoria e aumentam risco de privilege escalation.`,
      affectedUids: [],
    });
  }

  // 8d. Access conflicts surfaced as operational risks
  if (accessConflicts.length > 0) {
    operationalRisks.push({
      id: 'separation_of_duty_violations',
      level: 'critical',
      title: 'Violações de separação de funções',
      detail: `${accessConflicts.length} conflito(s) de acesso detectados. Ex: ${accessConflicts[0].detail}`,
      affectedUids: accessConflicts.flatMap(c => [c.user.uid, ...c.roles.map(r => r.uid)]),
    });
  }

  // ── Stats ──
  const totalEdges = edges.length;
  const totalNodes = nodes.size;

  return {
    orphanNodes,
    highFanOutNodes,
    crossDomainUsers,
    activeDomains: [...snapshot.domains],
    stats: {
      totalNodes,
      totalEdges,
      avgFanOut: totalNodes > 0 ? +(totalEdges / totalNodes).toFixed(2) : 0,
      maxDepth,
    },
    excessivePermissions,
    accessConflicts,
    roleOverlaps,
    operationalRisks,
  };
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

/**
 * BFS: user → (HAS_ROLE) → role → (GRANTS_PERMISSION) → permission
 * Returns all reachable permission nodes for a user.
 */
function resolveUserPermissions(
  userUid: string,
  nodes: ReadonlyMap<string, UnifiedNode>,
  edges: readonly UnifiedEdge[],
): UnifiedNode[] {
  const roleRelations: UnifiedEdgeRelation[] = ['HAS_ROLE', 'HAS_PLATFORM_ROLE', 'HAS_TENANT_ROLE'];
  const grantRelations: UnifiedEdgeRelation[] = ['GRANTS_PERMISSION', 'PLATFORM_GRANTS', 'TENANT_GRANTS'];
  const inheritRelations: UnifiedEdgeRelation[] = ['INHERITS_ROLE', 'PLATFORM_INHERITS'];

  // Step 1: find all roles (including inherited)
  const roleUids = new Set<string>();
  const queue: string[] = [];

  for (const e of edges) {
    if (e.from === userUid && roleRelations.includes(e.relation)) {
      roleUids.add(e.to);
      queue.push(e.to);
    }
  }

  // Follow inheritance
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const e of edges) {
      if (e.from === current && inheritRelations.includes(e.relation) && !roleUids.has(e.to)) {
        roleUids.add(e.to);
        queue.push(e.to);
      }
    }
  }

  // Step 2: collect permissions from all roles
  const permSet = new Set<string>();
  for (const e of edges) {
    if (roleUids.has(e.from) && grantRelations.includes(e.relation)) {
      permSet.add(e.to);
    }
  }

  return Array.from(permSet)
    .map(uid => nodes.get(uid))
    .filter((n): n is UnifiedNode => n !== undefined && n.type === 'permission');
}
