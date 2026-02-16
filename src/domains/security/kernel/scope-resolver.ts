/**
 * SecurityKernel — ScopeResolver
 * 
 * Resolves the effective data scope for a user:
 *   - Tenant-wide (superadmin, owner, admin, tenant_admin)
 *   - Group-scoped (group_admin)
 *   - Company-scoped (company_admin)
 * 
 * This is the SINGLE SOURCE OF TRUTH for hierarchical scope resolution.
 * All query builders and guards consume this output.
 */

import type { TenantRole, UserRole, ScopeType } from '@/domains/shared/types';
import { computeScopeFilters } from '@/domains/shared/scoped-query';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export interface ScopeResolution {
  tenantId: string;
  /** Effective scope level after resolution */
  effectiveLevel: ScopeType;
  /** Whether user has full tenant access */
  hasTenantScope: boolean;
  /** Group IDs user can access (empty = all or none depending on hasTenantScope) */
  allowedGroupIds: string[];
  /** Company IDs user can access (empty = all or none depending on hasTenantScope) */
  allowedCompanyIds: string[];
  /** Current UI-narrowed scope */
  uiScope: {
    level: ScopeType;
    groupId: string | null;
    companyId: string | null;
  };
}

export interface ScopeResolverInput {
  tenantId: string;
  userRoles: UserRole[];
  membershipRole: TenantRole | null;
  /** Current UI scope selection */
  uiScopeLevel: ScopeType;
  uiGroupId: string | null;
  uiCompanyId: string | null;
}

// ════════════════════════════════════
// RESOLVER
// ════════════════════════════════════

const TENANT_WIDE_ROLES: TenantRole[] = [
  'superadmin', 'owner', 'admin', 'tenant_admin',
];

export function resolveScope(input: ScopeResolverInput): ScopeResolution {
  const { tenantId, userRoles, membershipRole, uiScopeLevel, uiGroupId, uiCompanyId } = input;

  // Compute from user_roles table
  const { hasTenantScope: hasTenantFromRoles, allowedGroupIds, allowedCompanyIds } =
    computeScopeFilters(userRoles);

  // Membership role can also grant tenant-wide access
  const hasTenantScope =
    hasTenantFromRoles ||
    (membershipRole ? TENANT_WIDE_ROLES.includes(membershipRole) : false);

  // Determine effective level
  let effectiveLevel: ScopeType = 'tenant';
  if (!hasTenantScope) {
    if (allowedGroupIds.length > 0 && allowedCompanyIds.length === 0) {
      effectiveLevel = 'company_group';
    } else if (allowedCompanyIds.length > 0) {
      effectiveLevel = 'company';
    }
  }

  return {
    tenantId,
    effectiveLevel,
    hasTenantScope,
    allowedGroupIds,
    allowedCompanyIds,
    uiScope: {
      level: uiScopeLevel,
      groupId: uiGroupId,
      companyId: uiCompanyId,
    },
  };
}
