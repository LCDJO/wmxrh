/**
 * Scoped Query Builder
 * 
 * DATA ISOLATION LAYER — ensures every query automatically applies:
 *   1. WHERE tenant_id = context.tenant_id  (ALWAYS)
 *   2. AND company_group_id IN allowed_scopes  (if user has group-level scope)
 *   3. AND company_id IN allowed_scopes  (if user has company-level scope)
 * 
 * This is DEFENSE IN DEPTH on top of RLS policies.
 */

import type { ScopeType, UserRole } from './types';

// ========================
// SCOPE CONTEXT
// ========================

export interface QueryScope {
  tenantId: string;
  /** User's allowed scopes derived from user_roles */
  userRoles: UserRole[];
  /** Current UI scope selection (optional narrowing) */
  scopeLevel: ScopeType;
  groupId: string | null;
  companyId: string | null;
}

/**
 * Compute the effective scope filters from user roles.
 */
export function computeScopeFilters(userRoles: UserRole[]): {
  hasTenantScope: boolean;
  allowedGroupIds: string[];
  allowedCompanyIds: string[];
} {
  const hasTenantScope = userRoles.some(r => r.scope_type === 'tenant');
  
  if (hasTenantScope) {
    return { hasTenantScope: true, allowedGroupIds: [], allowedCompanyIds: [] };
  }

  const allowedGroupIds = [
    ...new Set(
      userRoles
        .filter(r => r.scope_type === 'company_group' && r.scope_id)
        .map(r => r.scope_id!)
    ),
  ];

  const allowedCompanyIds = [
    ...new Set(
      userRoles
        .filter(r => r.scope_type === 'company' && r.scope_id)
        .map(r => r.scope_id!)
    ),
  ];

  return { hasTenantScope: false, allowedGroupIds, allowedCompanyIds };
}

// ========================
// SCOPED QUERY APPLIER
// ========================

/**
 * Apply scope filters to an existing Supabase query builder.
 * Works with the typed query returned by supabase.from(table).select().
 * 
 * Usage:
 *   const query = supabase.from('employees').select('*');
 *   const scoped = applyScope(query, scope);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyScope<Q extends { eq: any; in: any; or: any; is: any }>(
  query: Q,
  scope: QueryScope,
  opts: {
    tenantColumn?: string;
    groupColumn?: string;
    companyColumn?: string;
    skipSoftDelete?: boolean;
    softDeleteColumn?: string;
    skipScopeFilter?: boolean;
  } = {}
): Q {
  const {
    tenantColumn = 'tenant_id',
    groupColumn = 'company_group_id',
    companyColumn = 'company_id',
    skipSoftDelete = false,
    softDeleteColumn = 'deleted_at',
    skipScopeFilter = false,
  } = opts;

  // ALWAYS filter by tenant
  let q = query.eq(tenantColumn, scope.tenantId);

  // Soft-delete filter
  if (!skipSoftDelete) {
    q = q.is(softDeleteColumn, null);
  }

  if (skipScopeFilter) return q;

  // Apply ABAC scope filters
  const { hasTenantScope, allowedGroupIds, allowedCompanyIds } = computeScopeFilters(scope.userRoles);

  if (!hasTenantScope) {
    if (allowedGroupIds.length > 0 && allowedCompanyIds.length > 0) {
      q = q.or(
        `${groupColumn}.in.(${allowedGroupIds.join(',')}),${companyColumn}.in.(${allowedCompanyIds.join(',')})`
      );
    } else if (allowedGroupIds.length > 0) {
      q = q.in(groupColumn, allowedGroupIds);
    } else if (allowedCompanyIds.length > 0) {
      q = q.in(companyColumn, allowedCompanyIds);
    }
  }

  // UI scope narrowing
  if (scope.companyId) {
    q = q.eq(companyColumn, scope.companyId);
  } else if (scope.groupId) {
    q = q.eq(groupColumn, scope.groupId);
  }

  return q;
}

/**
 * Create a scoped INSERT payload that automatically injects tenant_id.
 * Strips any client-supplied tenant_id to prevent injection.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopedInsert<T>(
  dto: T,
  scope: QueryScope
): T {
  const result = { ...dto } as any;
  result.tenant_id = scope.tenantId;
  return result as T;
}
