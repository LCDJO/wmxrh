/**
 * SecurityKernel — PermissionEngine (RBAC + ABAC)
 * 
 * Two-layer authorization:
 *   1. RBAC — Does the user's role allow this action on this resource?
 *   2. ABAC — Does the user's scope grant access to the target entity?
 * 
 * Primary API:
 *   checkPermission(action, resource, securityContext) → PermissionResult
 * 
 * The engine is STATELESS — all state comes from SecurityContext.
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
// RBAC LAYER
// ════════════════════════════════════

function checkRBAC(
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
// ABAC LAYER (Scope-based)
// ════════════════════════════════════

/**
 * Checks if user's scopes grant access to the target resource.
 * 
 * Hierarchy: tenant > company_group > company
 *   - tenant scope → access to everything in the tenant
 *   - company_group scope → access to all companies in that group
 *   - company scope → access to that specific company only
 */
function checkABAC(
  scopes: SecurityScope[],
  target?: ResourceTarget
): PermissionResult {
  // No target specified = no ABAC restriction
  if (!target) return { decision: 'allow' };

  // Tenant-level scope = full access
  const hasTenantScope = scopes.some(s => s.type === 'tenant');
  if (hasTenantScope) return { decision: 'allow' };

  // Check company_group access
  if (target.company_group_id) {
    const hasGroupAccess = scopes.some(
      s => s.type === 'company_group' && s.id === target.company_group_id
    );
    if (hasGroupAccess) return { decision: 'allow' };
  }

  // Check company access
  if (target.company_id) {
    const hasCompanyAccess = scopes.some(
      s => s.type === 'company' && s.id === target.company_id
    );
    if (hasCompanyAccess) return { decision: 'allow' };

    // Group-scoped users can access companies within their groups
    // (RLS double-checks on the backend)
    const hasAnyGroupScope = scopes.some(s => s.type === 'company_group');
    if (hasAnyGroupScope) return { decision: 'allow' };
  }

  // If target has neither group nor company, it's tenant-level data
  if (!target.company_group_id && !target.company_id) {
    // Only tenant-scoped users can access tenant-level resources
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
// PRIMARY API
// ════════════════════════════════════

/**
 * checkPermission — The single entry point for authorization.
 * 
 * Evaluates RBAC (role matrix) then ABAC (scope hierarchy).
 * Both must pass for the action to be allowed.
 * 
 * @param action    - What the user wants to do (view, create, update, delete)
 * @param resource  - What entity they want to act on
 * @param ctx       - The SecurityContext (contains roles + scopes)
 * @param target    - Optional: the specific resource's location for ABAC
 */
export function checkPermission(
  action: PermissionAction,
  resource: PermissionEntity,
  ctx: SecurityContext,
  target?: ResourceTarget
): PermissionResult {
  // 1. RBAC check
  const rbacResult = checkRBAC(action, resource, ctx.roles);
  if (rbacResult.decision === 'deny') return rbacResult;

  // 2. ABAC check (scope-based)
  const abacResult = checkABAC(ctx.scopes, target);
  if (abacResult.decision === 'deny') return abacResult;

  return { decision: 'allow' };
}

// ════════════════════════════════════
// ENGINE API (backward compat + extras)
// ════════════════════════════════════

export interface PermissionEngineAPI {
  /** Primary: RBAC + ABAC check using SecurityContext */
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
  /** ABAC-only: check scope access to a target */
  checkScopeAccess: (scopes: SecurityScope[], target: ResourceTarget) => PermissionResult;
}

export const permissionEngine: PermissionEngineAPI = {
  checkPermission,

  can: (entity, action, roles) => hasPermission(entity, action, roles),

  canNav: (navKey, roles) => canAccessNavItem(navKey, roles),

  hasAnyRole: (userRoles, ...targetRoles) =>
    userRoles.some(r => targetRoles.includes(r)),

  canAll: (checks, roles) =>
    checks.every(c => hasPermission(c.entity, c.action, roles)),

  canAny: (checks, roles) =>
    checks.some(c => hasPermission(c.entity, c.action, roles)),

  getAllowedRoles: (entity, action) =>
    PERMISSION_MATRIX[entity]?.[action] ?? [],

  checkScopeAccess: (scopes, target) => checkABAC(scopes, target),
};
