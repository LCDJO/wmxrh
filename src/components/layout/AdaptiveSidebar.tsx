/**
 * AdaptiveSidebar — Uses UnifiedIdentitySession.active_context as single
 * source of truth to decide which AppShell to render.
 *
 * Navigation Intelligence integration:
 *   - Reads `session.active_context` for tenant/group/company/scope
 *   - Reads `session.phase` for FSM state
 *   - Reads `session.real_identity.user_type` for shell selection
 *   - Reads `session.impersonation_state` for impersonation detection
 *
 * Decision matrix:
 *   phase=anonymous           → login screen (handled by AppRoutes)
 *   phase=impersonating       → Tenant AppShell (orange accent)
 *   isPlatformUser + no ctx   → Platform AppShell
 *   isPlatformUser + /platform/* → Platform AppShell
 *   isTenantUser / scoped     → Tenant AppShell
 */
import { useEffect } from 'react';
import { useIdentityIntelligence } from '@/domains/security/kernel/identity-intelligence';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { useLocation, Navigate } from 'react-router-dom';
import type { UserType } from '@/domains/security/kernel/identity.service';

/**
 * Hook that resolves which AppShell to load based on
 * UnifiedIdentitySession.active_context from the Navigation Intelligence layer.
 */
export function useAdaptiveUserType() {
  const { identity, loading, isPlatformUser: isPlatformFromDb } = usePlatformIdentity();
  const location = useLocation();
  const {
    session,
    phase,
    isPlatformUser: isPlatformFromIIL,
    isTenantUser,
    isImpersonating,
    activeContext,
    syncPhase,
  } = useIdentityIntelligence();

  // Sync IIL phase in an effect — NOT during render — to avoid infinite loops
  useEffect(() => {
    syncPhase();
  }, [syncPhase, phase]);

  // ── Active context from UnifiedIdentitySession ──
  const ctx = activeContext;

  // ── Impersonation: always render Tenant AppShell ──
  if (isImpersonating) {
    return {
      userType: 'tenant' as UserType,
      isPlatformUser: false,
      loading: false,
      isOnPlatformRoute: false,
      platformIdentity: identity,
      jwtUserType: session.real_identity.user_type as UserType | null,
      isImpersonating: true,
      activeIdentity: session.impersonation_state
        ? {
            userId: session.impersonation_state.real_user_id,
            tenantId: session.impersonation_state.target_tenant_id,
            userType: 'tenant' as UserType,
          }
        : null,
      // Navigation Intelligence: expose active_context
      activeContext: ctx,
      activeTenantId: ctx?.tenant_id ?? null,
      activeTenantName: ctx?.tenant_name ?? null,
      scopeLevel: ctx?.scope_level ?? null,
      activeGroupId: ctx?.group_id ?? null,
      activeCompanyId: ctx?.company_id ?? null,
      effectiveRoles: ctx?.effective_roles ?? [],
    };
  }

  // ── Resolve effective user type from IIL (highest priority) ──
  const resolvedFromIIL = isPlatformFromIIL ? 'platform' : isTenantUser ? 'tenant' : null;

  // Fallback: DB lookup (usePlatformIdentity)
  const resolvedUserType: UserType = (resolvedFromIIL as UserType) ?? (isPlatformFromDb ? 'platform' : 'tenant');

  const isOnPlatformRoute = location.pathname.startsWith('/platform');

  return {
    userType: resolvedUserType,
    isPlatformUser: resolvedUserType === 'platform',
    loading,
    isOnPlatformRoute,
    platformIdentity: identity,
    jwtUserType: session.real_identity.user_type as UserType | null,
    isImpersonating: false,
    activeIdentity: null,
    // Navigation Intelligence: expose active_context
    activeContext: ctx,
    activeTenantId: ctx?.tenant_id ?? null,
    activeTenantName: ctx?.tenant_name ?? null,
    scopeLevel: ctx?.scope_level ?? null,
    activeGroupId: ctx?.group_id ?? null,
    activeCompanyId: ctx?.company_id ?? null,
    effectiveRoles: ctx?.effective_roles ?? [],
  };
}

/**
 * Component that redirects platform users away from tenant onboarding.
 * Does NOT redirect if currently impersonating.
 */
export function AdaptiveRootRedirect() {
  const { isPlatformUser, loading, isImpersonating } = useAdaptiveUserType();

  if (loading) return null;
  if (isImpersonating) return null;

  if (isPlatformUser) {
    return <Navigate to="/platform/dashboard" replace />;
  }

  return null;
}
