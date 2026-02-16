/**
 * useSecurityKernel — Master hook that orchestrates the entire Security Kernel.
 * 
 * Provides a unified API combining:
 *   - Identity resolution
 *   - Permission checks
 *   - Policy evaluation
 *   - Scope resolution
 *   - Feature flag queries
 *   - Audit logging
 * 
 * Usage:
 *   const kernel = useSecurityKernel();
 *   if (!kernel.can('employees', 'create')) { ... }
 *   if (!kernel.isFeatureEnabled('MFA')) { ... }
 *   kernel.audit.logAccessDenied({ resource: '...', reason: '...' });
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useScope } from '@/contexts/ScopeContext';
import { useTenant } from '@/contexts/TenantContext';

import {
  resolveIdentity,
  permissionEngine,
  policyEngine,
  resolveScope,
  featureFlagEngine,
  auditSecurity,
  type Identity,
  type ScopeResolution,
  type PolicyResult,
} from './kernel';

import type { PermissionAction, PermissionEntity, NavKey } from './permissions';
import type { TenantRole } from '@/domains/shared/types';
import type { SecurityFeatureKey } from './feature-flags';

export interface UseSecurityKernelReturn {
  // ── Identity ──
  identity: Identity | null;
  isAuthenticated: boolean;

  // ── Permissions ──
  can: (entity: PermissionEntity, action: PermissionAction) => boolean;
  canNav: (navKey: NavKey) => boolean;
  hasRole: (...roles: TenantRole[]) => boolean;
  effectiveRoles: TenantRole[];

  // ── Policy ──
  evaluatePolicy: () => PolicyResult;

  // ── Scope ──
  scope: ScopeResolution | null;

  // ── Feature Flags ──
  isFeatureEnabled: (feature: SecurityFeatureKey) => boolean;

  // ── Audit ──
  audit: typeof auditSecurity;

  // ── Loading ──
  loading: boolean;

  // ── Convenience ──
  isTenantAdmin: boolean;
  canManageEmployees: boolean;
  canManageCompensation: boolean;
  canViewCompensation: boolean;
}

export function useSecurityKernel(): UseSecurityKernelReturn {
  const { user, session } = useAuth();
  const { currentTenant } = useTenant();
  const {
    effectiveRoles,
    hasRole,
    rolesLoading,
    userRoles,
    membershipRole,
    scope: uiScope,
  } = useScope();

  // ── Identity ──
  const identity = useMemo(
    () => resolveIdentity(user, session),
    [user, session]
  );

  // ── Scope ──
  const scopeResolution = useMemo(() => {
    if (!currentTenant) return null;
    return resolveScope({
      tenantId: currentTenant.id,
      userRoles,
      membershipRole,
      uiScopeLevel:
        uiScope.level === 'tenant' ? 'tenant' :
        uiScope.level === 'group' ? 'company_group' : 'company',
      uiGroupId: uiScope.groupId,
      uiCompanyId: uiScope.companyId,
    });
  }, [currentTenant, userRoles, membershipRole, uiScope]);

  // ── Permissions (bound to current roles) ──
  const can = useCallback(
    (entity: PermissionEntity, action: PermissionAction) =>
      permissionEngine.can(entity, action, effectiveRoles),
    [effectiveRoles]
  );

  const canNav = useCallback(
    (navKey: NavKey) => permissionEngine.canNav(navKey, effectiveRoles),
    [effectiveRoles]
  );

  // ── Policy ──
  const evaluatePolicy = useCallback((): PolicyResult => {
    if (!identity || !scopeResolution) {
      return { decision: 'deny', reason: 'Contexto não resolvido.', policyId: 'no_context' };
    }
    return policyEngine.evaluate({
      userId: identity.userId,
      tenantId: scopeResolution.tenantId,
      roles: effectiveRoles,
      scope: scopeResolution,
    });
  }, [identity, scopeResolution, effectiveRoles]);

  // ── Feature Flags ──
  const isFeatureEnabled = useCallback(
    (feature: SecurityFeatureKey) =>
      featureFlagEngine.isEnabled(feature, {
        tenantId: currentTenant?.id,
        roles: effectiveRoles,
      }),
    [currentTenant, effectiveRoles]
  );

  // ── Convenience ──
  const isTenantAdmin = useMemo(
    () => hasRole('superadmin', 'owner', 'admin', 'tenant_admin'),
    [effectiveRoles]
  );

  const canManageEmployees = useMemo(
    () => permissionEngine.can('employees', 'create', effectiveRoles),
    [effectiveRoles]
  );

  const canManageCompensation = useMemo(
    () => permissionEngine.can('compensation', 'create', effectiveRoles),
    [effectiveRoles]
  );

  const canViewCompensation = useMemo(
    () => permissionEngine.can('compensation', 'view', effectiveRoles),
    [effectiveRoles]
  );

  return {
    identity,
    isAuthenticated: !!user,
    can,
    canNav,
    hasRole,
    effectiveRoles,
    evaluatePolicy,
    scope: scopeResolution,
    isFeatureEnabled,
    audit: auditSecurity,
    loading: rolesLoading,
    isTenantAdmin,
    canManageEmployees,
    canManageCompensation,
    canViewCompensation,
  };
}
