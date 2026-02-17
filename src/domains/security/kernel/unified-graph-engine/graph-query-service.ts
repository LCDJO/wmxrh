/**
 * GraphQueryService — BFS-based traversal + high-level query API.
 *
 * Low-level:
 *   queryGraph(snapshot, query)  → BFS with filters
 *
 * High-level:
 *   getUserAccessMap(snapshot, userId)         → all roles, permissions, scopes, tenants
 *   getTenantAccessOverview(snapshot, tenantId) → all users, roles, permissions in a tenant
 *   getPermissionUsage(snapshot, resource)      → who/what grants a specific permission
 */

import type {
  UnifiedGraphSnapshot,
  GraphQuery,
  GraphQueryResult,
  UnifiedNode,
  UnifiedEdge,
  UnifiedEdgeRelation,
  GraphDomain,
} from './types';

// ════════════════════════════════════
// RESULT TYPES
// ════════════════════════════════════

export interface UserAccessMap {
  userId: string;
  userNodes: UnifiedNode[];
  /** All roles (platform + tenant) */
  roles: Array<{
    role: UnifiedNode;
    domain: GraphDomain;
    /** Permissions granted by this role */
    permissions: UnifiedNode[];
  }>;
  /** All scopes the user can reach */
  scopes: Array<{
    type: 'tenant' | 'company_group' | 'company' | string;
    node: UnifiedNode;
  }>;
  /** Tenants the user belongs to */
  tenants: UnifiedNode[];
  /** Active impersonation targets */
  impersonating: UnifiedNode[];
  /** Total unique permissions across all roles */
  totalPermissions: number;
}

export interface TenantAccessOverview {
  tenantId: string;
  tenantNode: UnifiedNode | null;
  /** Users that belong to this tenant */
  users: Array<{
    user: UnifiedNode;
    roles: UnifiedNode[];
    permissionCount: number;
  }>;
  /** All roles used within this tenant */
  roles: UnifiedNode[];
  /** All permissions granted within this tenant */
  permissions: UnifiedNode[];
  /** Modules enabled for this tenant */
  modules: UnifiedNode[];
  stats: {
    totalUsers: number;
    totalRoles: number;
    totalPermissions: number;
    totalModules: number;
  };
}

export interface PermissionUsage {
  resource: string;
  permissionNode: UnifiedNode | null;
  /** Roles that grant this permission */
  grantedBy: Array<{
    role: UnifiedNode;
    domain: GraphDomain;
  }>;
  /** Users that have this permission (directly or inherited) */
  usersWithAccess: Array<{
    user: UnifiedNode;
    viaRole: UnifiedNode;
  }>;
  stats: {
    totalRolesGranting: number;
    totalUsersWithAccess: number;
  };
}

// ════════════════════════════════════
// RELATION SETS
// ════════════════════════════════════

const ROLE_RELATIONS: UnifiedEdgeRelation[] = ['HAS_ROLE', 'HAS_PLATFORM_ROLE', 'HAS_TENANT_ROLE'];
const GRANT_RELATIONS: UnifiedEdgeRelation[] = ['GRANTS_PERMISSION', 'PLATFORM_GRANTS', 'TENANT_GRANTS'];
const INHERIT_RELATIONS: UnifiedEdgeRelation[] = ['INHERITS_ROLE', 'PLATFORM_INHERITS'];
const BELONG_RELATIONS: UnifiedEdgeRelation[] = ['BELONGS_TO', 'BELONGS_TO_TENANT', 'BELONGS_TO_GROUP', 'BELONGS_TO_COMPANY'];
const SCOPE_TYPES = new Set(['tenant', 'company_group', 'company', 'scope']);

// ════════════════════════════════════
// LOW-LEVEL BFS QUERY
// ════════════════════════════════════

const DEFAULT_MAX_DEPTH = 10;

