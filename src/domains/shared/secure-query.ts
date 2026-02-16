/**
 * Secure Query Builder
 * 
 * Builds query scopes directly from SecurityContext.
 * Domain services use this instead of raw QueryScope.
 * 
 * ╔══════════════════════════════════════════════════════════╗
 * ║  EVERY query gets automatic isolation:                    ║
 * ║    WHERE tenant_id = securityContext.tenant_id            ║
 * ║    AND group_id IN securityContext.allowed_scopes         ║
 * ║    AND company_id IN securityContext.allowed_scopes       ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import type { QueryScope } from './scoped-query';
import { applyScope, scopedInsert } from './scoped-query';
import type { ScopeType, UserRole } from './types';

// ════════════════════════════════════
// CONTEXT → QUERY SCOPE
// ════════════════════════════════════

/**
 * Build a QueryScope from SecurityContext.
 * tenant_id ALWAYS from the validated context, never frontend.
 */
export function buildSecureQueryScope(ctx: SecurityContext): QueryScope {
  const sr = ctx.meta.scopeResolution;

  // Reconstruct UserRole-like objects from SecurityContext scopes
  const userRoles: UserRole[] = ctx.scopes.map(s => ({
    id: '',
    user_id: ctx.user_id,
    tenant_id: ctx.tenant_id,
    role: ctx.roles[0] || 'viewer',
    scope_type: s.type,
    scope_id: s.id,
    created_at: '',
  })) as UserRole[];

  return {
    tenantId: ctx.tenant_id,
    userRoles,
    scopeLevel: sr.uiScope.level,
    groupId: sr.uiScope.groupId,
    companyId: sr.uiScope.companyId,
  };
}

// ════════════════════════════════════
// SECURE QUERY HELPERS
// ════════════════════════════════════

/**
 * Apply security scope to a Supabase query using SecurityContext.
 * This is the PREFERRED way to scope queries.
 * 
 * Usage:
 *   const q = secureQuery(supabase.from('employees').select('*'), ctx);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function secureQuery<Q extends { eq: any; in: any; or: any; is: any }>(
  query: Q,
  ctx: SecurityContext,
  opts: {
    tenantColumn?: string;
    groupColumn?: string;
    companyColumn?: string;
    skipSoftDelete?: boolean;
    softDeleteColumn?: string;
    skipScopeFilter?: boolean;
  } = {}
): Q {
  return applyScope(query, buildSecureQueryScope(ctx), opts);
}

/**
 * Build a secure INSERT payload from SecurityContext.
 * Overrides any client-supplied tenant_id.
 */
export function secureInsert<T>(dto: T, ctx: SecurityContext): T {
  return scopedInsert(dto, buildSecureQueryScope(ctx));
}
