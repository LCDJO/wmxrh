/**
 * Security Middleware - Route Guard
 * 
 * Uses SecurityContext pipeline for permission checks.
 * Supports nav-level, entity-level, feature-flag, and plan module guards.
 */

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSecurityKernel } from './use-security-kernel';
import { usePXE } from '@/hooks/core/use-pxe';
import type { PermissionEntity, PermissionAction, NavKey } from './permissions';
import type { FeatureKey } from './feature-flags';
import { ShieldX, Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Check nav-level access */
  navKey?: NavKey;
  /** Check entity-level access */
  entity?: PermissionEntity;
  action?: PermissionAction;
  /** Gate by feature flag */
  featureFlag?: FeatureKey;
  /** Gate by plan module — blocks access if module not in tenant's plan */
  moduleKey?: string;
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

function FeatureDisabled() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-muted">
          <ShieldX className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold font-display text-foreground">Módulo Indisponível</h2>
        <p className="text-muted-foreground max-w-sm">
          Este módulo não está habilitado para sua organização. Contate o administrador.
        </p>
      </div>
    </div>
  );
}

function ModuleNotInPlan() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-amber-500/10">
          <Lock className="h-8 w-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold font-display text-foreground">Módulo não disponível no seu plano</h2>
        <p className="text-muted-foreground max-w-sm">
          Este módulo não está incluído no plano atual da sua organização.
          Entre em contato com o administrador para fazer upgrade.
        </p>
      </div>
    </div>
  );
}

/** Maps navKey → plan module key for route-level gating */
const NAV_KEY_MODULE_MAP: Partial<Record<NavKey, string>> = {
  employees: 'employees',
  companies: 'companies',
  groups: 'groups',
  positions: 'positions',
  compensation: 'compensation',
  departments: 'departments',
  benefits: 'benefits',
  health: 'health',
  compliance: 'compliance',
  labor_dashboard: 'labor_rules',
  labor_compliance: 'labor_compliance',
  labor_rules: 'labor_rules',
  legal_dashboard: 'labor_compliance',
  esocial: 'esocial',
  payroll: 'payroll_simulation',
  intelligence: 'workforce_intelligence',
  fleet: 'fleet',
  audit: 'audit',
};

export function ProtectedRoute({
  children,
  navKey,
  entity,
  action = 'view',
  featureFlag,
  moduleKey,
  fallback,
}: ProtectedRouteProps) {
  const { canNav, can, loading, isAuthenticated, isFeatureEnabled } = useSecurityKernel();
  const { isModuleAccessible, ready: pxeReady } = usePXE();

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

  // Check feature flag first
  if (featureFlag && !isFeatureEnabled(featureFlag)) {
    return <>{fallback || <FeatureDisabled />}</>;
  }

  // Plan module gating — explicit moduleKey or derived from navKey
  if (pxeReady) {
    const effectiveModuleKey = moduleKey || (navKey ? NAV_KEY_MODULE_MAP[navKey] : undefined);
    if (effectiveModuleKey && !isModuleAccessible(effectiveModuleKey)) {
      return <>{fallback || <ModuleNotInPlan />}</>;
    }
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
