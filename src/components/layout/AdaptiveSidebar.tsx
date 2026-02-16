/**
 * AdaptiveSidebar — Detects user_type and renders the correct layout.
 * 
 * - Platform user → PlatformLayout (purple, "Modo Plataforma")
 * - Tenant user → AppLayout (green, operational)
 * 
 * Resolution priority:
 *   1. JWT claim `user_type` (injected by custom_access_token_hook)
 *   2. platform_users table lookup (fallback)
 *   3. Default: 'tenant'
 */
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Navigate } from 'react-router-dom';
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
 * Security invariants enforced at DB level:
 *   - PlatformUser NEVER has tenant_memberships (trigger: trg_no_platform_user_as_tenant)
 *   - TenantUser NEVER has platform_users entry (trigger: trg_no_tenant_user_as_platform)
 */
export function useAdaptiveUserType() {
  const { session } = useAuth();
  const { identity, loading, isPlatformUser } = usePlatformIdentity();
  const location = useLocation();

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
  };
}

/**
 * Component that redirects platform users away from tenant onboarding.
 */
export function AdaptiveRootRedirect() {
  const { isPlatformUser, loading } = useAdaptiveUserType();

  if (loading) return null;

  if (isPlatformUser) {
    return <Navigate to="/platform/dashboard" replace />;
  }

  return null;
}
