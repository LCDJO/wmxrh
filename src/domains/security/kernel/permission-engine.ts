/**
 * SecurityKernel — PermissionEngine (RBAC + ABAC)
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  DELEGATES TO ACCESS GRAPH for all authorization checks.    ║
 * ║                                                              ║
 * ║  checkPermission() → AccessGraph.canAccess() (O(1))         ║
 * ║                                                              ║
 * ║  The engine itself is STATELESS — it reads the precomputed  ║
 * ║  AccessGraph for O(1) lookups instead of manual traversal.  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import {
  hasPermission,
  canAccessNavItem,
  PERMISSION_MATRIX,
  type PermissionAction,
  type PermissionEntity,
  type NavKey,
} from '../permissions';
import type { TenantRole } from '@/domains/shared/types';
import type { SecurityContext, SecurityScope } from './identity.service';
import { getAccessGraph } from './access-graph';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export interface PermissionCheck {
  entity: PermissionEntity;
  action: PermissionAction;
}

export type PermissionDecision = 'allow' | 'deny';

export interface PermissionResult {
  decision: PermissionDecision;
  /** Which check failed */
  failedCheck?: 'rbac' | 'abac';
  reason?: string;
}

/** Target resource location for ABAC evaluation */
export interface ResourceTarget {
  tenant_id?: string;
  company_group_id?: string | null;
  company_id?: string | null;
}

// ════════════════════════════════════
// FALLBACK: manual RBAC (when no graph)
// ════════════════════════════════════

function checkRBACFallback(
  action: PermissionAction,
  resource: PermissionEntity,
  roles: TenantRole[]
): PermissionResult {
  if (hasPermission(resource, action, roles)) {
    return { decision: 'allow' };
  }
  return {
    decision: 'deny',
    failedCheck: 'rbac',
    reason: `Role insuficiente para ${action} em ${resource}. Roles: [${roles.join(', ')}]`,
  };
}

// ════════════════════════════════════
// FALLBACK: manual ABAC (when no graph)
// ════════════════════════════════════

function checkABACFallback(
  scopes: SecurityScope[],
  target?: ResourceTarget
): PermissionResult {
  if (!target) return { decision: 'allow' };

  const hasTenantScope = scopes.some(s => s.type === 'tenant');
  if (hasTenantScope) return { decision: 'allow' };

  if (target.company_group_id) {
    const hasGroupAccess = scopes.some(
      s => s.type === 'company_group' && s.id === target.company_group_id
    );
    if (hasGroupAccess) return { decision: 'allow' };
  }

  if (target.company_id) {
    const hasCompanyAccess = scopes.some(
      s => s.type === 'company' && s.id === target.company_id
    );
    if (hasCompanyAccess) return { decision: 'allow' };

    const hasAnyGroupScope = scopes.some(s => s.type === 'company_group');
    if (hasAnyGroupScope) return { decision: 'allow' };
  }

  if (!target.company_group_id && !target.company_id) {
    return {
      decision: 'deny',
      failedCheck: 'abac',
      reason: 'Escopo insuficiente para acessar recurso no nível tenant.',
    };
  }

  return {
    decision: 'deny',
    failedCheck: 'abac',
    reason: `Escopo insuficiente. Alvo: group=${target.company_group_id}, company=${target.company_id}`,
  };
}

// ════════════════════════════════════
// PRIMARY API — delegates to AccessGraph
// ════════════════════════════════════

/**
 * checkPermission — The single entry point for authorization.
 * 
 * DELEGATES to AccessGraph when available (O(1) precomputed lookups).
 * Falls back to manual RBAC+ABAC when graph is not built yet.
 */
export function checkPermission(
  action: PermissionAction,
  resource: PermissionEntity,
  ctx: SecurityContext,
  target?: ResourceTarget
): PermissionResult {
  // ── Try AccessGraph first (O(1) path) ──
  const graph = getAccessGraph();
  if (graph) {
    // RBAC: O(1) hash lookup
    if (!graph.canPerform(resource, action)) {
      return {
        decision: 'deny',
        failedCheck: 'rbac',
        reason: `Role insuficiente para ${action} em ${resource}. Roles: [${ctx.roles.join(', ')}]`,
      };
    }

    // ABAC: O(1) via canAccess (combines scope check)
    if (target) {
      const canAccess = graph.canAccess(resource, action, {
        company_group_id: target.company_group_id,
        company_id: target.company_id,
      });
      if (!canAccess) {
        return {
          decision: 'deny',
          failedCheck: 'abac',
          reason: `Escopo insuficiente. Alvo: group=${target.company_group_id}, company=${target.company_id}`,
        };
      }
    }

    return { decision: 'allow' };
  }

  // ── Fallback: manual RBAC + ABAC (no graph available) ──
  const rbacResult = checkRBACFallback(action, resource, ctx.roles);
  if (rbacResult.decision === 'deny') return rbacResult;

  const abacResult = checkABACFallback(ctx.scopes, target);
  if (abacResult.decision === 'deny') return abacResult;

  return { decision: 'allow' };
}

// ════════════════════════════════════
// ENGINE API (backward compat + extras)
// ════════════════════════════════════

export interface PermissionEngineAPI {
  /** Primary: RBAC + ABAC check using SecurityContext (delegates to AccessGraph) */
  checkPermission: typeof checkPermission;
  /** RBAC-only: check if roles can perform action on entity */
  can: (entity: PermissionEntity, action: PermissionAction, roles: TenantRole[]) => boolean;
  /** RBAC-only: check if roles can access a nav item */
  canNav: (navKey: NavKey, roles: TenantRole[]) => boolean;
  /** Check if roles include any of the given roles */
  hasAnyRole: (userRoles: TenantRole[], ...targetRoles: TenantRole[]) => boolean;
  /** Batch check multiple permissions (RBAC only) */
  canAll: (checks: PermissionCheck[], roles: TenantRole[]) => boolean;
  /** Batch check — returns true if at least one passes (RBAC only) */
  canAny: (checks: PermissionCheck[], roles: TenantRole[]) => boolean;
  /** Get allowed roles for an entity+action */
  getAllowedRoles: (entity: PermissionEntity, action: PermissionAction) => TenantRole[];
  /** ABAC-only: check scope access to a target (fallback, prefer AccessGraph) */
  checkScopeAccess: (scopes: SecurityScope[], target: ResourceTarget) => PermissionResult;
}

export const permissionEngine: PermissionEngineAPI = {
  checkPermission,

  can: (entity, action, roles) => {
    // Use AccessGraph if available for O(1) lookup
    const graph = getAccessGraph();
    if (graph) return graph.canPerform(entity, action);
    return hasPermission(entity, action, roles);
  },

  canNav: (navKey, roles) => canAccessNavItem(navKey, roles),

  hasAnyRole: (userRoles, ...targetRoles) =>
    userRoles.some(r => targetRoles.includes(r)),

  canAll: (checks, roles) => {
    const graph = getAccessGraph();
    if (graph) return checks.every(c => graph.canPerform(c.entity, c.action));
    return checks.every(c => hasPermission(c.entity, c.action, roles));
  },

  canAny: (checks, roles) => {
    const graph = getAccessGraph();
    if (graph) return checks.some(c => graph.canPerform(c.entity, c.action));
    return checks.some(c => hasPermission(c.entity, c.action, roles));
  },

  getAllowedRoles: (entity, action) =>
    PERMISSION_MATRIX[entity]?.[action] ?? [],

  checkScopeAccess: (scopes, target) => checkABACFallback(scopes, target),
};
