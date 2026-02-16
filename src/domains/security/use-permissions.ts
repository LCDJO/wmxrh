/**
 * Security Middleware - usePermissions Hook
 * 
 * Centralized hook for checking permissions across the app.
 * Wraps ScopeContext and the permission matrix.
 */

import { useCallback, useMemo } from 'react';
import { useScope } from '@/contexts/ScopeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  hasPermission,
  canAccessNavItem,
  type PermissionAction,
  type PermissionEntity,
  type NavKey,
} from './permissions';

export interface UsePermissionsReturn {
  /** Check if user can perform action on entity */
  can: (entity: PermissionEntity, action: PermissionAction) => boolean;
  /** Check if user can access a nav item */
  canNav: (navKey: NavKey) => boolean;
  /** Check if user has any of the given roles */
  hasRole: (...roles: import('@/domains/shared/types').TenantRole[]) => boolean;
  /** User's effective roles */
  effectiveRoles: import('@/domains/shared/types').TenantRole[];
  /** Whether permission data is still loading */
  loading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Convenience: is tenant admin */
  isTenantAdmin: boolean;
  /** Convenience: can manage employees */
  canManageEmployees: boolean;
  /** Convenience: can manage compensation */
  canManageCompensation: boolean;
  /** Convenience: can view compensation */
  canViewCompensation: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();
  const { effectiveRoles, hasRole, rolesLoading } = useScope();

  const can = useCallback(
    (entity: PermissionEntity, action: PermissionAction) =>
      hasPermission(entity, action, effectiveRoles),
    [effectiveRoles]
  );

  const canNav = useCallback(
    (navKey: NavKey) => canAccessNavItem(navKey, effectiveRoles),
    [effectiveRoles]
  );

  const isTenantAdmin = useMemo(
    () => hasRole('superadmin', 'owner', 'admin', 'tenant_admin'),
    [effectiveRoles]
  );

  const canManageEmployees = useMemo(
    () => hasPermission('employees', 'create', effectiveRoles),
    [effectiveRoles]
  );

  const canManageCompensation = useMemo(
    () => hasPermission('compensation', 'create', effectiveRoles),
    [effectiveRoles]
  );

  const canViewCompensation = useMemo(
    () => hasPermission('compensation', 'view', effectiveRoles),
    [effectiveRoles]
  );

  return {
    can,
    canNav,
    hasRole,
    effectiveRoles,
    loading: rolesLoading,
    isAuthenticated: !!user,
    isTenantAdmin,
    canManageEmployees,
    canManageCompensation,
    canViewCompensation,
  };
}
