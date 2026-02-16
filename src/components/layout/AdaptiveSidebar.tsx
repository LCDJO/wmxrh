/**
 * AdaptiveSidebar — Uses IdentityRouter (IIL) as single source of truth
 * to decide which AppShell to render.
 *
 * Decision matrix:
 *   phase=anonymous        → login screen (handled by AppRoutes)
 *   phase=impersonating    → Tenant AppShell (orange accent)
 *   isPlatformUser + no tenant → Platform AppShell
 *   isPlatformUser + on /platform/* → Platform AppShell
 *   isTenantUser / scoped  → Tenant AppShell
 *
 * The IdentityRouter FSM replaces the old multi-source detection cascade.
 */
import { useIdentityIntelligence } from '@/domains/security/kernel/identity-intelligence';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Navigate } from 'react-router-dom';
import type { UserType } from '@/domains/security/kernel/identity.service';

/**
 * Hook that resolves which AppShell to load based on IdentityRouter phase.
 */
export function useAdaptiveUserType() {
  const { session: authSession } = useAuth();
  const { identity, loading, isPlatformUser: isPlatformFromDb } = usePlatformIdentity();
  const location = useLocation();
  const {
    phase,
    isPlatformUser: isPlatformFromIIL,
    isTenantUser,
    isImpersonating,
    snapshot,
    syncPhase,
  } = useIdentityIntelligence();

  // Sync IIL phase on every render (lightweight — just compares states)
  syncPhase();

  // ── Impersonation: always render Tenant AppShell ──
  if (isImpersonating) {
    return {
      userType: 'tenant' as UserType,
      isPlatformUser: false,
      loading: false,
      isOnPlatformRoute: false,
      platformIdentity: identity,
      jwtUserType: snapshot.userType as UserType | null,
      isImpersonating: true,
      activeIdentity: snapshot.activeIdentity,
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
    jwtUserType: snapshot.userType as UserType | null,
    isImpersonating: false,
    activeIdentity: null,
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