export function queryGraph(
  snapshot: UnifiedGraphSnapshot,
  query: GraphQuery,
): GraphQueryResult {
  const { from, relations, targetDomain, maxDepth = DEFAULT_MAX_DEPTH } = query;
  const { nodes, edges } = snapshot;

  if (!nodes.has(from)) {
    return { paths: [], reachableNodes: [], totalEdgesTraversed: 0 };
  }

  const adjacency = new Map<string, Array<{ edge: UnifiedEdge; target: string }>>();
  for (const e of edges) {
    if (relations && !relations.includes(e.relation)) continue;
    if (targetDomain && e.domain !== targetDomain) continue;
    if (!adjacency.has(e.from)) adjacency.set(e.from, []);
    adjacency.get(e.from)!.push({ edge: e, target: e.to });
  }

  const visited = new Set<string>();
  const reachableNodes: UnifiedNode[] = [];
  const allPaths: GraphQueryResult['paths'] = [];
  let totalEdgesTraversed = 0;

  interface QueueItem {
    uid: string;
    depth: number;
    pathNodes: UnifiedNode[];
    pathEdges: UnifiedEdge[];
  }

  const startNode = nodes.get(from)!;
  const queue: QueueItem[] = [{ uid: from, depth: 0, pathNodes: [startNode], pathEdges: [] }];

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (item.depth > maxDepth) continue;

    const neighbors = adjacency.get(item.uid) ?? [];
    for (const { edge, target } of neighbors) {
      totalEdgesTraversed++;
      const targetNode = nodes.get(target);
      if (!targetNode) continue;

      const newPath = {
        nodes: [...item.pathNodes, targetNode],
        edges: [...item.pathEdges, edge],
      };

      if (!visited.has(target)) {
        visited.add(target);
        reachableNodes.push(targetNode);
        allPaths.push(newPath);
        queue.push({
          uid: target,
          depth: item.depth + 1,
          pathNodes: newPath.nodes,
          pathEdges: newPath.edges,
        });
      }
    }
  }

  return { paths: allPaths, reachableNodes, totalEdgesTraversed };
}

// ════════════════════════════════════
// getUserAccessMap
// ════════════════════════════════════

/**
 * Returns the complete access map for a user across all domains.
 * Resolves: roles → permissions, scopes, tenants, impersonation.
 */
export function getUserAccessMap(
  snapshot: UnifiedGraphSnapshot,
  userId: string,
): UserAccessMap {
  const { nodes, edges } = snapshot;

  // Find all user nodes matching this userId (may exist in multiple domains)
  const userNodes = Array.from(nodes.values()).filter(
    n => (n.type === 'platform_user' || n.type === 'tenant_user' || n.type === 'identity_session') &&
      n.originalId === userId,
  );

  const result: UserAccessMap = {
    userId,
    userNodes,
    roles: [],
    scopes: [],
    tenants: [],
    impersonating: [],
    totalPermissions: 0,
  };

  const allPermUids = new Set<string>();

  for (const userNode of userNodes) {
    // ── Roles ──
    const directRoleUids = new Set<string>();
    for (const e of edges) {
      if (e.from === userNode.uid && ROLE_RELATIONS.includes(e.relation)) {
        directRoleUids.add(e.to);
      }
    }

    // Follow inheritance
    const allRoleUids = new Set(directRoleUids);
    const queue = [...directRoleUids];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const e of edges) {
        if (e.from === current && INHERIT_RELATIONS.includes(e.relation) && !allRoleUids.has(e.to)) {
          allRoleUids.add(e.to);
          queue.push(e.to);
        }
      }
    }

    for (const roleUid of allRoleUids) {
      const roleNode = nodes.get(roleUid);
      if (!roleNode) continue;

      // Permissions for this role
      const perms: UnifiedNode[] = [];
      for (const e of edges) {
        if (e.from === roleUid && GRANT_RELATIONS.includes(e.relation)) {
          const permNode = nodes.get(e.to);
          if (permNode) {
            perms.push(permNode);
            allPermUids.add(permNode.uid);
          }
        }
      }

      result.roles.push({
        role: roleNode,
        domain: roleNode.domain,
        permissions: perms,
      });
    }

    // ── Scopes & Tenants ──
    for (const e of edges) {
      if (e.from !== userNode.uid) continue;
      const targetNode = nodes.get(e.to);
      if (!targetNode) continue;

      if (BELONG_RELATIONS.includes(e.relation) || e.relation === 'TENANT_SCOPE' || e.relation === 'PLATFORM_SCOPE') {
        if (targetNode.type === 'tenant') {
          if (!result.tenants.some(t => t.uid === targetNode.uid)) {
            result.tenants.push(targetNode);
          }
        }
        if (SCOPE_TYPES.has(targetNode.type)) {
          result.scopes.push({ type: targetNode.type, node: targetNode });
        }
      }

      if (e.relation === 'IMPERSONATES') {
        result.impersonating.push(targetNode);
      }
    }
  }

  // Also discover tenants via role meta
  for (const { role } of result.roles) {
    if (role.meta?.tenantId) {
      const tenantNode = Array.from(nodes.values()).find(
        n => n.type === 'tenant' && n.originalId === (role.meta!.tenantId as string),
      );
      if (tenantNode && !result.tenants.some(t => t.uid === tenantNode.uid)) {
        result.tenants.push(tenantNode);
      }
    }
  }

  result.totalPermissions = allPermUids.size;
  return result;
}

