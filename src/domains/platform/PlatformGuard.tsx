/**
 * PlatformGuard — Route guard for platform-level routes.
 * Now joins platform_roles to resolve role slug from role_id.
 */
import { useState, useEffect, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type PlatformRoleType = 
  | 'platform_super_admin'
  | 'platform_operations'
  | 'platform_support'
  | 'platform_finance'
  | 'platform_fiscal'
  | 'platform_read_only'
  | 'platform_marketing'
  // ── Future roles (prepared, not yet active) ──
  | 'platform_delegated_support'
  | 'platform_marketplace_admin'
  | 'platform_compliance';

interface PlatformIdentity {
  id: string;
  role: PlatformRoleType;
  role_id: string;
  email: string;
}

interface PlatformGuardProps {
  children: ReactNode;
  allowedRoles?: PlatformRoleType[];
}

export function usePlatformIdentity() {
  const { user } = useAuth();
  const [identity, setIdentity] = useState<PlatformIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIdentity(null);
      setLoading(false);
      return;
    }

    supabase
      .from('platform_users')
      .select('id, role, role_id, email, platform_roles(slug)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const slug = (data as any).platform_roles?.slug ?? data.role;
          setIdentity({
            id: data.id,
            role: slug as PlatformRoleType,
            role_id: data.role_id,
            email: data.email,
          });
        } else {
          setIdentity(null);
        }
        setLoading(false);
      });
  }, [user?.id]);

  const hasRole = (...roles: PlatformRoleType[]) =>
    identity ? roles.includes(identity.role) : false;

  const canWrite = identity
    ? !['platform_read_only'].includes(identity.role)
    : false;

  return { identity, loading, hasRole, canWrite, isPlatformUser: !!identity };
}

export function PlatformGuard({ children, allowedRoles }: PlatformGuardProps) {
  const { identity, loading } = usePlatformIdentity();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!identity) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(identity.role)) {
    return <Navigate to="/platform/dashboard" replace />;
  }

  return <>{children}</>;
}
