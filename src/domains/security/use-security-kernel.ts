/**
 * useSecurityKernel — Master hook that orchestrates the entire Security Kernel.
 * 
 * Builds a SecurityContext on every auth/scope change and provides:
 *   - Full SecurityContext object
 *   - Permission checks (bound to current roles)
 *   - Policy evaluation
 *   - Feature flag queries
 *   - Audit logging
 * 
 * Usage:
 *   const kernel = useSecurityKernel();
 *   kernel.securityContext  // { request_id, user_id, tenant_id, scopes, roles, features }
 *   kernel.can('employees', 'create')
 *   kernel.isFeatureEnabled('MFA')
 *   kernel.audit.logAccessDenied({ resource: '...', reason: '...' })
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useScope } from '@/contexts/ScopeContext';
import { useTenant } from '@/contexts/TenantContext';

import {
  resolveIdentity,
  buildSecurityContext,
  permissionEngine,
  checkPermission,
  policyEngine,
  featureFlagEngine,
  auditSecurity,
  executeSecurityPipeline,
  accessGraphService,
  identityBoundary,
  dualIdentityEngine,
  type Identity,
  type SecurityContext,
  type PolicyResult,
  type PolicyEvalContext,
  type PermissionResult,
  type ResourceTarget,
  type PipelineResult,
  type AccessGraph,
  type AccessCheckResult,
  type InheritedScopes,
  type BoundaryIdentity,
  type OperationalContext,
  type ContextSwitchResult,
  type IdentityBoundarySnapshot,
  type RealIdentity,
  type ActiveIdentity,
  type ImpersonationSession,
} from './kernel';

import { accessGraphCache } from './kernel/access-graph.cache';
import { setAccessGraph } from './kernel/access-graph';

import type { PermissionAction, PermissionEntity, NavKey } from './permissions';
import type { TenantRole, ScopeType } from '@/domains/shared/types';
import type { SecurityFeatureKey, FeatureKey } from './feature-flags';

export interface UseSecurityKernelReturn {
  // ── SecurityContext (the universal auth envelope) ──
  securityContext: SecurityContext | null;

  // ── Identity Boundary Layer ──
  boundaryIdentity: BoundaryIdentity | null;
  operationalContext: OperationalContext | null;
  switchContext: (request: { targetTenantId?: string; targetScopeLevel?: ScopeType; targetGroupId?: string | null; targetCompanyId?: string | null }) => ContextSwitchResult;
  boundarySnapshot: () => IdentityBoundarySnapshot;
  availableTenants: ReadonlyArray<{ tenantId: string; tenantName: string; role: TenantRole }>;
  canSwitchToTenant: (tenantId: string) => boolean;

  // ── Identity ──
  identity: Identity | null;
  isAuthenticated: boolean;

  // ── Permissions (RBAC + ABAC) ──
  checkPermission: (action: PermissionAction, resource: PermissionEntity, target?: ResourceTarget) => PermissionResult;
  can: (entity: PermissionEntity, action: PermissionAction) => boolean;
  canNav: (navKey: NavKey) => boolean;
  hasRole: (...roles: TenantRole[]) => boolean;
  effectiveRoles: TenantRole[];

  // ── Policy (declarative rules) ──
  evaluateRules: (action: PermissionAction, resource: PermissionEntity, target?: ResourceTarget) => PolicyResult;
  evaluatePolicy: () => PolicyResult;

  // ── Feature Flags ──
  isFeatureEnabled: (feature: FeatureKey) => boolean;

  // ── Pipeline ──
  executePipeline: (action: PermissionAction, resource: PermissionEntity, target?: ResourceTarget) => PipelineResult;

  // ── Access Graph ──
  accessGraph: AccessGraph | null;
  graphCheckAccess: (action: PermissionAction, resource: PermissionEntity, scopeId?: string | null, scopeType?: ScopeType) => AccessCheckResult;
  resolveInheritedScopes: () => InheritedScopes | null;

  // ── Audit ──
  audit: typeof auditSecurity;

  // ── Dual Identity / Impersonation ──
  realIdentity: RealIdentity | null;
  activeIdentity: ActiveIdentity;
  isImpersonating: boolean;
  impersonationSession: ImpersonationSession | null;

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
  const { currentTenant, tenants, membership } = useTenant();
  const {
    effectiveRoles,
    hasRole,
    rolesLoading,
    userRoles,
    membershipRole,
    scope: uiScope,
  } = useScope();

  // ── Identity Boundary Layer ──
  const boundaryIdentity = useMemo(() => {
    if (!user || !session) {
      identityBoundary.clear();
      return null;
    }
    if (identityBoundary.identity?.userId === user.id) {
      return identityBoundary.identity;
    }
    return identityBoundary.establish({
      user,
      session,
      tenantMemberships: tenants.map(t => ({
        tenantId: t.id,
        tenantName: t.name,
        role: (membership?.tenant_id === t.id ? membership.role : 'viewer') as TenantRole,
      })),
      allUserRoles: userRoles,
    });
  }, [user, session, tenants, membership, userRoles]);

  // ── Sync operational context with ScopeContext ──
  const operationalContext = useMemo((): OperationalContext | null => {
    if (!boundaryIdentity || !currentTenant || !membership) return null;

    const scopeLevel: ScopeType =
      uiScope.level === 'tenant' ? 'tenant' :
      uiScope.level === 'group' ? 'company_group' : 'company';

    const result = identityBoundary.switchContext({
      targetTenantId: currentTenant.id,
      targetScopeLevel: scopeLevel,
      targetGroupId: uiScope.groupId,
      targetCompanyId: uiScope.companyId,
    });

    return result.success ? result.newContext : null;
  }, [boundaryIdentity, currentTenant, membership, uiScope]);

  const switchContext = useCallback(
    (request: { targetTenantId?: string; targetScopeLevel?: ScopeType; targetGroupId?: string | null; targetCompanyId?: string | null }): ContextSwitchResult => {
      return identityBoundary.switchContext(request);
    },
    []
  );

  const boundarySnapshot = useCallback(() => identityBoundary.snapshot(), []);

  const availableTenants = useMemo(
    () => identityBoundary.getAvailableTenants(),
    [boundaryIdentity]
  );

  const canSwitchToTenant = useCallback(
    (tenantId: string) => identityBoundary.canSwitchToTenant(tenantId),
    [boundaryIdentity]
  );

  // ── Identity ──
  const identity = useMemo(
    () => resolveIdentity(user, session),
    [user, session]
  );

  // ── SecurityContext ──
  const securityContext = useMemo((): SecurityContext | null => {
    if (!user || !session || !currentTenant) return null;

    const uiScopeLevel: ScopeType =
      uiScope.level === 'tenant' ? 'tenant' :
      uiScope.level === 'group' ? 'company_group' : 'company';

    return buildSecurityContext({
      user,
      session,
      tenantId: currentTenant.id,
      effectiveRoles,
      userRoles,
      membershipRole,
      uiScopeLevel,
      uiGroupId: uiScope.groupId,
      uiCompanyId: uiScope.companyId,
    });
  }, [user, session, currentTenant, effectiveRoles, userRoles, membershipRole, uiScope]);

  // ── Stable fingerprint to avoid unnecessary graph rebuilds ──
  // Only rebuild when the actual role data changes, not on every scope switch.
  const rolesFingerprint = useMemo(() => {
    const roleKeys = userRoles
      .map(r => `${r.role}:${r.scope_type}:${r.scope_id || '*'}`)
      .sort()
      .join('|');
    return `${membershipRole || ''}::${roleKeys}`;
  }, [userRoles, membershipRole]);

  // ── Access Graph (cached per user:tenant, reused across context switches) ──
  // PERFORMANCE: Context switches (group/company) do NOT rebuild the graph.
  // Only role changes or tenant switches trigger a rebuild.
  const accessGraph = useMemo((): AccessGraph | null => {
    if (!user || !currentTenant) return null;

    const cached = accessGraphCache.get(user.id, currentTenant.id);
    if (cached) {
      // Reuse cached graph — O(1) lookup, no rebuild
      setAccessGraph(cached.graph);
      return cached.graph;
    }

    // Cache miss — build and store
    const graph = accessGraphService.buildUserAccessGraph({
      userId: user.id,
      tenantId: currentTenant.id,
      userRoles,
      membershipRole,
      companyGroupMap: {},
    });

    if (graph) {
      accessGraphCache.set(user.id, currentTenant.id, graph);
    }

    return graph;
  }, [user, currentTenant, rolesFingerprint]);

  const graphCheckAccess = useCallback(
    (action: PermissionAction, resource: PermissionEntity, scopeId?: string | null, scopeType?: ScopeType): AccessCheckResult => {
      if (!accessGraph) {
        return { allowed: false, reason: 'AccessGraph não disponível', decidedBy: 'rbac' };
      }
      return accessGraphService.checkAccess(accessGraph, action, resource, scopeId, scopeType);
    },
    [accessGraph]
  );

  const resolveInheritedScopes = useCallback((): InheritedScopes | null => {
    if (!accessGraph) return null;
    return accessGraphService.resolveInheritedScopes(accessGraph);
  }, [accessGraph]);

  // ── Permissions (RBAC + ABAC) ──
  const checkPerm = useCallback(
    (action: PermissionAction, resource: PermissionEntity, target?: ResourceTarget): PermissionResult => {
      if (!securityContext) {
        return { decision: 'deny', failedCheck: 'rbac', reason: 'SecurityContext não disponível.' };
      }
      return checkPermission(action, resource, securityContext, target);
    },
    [securityContext]
  );

  const can = useCallback(
    (entity: PermissionEntity, action: PermissionAction) =>
      permissionEngine.can(entity, action, effectiveRoles),
    [effectiveRoles]
  );

  const canNav = useCallback(
    (navKey: NavKey) => permissionEngine.canNav(navKey, effectiveRoles),
    [effectiveRoles]
  );

  // ── Policy (declarative rules) ──
  const evaluateRules = useCallback(
    (action: PermissionAction, resource: PermissionEntity, target?: ResourceTarget): PolicyResult => {
      if (!securityContext) {
        return { decision: 'deny', reason: 'SecurityContext não disponível.', policyId: 'no_context' };
      }
      return policyEngine.evaluateRules({
        securityContext,
        action,
        resource,
        target: target ? {
          tenant_id: securityContext.tenant_id,
          company_group_id: target.company_group_id,
          company_id: target.company_id,
        } : undefined,
      });
    },
    [securityContext]
  );

  const evaluatePolicy = useCallback((): PolicyResult => {
    if (!securityContext) {
      return { decision: 'deny', reason: 'Contexto não resolvido.', policyId: 'no_context' };
    }
    return policyEngine.evaluate({
      userId: securityContext.user_id,
      tenantId: securityContext.tenant_id,
      roles: securityContext.roles,
      scope: securityContext.meta.scopeResolution,
    });
  }, [securityContext]);

  // ── Feature Flags ──
  const isFeatureEnabled = useCallback(
    (feature: FeatureKey) => {
      if (securityContext) {
        return featureFlagEngine.isEnabledForContext(feature, securityContext);
      }
      return featureFlagEngine.isEnabled(feature, {
        tenantId: currentTenant?.id,
      });
    },
    [securityContext, currentTenant]
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

  // ── Pipeline ──
  const executePipeline = useCallback(
    (action: PermissionAction, resource: PermissionEntity, target?: ResourceTarget): PipelineResult => {
      return executeSecurityPipeline({
        action,
        resource,
        ctx: securityContext,
        target,
      });
    },
    [securityContext]
  );

  return {
    securityContext,
    boundaryIdentity,
    operationalContext,
    switchContext,
    boundarySnapshot,
    availableTenants,
    canSwitchToTenant,
    identity,
    isAuthenticated: !!user,
    checkPermission: checkPerm,
    can,
    canNav,
    hasRole,
    effectiveRoles,
    evaluateRules,
    evaluatePolicy,
    isFeatureEnabled,
    executePipeline,
    accessGraph,
    graphCheckAccess,
    resolveInheritedScopes,
    audit: auditSecurity,
    realIdentity: dualIdentityEngine.realIdentity,
    activeIdentity: dualIdentityEngine.activeIdentity,
    isImpersonating: dualIdentityEngine.isImpersonating,
    impersonationSession: dualIdentityEngine.currentSession,
    loading: rolesLoading,
    isTenantAdmin,
    canManageEmployees,
    canManageCompensation,
    canViewCompensation,
  };
}
