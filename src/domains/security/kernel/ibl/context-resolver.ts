/**
 * IBL Component 3 — ContextResolver
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Pure-function resolver:                                     ║
 * ║    - Computes effectiveRoles from identity + membership      ║
 * ║    - Filters user_roles by tenant                            ║
 * ║    - Validates scope access against role grants              ║
 * ║                                                              ║
 * ║  NO SIDE EFFECTS. NO STATE. Stateless computation only.      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type { TenantRole, UserRole, ScopeType } from '@/domains/shared/types';
import type { IdentitySession } from '../identity-boundary.types';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export interface ResolvedContext {
  /** Effective roles for the target tenant */
  effectiveRoles: TenantRole[];
  /** User roles scoped to the target tenant */
  tenantUserRoles: ReadonlyArray<UserRole>;
}

export interface ScopeValidation {
  allowed: boolean;
  reason: string;
}

// ════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════

const TENANT_WIDE_ROLES: TenantRole[] = [
  'superadmin', 'owner', 'admin', 'tenant_admin',
];

// ════════════════════════════════════
// RESOLVER (stateless)
// ════════════════════════════════════

export const contextResolver = {
  /**
   * Resolve effective roles and tenant-scoped user_roles for a target tenant.
   */
  resolve(
    identity: IdentitySession,
    membershipRole: TenantRole,
    targetTenantId: string,
  ): ResolvedContext {
    const tenantUserRoles = identity.allUserRoles.filter(
      r => r.tenant_id === targetTenantId
    );

    const roles = new Set<TenantRole>();
    roles.add(membershipRole);
    for (const ur of tenantUserRoles) {
      roles.add(ur.role);
    }

    return {
      effectiveRoles: Array.from(roles),
      tenantUserRoles,
    };
  },

  /**
   * Validate whether the given roles grant access to the specified scope.
   * Pure validation — no side effects.
   */
  validateScopeAccess(
    effectiveRoles: TenantRole[],
    userRoles: ReadonlyArray<UserRole>,
    scopeLevel: ScopeType,
    groupId: string | null,
    companyId: string | null,
  ): ScopeValidation {
    // Tenant-wide roles can access any scope
    if (effectiveRoles.some(r => TENANT_WIDE_ROLES.includes(r))) {
      return { allowed: true, reason: 'Tenant-wide access' };
    }

    // Tenant level: always allowed (RLS enforces actual data access)
    if (scopeLevel === 'tenant') {
      return { allowed: true, reason: 'Tenant scope allowed (RLS enforces data access)' };
    }

    // Group scope: user must have a role scoped to this group
    if (scopeLevel === 'company_group' && groupId) {
      const hasGroupAccess = userRoles.some(
        r => r.scope_type === 'company_group' && r.scope_id === groupId
      ) || userRoles.some(r => r.scope_type === 'tenant');

      if (!hasGroupAccess) {
        return { allowed: false, reason: `Sem acesso ao grupo ${groupId}` };
      }
    }

    // Company scope: user must have company or group access
    if (scopeLevel === 'company' && companyId) {
      const hasCompanyAccess = userRoles.some(
        r => r.scope_type === 'company' && r.scope_id === companyId
      ) || userRoles.some(
        r => r.scope_type === 'company_group'
      ) || userRoles.some(r => r.scope_type === 'tenant');

      if (!hasCompanyAccess) {
        return { allowed: false, reason: `Sem acesso à empresa ${companyId}` };
      }
    }

    return { allowed: true, reason: 'Scope access validated' };
  },

  /**
   * Check if user has tenant-wide access in the given roles.
   */
  hasTenantWideAccess(effectiveRoles: TenantRole[]): boolean {
    return effectiveRoles.some(r => TENANT_WIDE_ROLES.includes(r));
  },
};