// ════════════════════════════════════
// getTenantAccessOverview
// ════════════════════════════════════

/**
 * Returns an overview of all access within a specific tenant:
 * users, their roles, permissions, and modules.
 */
export function getTenantAccessOverview(
  snapshot: UnifiedGraphSnapshot,
  tenantId: string,
): TenantAccessOverview {
  const { nodes, edges } = snapshot;

  // Find tenant node
  const tenantNode = Array.from(nodes.values()).find(
    n => n.type === 'tenant' && n.originalId === tenantId,
  ) ?? null;

  // Find users belonging to this tenant
  const tenantUserUids = new Set<string>();

  // Direct BELONGS_TO edges
  for (const e of edges) {
    if (BELONG_RELATIONS.includes(e.relation) && e.to === tenantNode?.uid) {
      const fromNode = nodes.get(e.from);
      if (fromNode && (fromNode.type === 'tenant_user' || fromNode.type === 'platform_user')) {
        tenantUserUids.add(e.from);
      }
    }
  }

  // Also: users with roles that have tenantId in meta
  for (const e of edges) {
    if (ROLE_RELATIONS.includes(e.relation)) {
      const roleNode = nodes.get(e.to);
      if (roleNode?.meta?.tenantId === tenantId) {
        tenantUserUids.add(e.from);
      }
    }
  }

  // Build per-user breakdown
  const usersResult: TenantAccessOverview['users'] = [];
  const allRolesSet = new Set<string>();
  const allPermsSet = new Set<string>();
  const allModulesSet = new Set<string>();

  for (const userUid of tenantUserUids) {
    const userNode = nodes.get(userUid);
    if (!userNode) continue;

    const userRoles: UnifiedNode[] = [];
    let permCount = 0;

    for (const e of edges) {
      if (e.from === userUid && ROLE_RELATIONS.includes(e.relation)) {
        const roleNode = nodes.get(e.to);
        if (roleNode) {
          userRoles.push(roleNode);
          allRolesSet.add(roleNode.uid);

          // Count permissions
          for (const ge of edges) {
            if (ge.from === roleNode.uid && GRANT_RELATIONS.includes(ge.relation)) {
              permCount++;
              allPermsSet.add(ge.to);
            }
          }
        }
      }
    }

    usersResult.push({ user: userNode, roles: userRoles, permissionCount: permCount });
  }

  // Modules enabled for tenant
  for (const e of edges) {
    if (e.relation === 'ENABLES_MODULE' || e.relation === 'HAS_MODULE_ACCESS') {
      if (e.from === tenantNode?.uid || tenantUserUids.has(e.from)) {
        const moduleNode = nodes.get(e.to);
        if (moduleNode?.type === 'module') allModulesSet.add(moduleNode.uid);
      }
    }
  }

  const roles = Array.from(allRolesSet).map(uid => nodes.get(uid)!).filter(Boolean);
  const permissions = Array.from(allPermsSet).map(uid => nodes.get(uid)!).filter(Boolean);
  const modules = Array.from(allModulesSet).map(uid => nodes.get(uid)!).filter(Boolean);

  return {
    tenantId,
    tenantNode,
    users: usersResult,
    roles,
    permissions,
    modules,
    stats: {
      totalUsers: usersResult.length,
      totalRoles: roles.length,
      totalPermissions: permissions.length,
      totalModules: modules.length,
    },
  };
}

