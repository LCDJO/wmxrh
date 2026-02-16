/**
 * PlatformGuard — Route guard for platform-level routes.
 * Checks if the authenticated user is an active platform_user.
 * Redirects non-platform users to tenant workspace.
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
  | 'platform_read_only';

interface PlatformIdentity {
  id: string;
  role: PlatformRoleType;
  email: string;
}

interface PlatformGuardProps {
  children: ReactNode;
  /** Optional: restrict to specific roles */
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
      .select('id, role, email')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        setIdentity(data as PlatformIdentity | null);
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
