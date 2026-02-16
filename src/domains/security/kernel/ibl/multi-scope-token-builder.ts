/**
 * IBL Component 4 — MultiScopeTokenBuilder
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Builds tokens/payloads that encode multi-scope access:      ║
 * ║                                                              ║
 * ║    - ScopeToken: lightweight object passed to query builders ║
 * ║    - SecurityContextPayload: enriched payload for pipeline   ║
 * ║    - QueryFilterSet: precomputed WHERE clause fragments      ║
 * ║                                                              ║
 * ║  Consumed by: ScopedQuery, SecureQuery, SecurityPipeline     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type { TenantRole, UserRole, ScopeType } from '@/domains/shared/types';
import type { IdentitySession, OperationalContext } from '../identity-boundary.types';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

/**
 * Lightweight token encoding the user's multi-scope access.
 * Passed to query builders for efficient WHERE clause construction.
 */
export interface ScopeToken {
  /** Currently active tenant */
  tenantId: string;
  /** Active scope level */
  scopeLevel: ScopeType;
  /** Active group ID (if drilled down) */
  groupId: string | null;
  /** Active company ID (if drilled down) */
  companyId: string | null;
  /** Whether user has tenant-wide access */
  hasTenantScope: boolean;
  /** All group IDs the user can access */
  allowedGroupIds: string[];
  /** All company IDs the user can access */
  allowedCompanyIds: string[];
  /** Effective roles for the current tenant */
  effectiveRoles: TenantRole[];
  /** Token generation timestamp */
  issuedAt: number;
}

/**
 * Precomputed filter set for database queries.
 * Avoids recomputing scope filters on every query.
 */
export interface QueryFilterSet {
  /** Always filter by tenant */
  tenantId: string;
  /** If true, no group/company filters needed */
  bypassScopeFilters: boolean;
  /** Group IDs to filter by (empty if tenant-wide) */
  groupIds: string[];
  /** Company IDs to filter by (empty if tenant-wide) */
  companyIds: string[];
  /** For UI-narrowed scope: specific group */
  activeGroupId: string | null;
  /** For UI-narrowed scope: specific company */
  activeCompanyId: string | null;
}

// ════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════

const TENANT_WIDE_ROLES: TenantRole[] = [
  'superadmin', 'owner', 'admin', 'tenant_admin',
];

// ════════════════════════════════════
// BUILDER (stateless)
// ════════════════════════════════════

export const multiScopeTokenBuilder = {
  /**
   * Build a ScopeToken from IdentitySession + OperationalContext.
   * This is the primary token used across the system.
   */
  buildScopeToken(
    identity: IdentitySession,
    context: OperationalContext,
  ): ScopeToken {
    const hasTenantScope = context.effectiveRoles.some(
      r => TENANT_WIDE_ROLES.includes(r)
    );

    const tenantUserRoles = identity.allUserRoles.filter(
      r => r.tenant_id === context.activeTenantId
    );

    const { allowedGroupIds, allowedCompanyIds } = extractAllowedScopes(
      tenantUserRoles,
      hasTenantScope,
    );

    return {
      tenantId: context.activeTenantId,
      scopeLevel: context.scopeLevel,
      groupId: context.activeGroupId,
      companyId: context.activeCompanyId,
      hasTenantScope,
      allowedGroupIds,
      allowedCompanyIds,
      effectiveRoles: [...context.effectiveRoles],
      issuedAt: Date.now(),
    };
  },

  /**
   * Build a QueryFilterSet for efficient database queries.
   * Precomputes all the scope filters so query builders
   * don't need to recompute on every call.
   */
  buildQueryFilters(token: ScopeToken): QueryFilterSet {
    // If user has a specific scope selected in UI, narrow to that
    if (token.companyId) {
      return {
        tenantId: token.tenantId,
        bypassScopeFilters: false,
        groupIds: [],
        companyIds: [token.companyId],
        activeGroupId: token.groupId,
        activeCompanyId: token.companyId,
      };
    }

    if (token.groupId) {
      return {
        tenantId: token.tenantId,
        bypassScopeFilters: false,
        groupIds: [token.groupId],
        companyIds: [],
        activeGroupId: token.groupId,
        activeCompanyId: null,
      };
    }

    // No UI narrowing: use full allowed scope set
    return {
      tenantId: token.tenantId,
      bypassScopeFilters: token.hasTenantScope,
      groupIds: token.allowedGroupIds,
      companyIds: token.allowedCompanyIds,
      activeGroupId: null,
      activeCompanyId: null,
    };
  },

  /**
   * Build a compact token fingerprint for caching.
   * Two identical access profiles will produce the same fingerprint.
   */
  fingerprint(token: ScopeToken): string {
    const roles = [...token.effectiveRoles].sort().join(',');
    const groups = token.allowedGroupIds.sort().join(',');
    const companies = token.allowedCompanyIds.sort().join(',');
    return `${token.tenantId}:${roles}:${groups}:${companies}:${token.scopeLevel}:${token.groupId || '*'}:${token.companyId || '*'}`;
  },
};

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

function extractAllowedScopes(
  userRoles: ReadonlyArray<UserRole>,
  hasTenantScope: boolean,
): { allowedGroupIds: string[]; allowedCompanyIds: string[] } {
  if (hasTenantScope) {
    return { allowedGroupIds: [], allowedCompanyIds: [] };
  }

  const groupIds = new Set<string>();
  const companyIds = new Set<string>();

  for (const r of userRoles) {
    if (r.scope_type === 'company_group' && r.scope_id) {
      groupIds.add(r.scope_id);
    }
    if (r.scope_type === 'company' && r.scope_id) {
      companyIds.add(r.scope_id);
    }
  }

  return {
    allowedGroupIds: Array.from(groupIds),
    allowedCompanyIds: Array.from(companyIds),
  };
}
