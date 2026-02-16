/**
 * SecurityKernel — AccessGraphService
 * 
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CENTRAL SERVICE FOR GRAPH-BASED AUTHORIZATION                  ║
 * ║                                                                  ║
 * ║  API:                                                            ║
 * ║    buildUserAccessGraph(input)  → AccessGraph                   ║
 * ║    checkAccess(graph, action, resource, scope_id?)  → boolean   ║
 * ║    resolveInheritedScopes(graph)  → InheritedScopes             ║
 * ║                                                                  ║
 * ║  INHERITANCE RULES:                                              ║
 * ║    TenantAdmin  → herda ALL Groups + ALL Companies              ║
 * ║    GroupAdmin   → herda Companies dentro do grupo                ║
 * ║    CompanyAdmin → acesso apenas local (sem herança)             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import {
  AccessGraph,
  buildAccessGraph,
  setAccessGraph,
  type AccessGraphInput,
} from './access-graph';
import type { PermissionAction, PermissionEntity } from '../permissions';
import type { ScopeType } from '@/domains/shared/types';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export interface InheritedScopes {
  /** User has full tenant-wide access */
  hasTenantScope: boolean;
  /** All group IDs the user can access (direct + inherited) */
  groups: ReadonlySet<string>;
  /** All company IDs the user can access (direct + inherited from groups) */
  companies: ReadonlySet<string>;
  /** Inheritance chain for debugging: which role granted which scope */
  inheritanceChain: InheritanceEntry[];
}

export interface InheritanceEntry {
  role: string;
  scopeType: ScopeType;
  scopeId: string | null;
  /** IDs inherited through this role (e.g., group_admin inherits company IDs) */
  inheritedIds: string[];
  rule: 'TENANT_INHERITS_ALL' | 'GROUP_INHERITS_COMPANIES' | 'COMPANY_LOCAL_ONLY';
}

export interface AccessCheckResult {
  allowed: boolean;
  /** Why was the decision made */
  reason: string;
  /** Which layer decided: rbac, scope, or inherited */
  decidedBy: 'rbac' | 'scope' | 'inherited';
}

// ════════════════════════════════════
// ROLE INHERITANCE CLASSIFICATION
// ════════════════════════════════════

/** TenantAdmin: inherits ALL Groups and ALL Companies */
const TENANT_INHERIT_ALL = new Set([
  'superadmin', 'owner', 'admin', 'tenant_admin',
]);

/** GroupAdmin: inherits Companies within their group */
const GROUP_INHERIT_COMPANIES = new Set([
  'group_admin',
]);

/** CompanyAdmin: local access only, no inheritance */
const COMPANY_LOCAL_ONLY = new Set([
  'company_admin',
]);

// ════════════════════════════════════
// SERVICE
// ════════════════════════════════════

