/**
 * PlatformAccessGraphService
 * 
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  GRAPH-BASED AUTHORIZATION FOR THE SAAS PLATFORM LEVEL          ║
 * ║                                                                  ║
 * ║  API:                                                            ║
 * ║    buildPlatformUserGraph(userId)  → PlatformAccessGraph        ║
 * ║    checkPlatformAccess(userId, action, resource) → result       ║
 * ║                                                                  ║
 * ║  Considers:                                                      ║
 * ║    • Platform roles (platform_users.role_id → platform_roles)   ║
 * ║    • Role inheritance (inherits_role_ids chain)                  ║
 * ║    • Access scopes (platform_access_scopes)                      ║
 * ║    • Permission matrix (platform_role_permissions)               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { PlatformPermission } from './platform-permissions';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export type PlatformNodeType = 'user' | 'role' | 'permission' | 'scope';

export type PlatformEdgeRelation =
  | 'HAS_ROLE'
  | 'INHERITS_ROLE'
  | 'GRANTS_PERMISSION'
  | 'HAS_SCOPE';

export interface PlatformGraphNode {
  id: string;
  type: PlatformNodeType;
  meta?: Record<string, unknown>;
}

export interface PlatformGraphEdge {
  from: string;
  to: string;
  relation: PlatformEdgeRelation;
}

export interface PlatformAccessCheckResult {
  allowed: boolean;
  reason: string;
  decidedBy: 'rbac' | 'scope' | 'inherited';
  /** Chain of roles that contributed (direct + inherited) */
  roleChain: string[];
}

export interface PlatformGraphInput {
  userId: string;
  /** The user's direct role */
  role: {
    id: string;
    slug: string;
    name: string;
    isSystemRole: boolean;
    inheritsRoleIds: string[] | null;
  };
  /** All platform roles (needed to resolve inheritance) */
  allRoles: Array<{
    id: string;
    slug: string;
    name: string;
    inheritsRoleIds: string[] | null;
  }>;
  /** Permission IDs assigned to each role */
  rolePermissions: Array<{
    roleId: string;
    permissionId: string;
  }>;
  /** Permission definitions */
  permissionDefs: Array<{
    id: string;
    code: string;
    module: string;
  }>;
  /** Access scopes for the user's role */
  scopes: Array<{
    id: string;
    roleId: string;
    scopeType: 'global' | 'platform_section';
    scopeId: string | null;
  }>;
}

// ════════════════════════════════════
// PRECOMPUTED CACHE
// ════════════════════════════════════

interface PlatformAccessCache {
  /** All effective role IDs (direct + inherited) */
  effectiveRoleIds: Set<string>;
  /** All effective role slugs */
  effectiveRoleSlugs: Set<string>;
  /** All permission codes this user has */
  effectivePermissions: Set<string>;
  /** Permission lookup: code → boolean */
  permissionLookup: Map<string, boolean>;
  /** Whether user has global scope (no restrictions) */
  hasGlobalScope: boolean;
  /** Platform sections the user can access */
  reachableSections: Set<string>;
  /** Role inheritance chain (for audit) */
  inheritanceChain: Array<{ roleId: string; roleSlug: string; inheritsFrom: string[] }>;
  builtAt: number;
}

// ════════════════════════════════════
// PLATFORM ACCESS GRAPH
// ════════════════════════════════════

export class PlatformAccessGraph {
  private nodes = new Map<string, PlatformGraphNode>();
  private edges: PlatformGraphEdge[] = [];
  private cache: PlatformAccessCache;

  constructor() {
    this.cache = createEmptyPlatformCache();
  }

