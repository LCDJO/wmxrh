/**
 * SecurityKernel — Access Graph
 * 
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  IN-MEMORY AUTHORIZATION GRAPH                                  ║
 * ║                                                                  ║
 * ║  Models hierarchical relationships between:                     ║
 * ║    User → Roles → Scopes → Tenant/Group/Company → Resources    ║
 * ║                                                                  ║
 * ║  Pre-computes all reachable paths on build() so that            ║
 * ║  authorization checks are O(1) hash lookups.                    ║
 * ║                                                                  ║
 * ║  ┌─────────┐     ┌──────┐     ┌───────────┐                    ║
 * ║  │  User   │────▶│ Role │────▶│   Scope   │                    ║
 * ║  └─────────┘     └──────┘     └─────┬─────┘                    ║
 * ║                                     │                           ║
 * ║                          ┌──────────┼──────────┐                ║
 * ║                          ▼          ▼          ▼                ║
 * ║                     ┌────────┐ ┌────────┐ ┌─────────┐          ║
 * ║                     │ Tenant │ │ Group  │ │ Company │          ║
 * ║                     └────┬───┘ └────┬───┘ └─────────┘          ║
 * ║                          │          │                           ║
 * ║                          ▼          ▼                           ║
 * ║                       (inherits children)                       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * The graph is rebuilt when:
 *   - User logs in
 *   - Tenant changes
 *   - Roles change
 *   - Scope changes
 */

import type { TenantRole, UserRole, ScopeType } from '@/domains/shared/types';
import type { PermissionAction, PermissionEntity } from '../permissions';
import { hasPermission } from '../permissions';

// ════════════════════════════════════
// NODE TYPES
// ════════════════════════════════════

export type NodeType = 'user' | 'role' | 'tenant' | 'company_group' | 'company' | 'resource';

export interface GraphNode {
  id: string;
  type: NodeType;
  /** Metadata attached to the node */
  meta?: Record<string, unknown>;
}

export type EdgeRelation =
  | 'has_role'         // user → role
  | 'scoped_to'        // role → tenant/group/company
  | 'belongs_to'       // company → group, group → tenant
  | 'can_access';      // computed: user → resource

export interface GraphEdge {
  from: string;
  to: string;
  relation: EdgeRelation;
  meta?: Record<string, unknown>;
}

// ════════════════════════════════════
// ACCESS GRAPH INPUT
// ════════════════════════════════════

export interface AccessGraphInput {
  userId: string;
  tenantId: string;
  /** User roles from user_roles table */
  userRoles: UserRole[];
  /** Membership role from tenant_memberships */
  membershipRole: TenantRole | null;
  /** Company → Group mapping (for hierarchy resolution) */
  companyGroupMap: Record<string, string | null>;
}

// ════════════════════════════════════
// PRECOMPUTED CACHE (O(1) lookups)
// ════════════════════════════════════

interface AccessCache {
  /** Set of all effective roles */
  roles: Set<TenantRole>;
  /** Has tenant-wide scope (bypass group/company checks) */
  hasTenantScope: boolean;
  /** Set of group IDs the user can access */
  reachableGroups: Set<string>;
  /** Set of company IDs the user can access */
  reachableCompanies: Set<string>;
  /** Precomputed permission results: `${entity}:${action}` → boolean */
  permissionCache: Map<string, boolean>;
  /** Precomputed scope checks: `${type}:${id}` → boolean */
  scopeCache: Map<string, boolean>;
  /** Graph generation timestamp */
  builtAt: number;
  /** Graph version (increments on rebuild) */
  version: number;
}

// ════════════════════════════════════
// TENANT-WIDE ROLES
// ════════════════════════════════════

const TENANT_WIDE_ROLES: TenantRole[] = [
  'superadmin', 'owner', 'admin', 'tenant_admin',
];

// ════════════════════════════════════
// ACCESS GRAPH CLASS
// ════════════════════════════════════

let graphVersion = 0;

