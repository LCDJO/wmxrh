/**
 * AdaptiveSidebar — Detects user_type and renders the correct layout.
 * 
 * - Platform user → PlatformLayout (purple, "Modo Plataforma")
 * - Tenant user → AppLayout (green, operational)
 * - Platform user IMPERSONATING → AppLayout (orange accent, tenant nav)
 * 
 * Resolution priority:
 *   1. ActiveIdentity from DualIdentityEngine (impersonation-aware)
 *   2. JWT claim `user_type` (injected by custom_access_token_hook)
 *   3. platform_users table lookup (fallback)
 *   4. Default: 'tenant'
 */
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Navigate } from 'react-router-dom';
import { dualIdentityEngine } from '@/domains/security/kernel/dual-identity-engine';
import type { UserType } from '@/domains/security/kernel/identity.service';

/**
 * Extract user_type from the JWT access token claims.
 * Returns null if not decodable.
 */
function getUserTypeFromJwt(accessToken: string | undefined): UserType | null {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    if (payload.user_type === 'platform' || payload.user_type === 'tenant') {
      return payload.user_type;
    }
  } catch {
    // malformed token — fall through
  }
  return null;
}

/**
 * Hook that resolves the effective user_type for navigation decisions.
 * 
 * IMPERSONATION RULE:
 *   When a PlatformUser is impersonating a tenant, ActiveIdentity.userType
 *   becomes 'tenant'. The sidebar MUST render tenant navigation (AppLayout)
 *   so the admin sees exactly what a tenant user would see.
 * 
 * Security invariants enforced at DB level:
 *   - PlatformUser NEVER has tenant_memberships (trigger: trg_no_platform_user_as_tenant)
 *   - TenantUser NEVER has platform_users entry (trigger: trg_no_tenant_user_as_platform)
 */
export function useAdaptiveUserType() {
  const { session } = useAuth();
  const { identity, loading, isPlatformUser } = usePlatformIdentity();
  const location = useLocation();

  // ── DualIdentity: impersonation takes highest priority ──
  const isImpersonating = dualIdentityEngine.isImpersonating;
  const activeIdentity = dualIdentityEngine.activeIdentity;

  // When impersonating, ActiveIdentity.userType is 'tenant'
  // → sidebar must render tenant nav, NOT platform nav
  if (isImpersonating) {
    return {
      userType: activeIdentity.userType as UserType,
      isPlatformUser: false, // treat as tenant for nav purposes
      loading: false,
      isOnPlatformRoute: false,
      platformIdentity: identity,
      jwtUserType: null,
      isImpersonating: true,
      activeIdentity,
    };
  }

  // ── Normal flow (no impersonation) ──

  // 1. JWT claim (most authoritative, server-side)
  const jwtUserType = getUserTypeFromJwt(session?.access_token);

  // 2. Fallback: platform_users table lookup
  const resolvedUserType: UserType = jwtUserType ?? (isPlatformUser ? 'platform' : 'tenant');

  // Route-based detection: /platform/* → platform
  const isOnPlatformRoute = location.pathname.startsWith('/platform');

  return {
    userType: resolvedUserType,
    isPlatformUser: resolvedUserType === 'platform',
    loading,
    isOnPlatformRoute,
    platformIdentity: identity,
    /** The raw JWT claim value (null if hook not yet active) */
    jwtUserType,
    isImpersonating: false,
    activeIdentity: null,
  };
}

/**
 * Component that redirects platform users away from tenant onboarding.
 * Does NOT redirect if currently impersonating (admin should stay in tenant view).
 */
export function AdaptiveRootRedirect() {
  const { isPlatformUser, loading, isImpersonating } = useAdaptiveUserType();

  if (loading) return null;

  // During impersonation, do NOT redirect to platform dashboard
  if (isImpersonating) return null;

  if (isPlatformUser) {
    return <Navigate to="/platform/dashboard" replace />;
  }

  return null;
}