export const accessGraphService = {

  /**
   * Build a complete access graph for a user.
   * Populates the graph, precomputes caches, and sets the global singleton.
   * 
   * @example
   * const graph = accessGraphService.buildUserAccessGraph({
   *   userId: user.id,
   *   tenantId: tenant.id,
   *   userRoles,
   *   membershipRole,
   *   companyGroupMap,
   * });
   */
  buildUserAccessGraph(input: AccessGraphInput): AccessGraph {
    const graph = buildAccessGraph(input);
    setAccessGraph(graph);
    return graph;
  },

  /**
   * Check if a user can perform an action on a resource within a scope.
   * Combines RBAC (permission matrix) + scope resolution (graph traversal).
   * 
   * @param graph     - The user's precomputed AccessGraph
   * @param action    - What the user wants to do
   * @param resource  - What entity they want to act on
   * @param scopeId   - Optional: specific company or group ID
   * @param scopeType - Optional: 'company' | 'company_group' | 'tenant'
   * 
   * @example
   * // Can this user create employees in company X?
   * accessGraphService.checkAccess(graph, 'create', 'employees', companyId, 'company')
   */
  checkAccess(
    graph: AccessGraph,
    action: PermissionAction,
    resource: PermissionEntity,
    scopeId?: string | null,
    scopeType?: ScopeType,
  ): AccessCheckResult {
    // 1. RBAC check (does the role permit this action on this resource?)
    if (!graph.canPerform(resource, action)) {
      return {
        allowed: false,
        reason: `Role insuficiente para ${action} em ${resource}`,
        decidedBy: 'rbac',
      };
    }

    // 2. No scope target = tenant-level resource, RBAC is enough
    if (!scopeId || !scopeType) {
      return {
        allowed: true,
        reason: 'RBAC permitido, sem restrição de escopo',
        decidedBy: 'rbac',
      };
    }

    // 3. Tenant-wide users bypass all scope checks
    if (graph.hasTenantScope()) {
      return {
        allowed: true,
        reason: 'TenantAdmin herda acesso a todos os escopos',
        decidedBy: 'inherited',
      };
    }

    // 4. Scope check (direct + inherited)
    if (graph.canAccessScope(scopeType, scopeId)) {
      return {
        allowed: true,
        reason: `Acesso ao escopo ${scopeType}:${scopeId} via herança de grafo`,
        decidedBy: 'scope',
      };
    }

    return {
      allowed: false,
      reason: `Sem acesso ao escopo ${scopeType}:${scopeId}`,
      decidedBy: 'scope',
    };
  },

  /**
   * Resolve all inherited scopes for a user based on their roles.
   * Returns the complete set of groups and companies the user can access,
   * including those inherited through the hierarchy.
   * 
   * Inheritance rules:
   *   - TenantAdmin → ALL groups + ALL companies
   *   - GroupAdmin  → all companies WITHIN their assigned groups
   *   - CompanyAdmin → only their assigned company (no inheritance)
   * 
   * @example
   * const scopes = accessGraphService.resolveInheritedScopes(graph);
   * scopes.companies // Set<string> of all company IDs user can access
   * scopes.inheritanceChain // detailed breakdown of how each scope was derived
   */
  resolveInheritedScopes(graph: AccessGraph): InheritedScopes {
    const inheritanceChain: InheritanceEntry[] = [];
    const hasTenantScope = graph.hasTenantScope();

    // Walk the graph edges to build the inheritance chain
    const edges = graph.getEdges();
    const nodes = graph.getNodes();

    // Find all role nodes connected to the user
    const roleEdges = edges.filter(e => e.relation === 'HAS_ROLE');

    for (const roleEdge of roleEdges) {
      const roleNode = nodes.get(roleEdge.to);
      if (!roleNode?.meta) continue;

      const role = roleNode.meta.role as string;
      const scopeType = (roleNode.meta.scopeType as ScopeType) || 'tenant';
      const scopeId = (roleNode.meta.scopeId as string) || null;

      if (TENANT_INHERIT_ALL.has(role)) {
        // TenantAdmin: inherits everything
        const allGroupIds = Array.from(nodes.values())
          .filter(n => n.type === 'company_group')
          .map(n => n.id);
        const allCompanyIds = Array.from(nodes.values())
          .filter(n => n.type === 'company')
          .map(n => n.id);

        inheritanceChain.push({
          role,
          scopeType: 'tenant',
          scopeId: null,
          inheritedIds: [...allGroupIds, ...allCompanyIds],
          rule: 'TENANT_INHERITS_ALL',
        });
      } else if (GROUP_INHERIT_COMPANIES.has(role) && scopeType === 'company_group' && scopeId) {
        // GroupAdmin: inherits companies within the group
        const companiesInGroup = edges
          .filter(e => e.relation === 'BELONGS_TO' && e.to === scopeId)
          .map(e => e.from)
          .filter(id => nodes.get(id)?.type === 'company');

        inheritanceChain.push({
          role,
          scopeType: 'company_group',
          scopeId,
          inheritedIds: companiesInGroup,
          rule: 'GROUP_INHERITS_COMPANIES',
        });
      } else if (COMPANY_LOCAL_ONLY.has(role) && scopeType === 'company' && scopeId) {
        // CompanyAdmin: local only
        inheritanceChain.push({
          role,
          scopeType: 'company',
          scopeId,
          inheritedIds: [],
          rule: 'COMPANY_LOCAL_ONLY',
        });
      }
    }

    return {
      hasTenantScope,
      groups: graph.getReachableGroups(),
      companies: graph.getReachableCompanies(),
      inheritanceChain,
    };
  },
};
