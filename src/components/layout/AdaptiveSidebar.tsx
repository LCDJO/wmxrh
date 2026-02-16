/**
 * AdaptiveSidebar — Detects user_type and renders the correct layout.
 * 
 * - Platform user → PlatformLayout (purple, "Modo Plataforma")
 * - Tenant user → AppLayout (green, operational)
 * 
 * This is the single entry point for authenticated+layout routing.
 */
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { useLocation, Navigate } from 'react-router-dom';

interface AdaptiveSidebarProps {
  /** 'platform' forces platform layout, 'tenant' forces tenant, 'auto' detects */
  mode?: 'auto' | 'platform' | 'tenant';
}

/**
 * Hook that resolves the effective user_type for navigation decisions.
 * Returns { userType, isPlatformUser, loading }
 */
export function useAdaptiveUserType() {
  const { identity, loading, isPlatformUser } = usePlatformIdentity();
  const location = useLocation();

  // Route-based detection: /platform/* → platform
  const isOnPlatformRoute = location.pathname.startsWith('/platform');

  // Final resolution
  const userType = isOnPlatformRoute && isPlatformUser
    ? 'platform' as const
    : 'tenant' as const;

  return {
    userType,
    isPlatformUser,
    loading,
    isOnPlatformRoute,
    platformIdentity: identity,
  };
}

/**
 * Component that redirects based on user_type when landing on root.
 * Platform users who navigate to "/" get a choice or redirect to /platform/dashboard.
 */
export function AdaptiveRootRedirect() {
  const { isPlatformUser, loading } = useAdaptiveUserType();

  if (loading) return null;

  // Platform users landing on root → redirect to platform dashboard
  // They can still access tenant routes if they have a tenant membership
  if (isPlatformUser) {
    return <Navigate to="/platform/dashboard" replace />;
  }

  return null; // Let normal tenant routing continue
}