  build(input: PlatformGraphInput): void {
    this.clear();

    // ── 1. User node ──
    this.addNode({ id: input.userId, type: 'user' });

    // ── 2. Direct role ──
    const directRoleNodeId = `role:${input.role.id}`;
    this.addNode({
      id: directRoleNodeId,
      type: 'role',
      meta: { slug: input.role.slug, name: input.role.name, isSystem: input.role.isSystemRole },
    });
    this.addEdge(input.userId, directRoleNodeId, 'HAS_ROLE');

    // ── 3. Resolve inheritance chain (BFS) ──
    const effectiveRoleIds = new Set<string>([input.role.id]);
    const effectiveRoleSlugs = new Set<string>([input.role.slug]);
    const inheritanceChain: PlatformAccessCache['inheritanceChain'] = [];
    const roleMap = new Map(input.allRoles.map(r => [r.id, r]));

    const queue = [...(input.role.inheritsRoleIds ?? [])];
    const visited = new Set<string>([input.role.id]);

    // Track what the direct role inherits
    if (input.role.inheritsRoleIds?.length) {
      inheritanceChain.push({
        roleId: input.role.id,
        roleSlug: input.role.slug,
        inheritsFrom: input.role.inheritsRoleIds,
      });
    }

    while (queue.length > 0) {
      const parentId = queue.shift()!;
      if (visited.has(parentId)) continue;
      visited.add(parentId);

      const parentRole = roleMap.get(parentId);
      if (!parentRole) continue;

      effectiveRoleIds.add(parentId);
      effectiveRoleSlugs.add(parentRole.slug);

      const parentNodeId = `role:${parentId}`;
      this.addNode({
        id: parentNodeId,
        type: 'role',
        meta: { slug: parentRole.slug, name: parentRole.name },
      });
      // Find the child that inherits this parent
      this.addEdge(directRoleNodeId, parentNodeId, 'INHERITS_ROLE');

      if (parentRole.inheritsRoleIds?.length) {
        inheritanceChain.push({
          roleId: parentId,
          roleSlug: parentRole.slug,
          inheritsFrom: parentRole.inheritsRoleIds,
        });
        queue.push(...parentRole.inheritsRoleIds);
      }
    }

    // ── 4. Permissions ──
    const effectivePermissions = new Set<string>();
    const permissionLookup = new Map<string, boolean>();
    const permDefMap = new Map(input.permissionDefs.map(p => [p.id, p]));

    for (const rp of input.rolePermissions) {
      if (!effectiveRoleIds.has(rp.roleId)) continue;
      const perm = permDefMap.get(rp.permissionId);
      if (!perm) continue;

      effectivePermissions.add(perm.code);
      permissionLookup.set(perm.code, true);

      const permNodeId = `perm:${perm.id}`;
      this.addNode({
        id: permNodeId,
        type: 'permission',
        meta: { code: perm.code, module: perm.module },
      });
      this.addEdge(`role:${rp.roleId}`, permNodeId, 'GRANTS_PERMISSION');
    }

    // ── 5. Scopes ──
    let hasGlobalScope = false;
    const reachableSections = new Set<string>();

    for (const scope of input.scopes) {
      if (!effectiveRoleIds.has(scope.roleId)) continue;

      const scopeNodeId = `scope:${scope.id}`;
      this.addNode({
        id: scopeNodeId,
        type: 'scope',
        meta: { scopeType: scope.scopeType, scopeId: scope.scopeId },
      });
      this.addEdge(`role:${scope.roleId}`, scopeNodeId, 'HAS_SCOPE');

      if (scope.scopeType === 'global') {
        hasGlobalScope = true;
      } else if (scope.scopeType === 'platform_section' && scope.scopeId) {
        reachableSections.add(scope.scopeId);
      }
    }

    // SuperAdmin always has global scope
    if (effectiveRoleSlugs.has('platform_super_admin')) {
      hasGlobalScope = true;
    }

    // ── 6. Cache ──
    this.cache = {
      effectiveRoleIds,
      effectiveRoleSlugs,
      effectivePermissions,
      permissionLookup,
      hasGlobalScope,
      reachableSections,
      inheritanceChain,
      builtAt: Date.now(),
    };
  }

  // ── O(1) QUERIES ──────────────────

  /** Check if user has a specific platform permission code (e.g. "tenant.create") */
  hasPermission(code: PlatformPermission): boolean {
    return this.cache.permissionLookup.get(code) ?? false;
  }

  /** Check if user has a specific platform role slug */
  hasRole(slug: string): boolean {
    return this.cache.effectiveRoleSlugs.has(slug);
  }

  /** Check if user has global (unrestricted) scope */
  hasGlobalScope(): boolean {
    return this.cache.hasGlobalScope;
  }

  /** Check if user can access a specific platform section */
  canAccessSection(sectionId: string): boolean {
    return this.cache.hasGlobalScope || this.cache.reachableSections.has(sectionId);
  }

  /** Get all effective permissions */
  getEffectivePermissions(): ReadonlySet<string> {
    return this.cache.effectivePermissions;
  }

  /** Get all effective role slugs (direct + inherited) */
  getEffectiveRoles(): ReadonlySet<string> {
    return this.cache.effectiveRoleSlugs;
  }

  /** Get inheritance chain for debugging */
  getInheritanceChain(): PlatformAccessCache['inheritanceChain'] {
    return this.cache.inheritanceChain;
  }

  // ── GRAPH INTROSPECTION ──────────

  getNodes(): ReadonlyMap<string, PlatformGraphNode> { return this.nodes; }
  getEdges(): readonly PlatformGraphEdge[] { return this.edges; }

