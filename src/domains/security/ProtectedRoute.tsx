/**
 * Security Middleware - Route Guard
 * 
 * Wraps routes with permission checks.
 * Shows access denied or loading states.
 */

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from './use-permissions';
import type { PermissionEntity, PermissionAction, NavKey } from './permissions';
import { ShieldX } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Check nav-level access */
  navKey?: NavKey;
  /** Check entity-level access */
  entity?: PermissionEntity;
  action?: PermissionAction;
  /** Fallback when denied (default: AccessDenied page) */
  fallback?: ReactNode;
}

function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold font-display text-foreground">Acesso Negado</h2>
        <p className="text-muted-foreground max-w-sm">
          Você não tem permissão para acessar esta página. Contate o administrador do seu tenant.
        </p>
      </div>
    </div>
  );
}

export function ProtectedRoute({
  children,
  navKey,
  entity,
  action = 'view',
  fallback,
}: ProtectedRouteProps) {
  const { canNav, can, loading, isAuthenticated } = usePermissions();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Check nav-level access
  if (navKey && !canNav(navKey)) {
    return <>{fallback || <AccessDenied />}</>;
  }

  // Check entity-level access
  if (entity && !can(entity, action)) {
    return <>{fallback || <AccessDenied />}</>;
  }

  return <>{children}</>;
}