export class AccessGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private cache: AccessCache;
  private userId: string;
  private tenantId: string;

  constructor() {
    this.userId = '';
    this.tenantId = '';
    this.cache = createEmptyCache();
  }

  // ── BUILD ──────────────────────────

  /**
   * Build the access graph from raw input.
   * This is the ONLY way to populate the graph.
   * Called once per SecurityContext construction.
   */
  build(input: AccessGraphInput): void {
    this.clear();
    this.userId = input.userId;
    this.tenantId = input.tenantId;

    // 1. Create nodes
    this.addNode({ id: input.userId, type: 'user' });
    this.addNode({ id: input.tenantId, type: 'tenant' });

    // 2. Process membership role
    if (input.membershipRole) {
      const roleNodeId = `role:${input.membershipRole}:tenant`;
      this.addNode({ id: roleNodeId, type: 'role', meta: { role: input.membershipRole, scopeType: 'tenant' } });
      this.addEdge(input.userId, roleNodeId, 'has_role');
      this.addEdge(roleNodeId, input.tenantId, 'scoped_to');
    }

    // 3. Process user_roles
    for (const ur of input.userRoles) {
      const roleNodeId = `role:${ur.role}:${ur.scope_type}:${ur.scope_id || 'all'}`;
      this.addNode({
        id: roleNodeId,
        type: 'role',
        meta: { role: ur.role, scopeType: ur.scope_type, scopeId: ur.scope_id },
      });
      this.addEdge(input.userId, roleNodeId, 'has_role');

      // Scope target node
      if (ur.scope_type === 'tenant') {
        this.addEdge(roleNodeId, input.tenantId, 'scoped_to');
      } else if (ur.scope_type === 'company_group' && ur.scope_id) {
        this.addNode({ id: ur.scope_id, type: 'company_group' });
        this.addEdge(roleNodeId, ur.scope_id, 'scoped_to');
        this.addEdge(ur.scope_id, input.tenantId, 'belongs_to');
      } else if (ur.scope_type === 'company' && ur.scope_id) {
        this.addNode({ id: ur.scope_id, type: 'company' });
        this.addEdge(roleNodeId, ur.scope_id, 'scoped_to');

        // Link company to group if known
        const groupId = input.companyGroupMap[ur.scope_id];
        if (groupId) {
          this.addNode({ id: groupId, type: 'company_group' });
          this.addEdge(ur.scope_id, groupId, 'belongs_to');
          this.addEdge(groupId, input.tenantId, 'belongs_to');
        } else {
          this.addEdge(ur.scope_id, input.tenantId, 'belongs_to');
        }
      }
    }

    // 4. Add all known companies and their group relationships
    for (const [companyId, groupId] of Object.entries(input.companyGroupMap)) {
      if (!this.nodes.has(companyId)) {
        this.addNode({ id: companyId, type: 'company' });
      }
      if (groupId) {
        if (!this.nodes.has(groupId)) {
          this.addNode({ id: groupId, type: 'company_group' });
        }
        this.addEdge(companyId, groupId, 'belongs_to');
      }
    }

    // 5. Precompute cache
    this.precompute(input);
  }

  // ── PRECOMPUTE ─────────────────────

  private precompute(input: AccessGraphInput): void {
    graphVersion++;
    const roles = new Set<TenantRole>();

    // Collect all roles
    if (input.membershipRole) roles.add(input.membershipRole);
    for (const ur of input.userRoles) roles.add(ur.role);

    // Determine tenant-wide access
    const hasTenantScope =
      Array.from(roles).some(r => TENANT_WIDE_ROLES.includes(r)) ||
      input.userRoles.some(ur => ur.scope_type === 'tenant');

    // Collect reachable groups and companies
    const reachableGroups = new Set<string>();
    const reachableCompanies = new Set<string>();

    if (hasTenantScope) {
      // Tenant-wide: can reach everything
      for (const [id, node] of this.nodes) {
        if (node.type === 'company_group') reachableGroups.add(id);
        if (node.type === 'company') reachableCompanies.add(id);
      }
    } else {
      // Group-scoped roles: add group + all companies in group
      for (const ur of input.userRoles) {
        if (ur.scope_type === 'company_group' && ur.scope_id) {
          reachableGroups.add(ur.scope_id);
          // Find companies belonging to this group
          for (const [companyId, groupId] of Object.entries(input.companyGroupMap)) {
            if (groupId === ur.scope_id) {
              reachableCompanies.add(companyId);
            }
          }
        }
        if (ur.scope_type === 'company' && ur.scope_id) {
          reachableCompanies.add(ur.scope_id);
          // Also add the group this company belongs to
          const groupId = input.companyGroupMap[ur.scope_id];
          if (groupId) reachableGroups.add(groupId);
        }
      }
    }

    // Precompute permission matrix for all entities × actions
    const permissionCache = new Map<string, boolean>();
    const rolesArray = Array.from(roles);
    const entities: PermissionEntity[] = [
      'tenants', 'company_groups', 'companies', 'departments', 'positions',
      'employees', 'salary_contracts', 'salary_adjustments', 'salary_additionals',
      'salary_history', 'compensation', 'audit_logs', 'user_roles',
    ];
    const actions: PermissionAction[] = ['view', 'create', 'update', 'delete'];

    for (const entity of entities) {
      for (const action of actions) {
        const key = `${entity}:${action}`;
        permissionCache.set(key, hasPermission(entity, action, rolesArray));
      }
    }

    // Precompute scope access
    const scopeCache = new Map<string, boolean>();
    scopeCache.set(`tenant:${input.tenantId}`, true);

    for (const groupId of reachableGroups) {
      scopeCache.set(`company_group:${groupId}`, true);
    }
    for (const companyId of reachableCompanies) {
      scopeCache.set(`company:${companyId}`, true);
    }

    this.cache = {
      roles,
      hasTenantScope,
      reachableGroups,
      reachableCompanies,
      permissionCache,
      scopeCache,
      builtAt: Date.now(),
      version: graphVersion,
    };
  }

  // ── O(1) QUERY API ─────────────────

  /**
   * Check RBAC permission — O(1) hash lookup.
   */
  canPerform(entity: PermissionEntity, action: PermissionAction): boolean {
    return this.cache.permissionCache.get(`${entity}:${action}`) ?? false;
  }

  /**
   * Check scope access — O(1) hash lookup.
   * Answers: "Can this user see data in this group/company?"
   */
  canAccessScope(scopeType: ScopeType, scopeId: string | null): boolean {
    if (this.cache.hasTenantScope) return true;
    if (!scopeId) return scopeType === 'tenant';
    return this.cache.scopeCache.get(`${scopeType}:${scopeId}`) ?? false;
  }

  /**
   * Combined RBAC + ABAC check — O(1).
   * The primary authorization query.
   */
  canAccess(
    entity: PermissionEntity,
    action: PermissionAction,
    target?: { company_group_id?: string | null; company_id?: string | null }
  ): boolean {
    // RBAC
    if (!this.canPerform(entity, action)) return false;

    // ABAC (scope check)
    if (!target) return true;
    if (this.cache.hasTenantScope) return true;

    if (target.company_id) {
      return this.cache.reachableCompanies.has(target.company_id);
    }
    if (target.company_group_id) {
      return this.cache.reachableGroups.has(target.company_group_id);
    }

    // Target has no group/company = tenant-level resource
    return this.cache.hasTenantScope;
  }

  /**
   * Check if user has a specific role — O(1).
   */
  hasRole(...roles: TenantRole[]): boolean {
    return roles.some(r => this.cache.roles.has(r));
  }

  /**
   * Get all reachable company IDs — O(1) (returns ref).
   */
  getReachableCompanies(): ReadonlySet<string> {
    return this.cache.reachableCompanies;
  }

  /**
   * Get all reachable group IDs — O(1).
   */
  getReachableGroups(): ReadonlySet<string> {
    return this.cache.reachableGroups;
  }

  /**
   * Whether user has full tenant access.
   */
  hasTenantScope(): boolean {
    return this.cache.hasTenantScope;
  }

  /**
   * Get all effective roles.
   */
  getRoles(): ReadonlySet<TenantRole> {
    return this.cache.roles;
  }

  // ── GRAPH INTROSPECTION ────────────

  /**
   * Get all nodes in the graph (for debugging/visualization).
   */
  getNodes(): ReadonlyMap<string, GraphNode> {
    return this.nodes;
  }

  /**
   * Get all edges (for debugging/visualization).
   */
  getEdges(): readonly GraphEdge[] {
    return this.edges;
  }

  /**
   * Get edges from a specific node.
   */
  getEdgesFrom(nodeId: string): GraphEdge[] {
    return this.edges.filter(e => e.from === nodeId);
  }

  /**
   * Get edges to a specific node.
   */
  getEdgesTo(nodeId: string): GraphEdge[] {
    return this.edges.filter(e => e.to === nodeId);
  }

  /**
   * Cache stats for monitoring.
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    roleCount: number;
    reachableGroups: number;
    reachableCompanies: number;
    hasTenantScope: boolean;
    version: number;
    builtAt: number;
    permissionCacheSize: number;
    scopeCacheSize: number;
  } {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      roleCount: this.cache.roles.size,
      reachableGroups: this.cache.reachableGroups.size,
      reachableCompanies: this.cache.reachableCompanies.size,
      hasTenantScope: this.cache.hasTenantScope,
      version: this.cache.version,
      builtAt: this.cache.builtAt,
      permissionCacheSize: this.cache.permissionCache.size,
      scopeCacheSize: this.cache.scopeCache.size,
    };
  }

  // ── INTERNALS ──────────────────────

  private addNode(node: GraphNode): void {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
    }
  }

  private addEdge(from: string, to: string, relation: EdgeRelation, meta?: Record<string, unknown>): void {
    // Deduplicate
    const exists = this.edges.some(
      e => e.from === from && e.to === to && e.relation === relation
    );
    if (!exists) {
      this.edges.push({ from, to, relation, meta });
    }
  }

  private clear(): void {
    this.nodes.clear();
    this.edges = [];
    this.cache = createEmptyCache();
  }
}

// ════════════════════════════════════
// FACTORY
// ════════════════════════════════════

function createEmptyCache(): AccessCache {
  return {
    roles: new Set(),
    hasTenantScope: false,
    reachableGroups: new Set(),
    reachableCompanies: new Set(),
    permissionCache: new Map(),
    scopeCache: new Map(),
    builtAt: 0,
    version: 0,
  };
}

/**
 * Create and build an AccessGraph from the given input.
 */
export function buildAccessGraph(input: AccessGraphInput): AccessGraph {
  const graph = new AccessGraph();
  graph.build(input);
  return graph;
}

// ════════════════════════════════════
// SINGLETON (for hook usage)
// ════════════════════════════════════

let currentGraph: AccessGraph | null = null;

export function getAccessGraph(): AccessGraph | null {
  return currentGraph;
}

export function setAccessGraph(graph: AccessGraph): void {
  currentGraph = graph;
}

export function clearAccessGraph(): void {
  currentGraph = null;
}