// ════════════════════════════════════
// getPermissionUsage
// ════════════════════════════════════

/**
 * Returns who grants and who has access to a specific permission.
 * `resource` can be a permission uid, originalId, or slug from meta.
 */
export function getPermissionUsage(
  snapshot: UnifiedGraphSnapshot,
  resource: string,
): PermissionUsage {
  const { nodes, edges } = snapshot;

  // Find the permission node by uid, originalId, or meta.slug/meta.code
  const permNode = Array.from(nodes.values()).find(
    n => n.type === 'permission' && (
      n.uid === resource ||
      n.originalId === resource ||
      (n.meta?.slug as string) === resource ||
      (n.meta?.code as string) === resource
    ),
  ) ?? null;

  if (!permNode) {
    return {
      resource,
      permissionNode: null,
      grantedBy: [],
      usersWithAccess: [],
      stats: { totalRolesGranting: 0, totalUsersWithAccess: 0 },
    };
  }

  // Roles that grant this permission (incoming GRANTS edges)
  const grantedBy: PermissionUsage['grantedBy'] = [];
  const grantingRoleUids = new Set<string>();

  for (const e of edges) {
    if (e.to === permNode.uid && GRANT_RELATIONS.includes(e.relation)) {
      const roleNode = nodes.get(e.from);
      if (roleNode) {
        grantedBy.push({ role: roleNode, domain: roleNode.domain });
        grantingRoleUids.add(roleNode.uid);
      }
    }
  }

  // Also include roles that inherit from granting roles
  const allGrantingRoles = new Set(grantingRoleUids);
  // Reverse inheritance: find roles that INHERITS → grantingRole
  for (const e of edges) {
    if (INHERIT_RELATIONS.includes(e.relation) && grantingRoleUids.has(e.to)) {
      allGrantingRoles.add(e.from);
      const inheritingRole = nodes.get(e.from);
      if (inheritingRole && !grantingRoleUids.has(e.from)) {
        grantedBy.push({ role: inheritingRole, domain: inheritingRole.domain });
      }
    }
  }

  // Users that have any of these roles
  const usersWithAccess: PermissionUsage['usersWithAccess'] = [];
  const seenUsers = new Set<string>();

  for (const e of edges) {
    if (ROLE_RELATIONS.includes(e.relation) && allGrantingRoles.has(e.to)) {
      const userNode = nodes.get(e.from);
      const roleNode = nodes.get(e.to);
      if (userNode && roleNode && !seenUsers.has(userNode.uid)) {
        seenUsers.add(userNode.uid);
        usersWithAccess.push({ user: userNode, viaRole: roleNode });
      }
    }
  }

  return {
    resource,
    permissionNode: permNode,
    grantedBy,
    usersWithAccess,
    stats: {
      totalRolesGranting: grantedBy.length,
      totalUsersWithAccess: usersWithAccess.length,
    },
  };
}