  getStats() {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      effectiveRoles: this.cache.effectiveRoleSlugs.size,
      effectivePermissions: this.cache.effectivePermissions.size,
      hasGlobalScope: this.cache.hasGlobalScope,
      reachableSections: this.cache.reachableSections.size,
      builtAt: this.cache.builtAt,
    };
  }

  // ── INTERNALS ──────────────────────

  private addNode(node: PlatformGraphNode): void {
    if (!this.nodes.has(node.id)) this.nodes.set(node.id, node);
  }

  private addEdge(from: string, to: string, relation: PlatformEdgeRelation): void {
    const exists = this.edges.some(e => e.from === from && e.to === to && e.relation === relation);
    if (!exists) this.edges.push({ from, to, relation });
  }

  private clear(): void {
    this.nodes.clear();
    this.edges = [];
    this.cache = createEmptyPlatformCache();
  }
}

function createEmptyPlatformCache(): PlatformAccessCache {
  return {
    effectiveRoleIds: new Set(),
    effectiveRoleSlugs: new Set(),
    effectivePermissions: new Set(),
    permissionLookup: new Map(),
    hasGlobalScope: false,
    reachableSections: new Set(),
    inheritanceChain: [],
    builtAt: 0,
  };
}

// ════════════════════════════════════
// SERVICE (singleton + cache)
// ════════════════════════════════════

let currentPlatformGraph: PlatformAccessGraph | null = null;
const platformGraphCache = new Map<string, { graph: PlatformAccessGraph; builtAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export const platformAccessGraphService = {

  /**
   * Build the full access graph for a platform user.
   * Uses cache if available and fresh.
   */
  buildPlatformUserGraph(input: PlatformGraphInput): PlatformAccessGraph {
    const cached = platformGraphCache.get(input.userId);
    if (cached && Date.now() - cached.builtAt < CACHE_TTL_MS) {
      currentPlatformGraph = cached.graph;
      return cached.graph;
    }

    const graph = new PlatformAccessGraph();
    graph.build(input);
    currentPlatformGraph = graph;
    platformGraphCache.set(input.userId, { graph, builtAt: Date.now() });
    return graph;
  },

  /**
   * Check if a platform user can perform an action on a resource.
   * Combines RBAC (permission matrix) + scope resolution.
   *
   * @param graph    - The user's precomputed PlatformAccessGraph
   * @param action   - e.g. "create", "view", "manage", "suspend"
   * @param resource - e.g. "tenant", "billing", "module", "audit"
   * @param sectionId - Optional: restrict to a platform section
   *
   * @example
   * checkPlatformAccess(graph, 'create', 'tenant')
   * checkPlatformAccess(graph, 'view', 'billing')
   * checkPlatformAccess(graph, 'report', 'fiscal')
   */
  checkPlatformAccess(
    graph: PlatformAccessGraph,
    action: string,
    resource: string,
    sectionId?: string,
  ): PlatformAccessCheckResult {
    const permCode = `${resource}.${action}` as PlatformPermission;
    const roleChain = Array.from(graph.getEffectiveRoles());

    // 1. RBAC check
    if (!graph.hasPermission(permCode)) {
      return {
        allowed: false,
        reason: `Permissão ${permCode} não concedida`,
        decidedBy: 'rbac',
        roleChain,
      };
    }

    // 2. Scope check (if section specified)
    if (sectionId) {
      if (graph.hasGlobalScope()) {
        return {
          allowed: true,
          reason: `Escopo global herda acesso a ${sectionId}`,
          decidedBy: 'inherited',
          roleChain,
        };
      }

      if (!graph.canAccessSection(sectionId)) {
        return {
          allowed: false,
          reason: `Sem acesso à seção ${sectionId}`,
          decidedBy: 'scope',
          roleChain,
        };
      }
    }

    return {
      allowed: true,
      reason: sectionId
        ? `Acesso a ${permCode} na seção ${sectionId}`
        : `Acesso a ${permCode} (sem restrição de escopo)`,
      decidedBy: graph.hasGlobalScope() ? 'inherited' : 'rbac',
      roleChain,
    };
  },

  /** Force rebuild, bypassing cache */
  rebuildPlatformUserGraph(input: PlatformGraphInput): PlatformAccessGraph {
    platformGraphCache.delete(input.userId);
    return this.buildPlatformUserGraph(input);
  },

  /** Invalidate cache for a user */
  invalidateUser(userId: string): void {
    platformGraphCache.delete(userId);
    if (currentPlatformGraph && Array.from(currentPlatformGraph.getNodes().keys()).includes(userId)) {
      currentPlatformGraph = null;
    }
  },

  /** Invalidate all cached graphs */
  invalidateAll(): void {
    platformGraphCache.clear();
    currentPlatformGraph = null;
  },

  /** Get the current singleton graph */
  getCurrentGraph(): PlatformAccessGraph | null {
    return currentPlatformGraph;
  },
};
