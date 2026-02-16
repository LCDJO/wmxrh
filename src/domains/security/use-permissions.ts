/**
 * Security Middleware - usePermissions Hook
 * 
 * Thin wrapper over useSecurityKernel for backward compatibility.
 * New code should use useSecurityKernel directly.
 */

import { useSecurityKernel } from './use-security-kernel';
import type { PermissionAction, PermissionEntity, NavKey } from './permissions';
import type { TenantRole } from '@/domains/shared/types';

export interface UsePermissionsReturn {
  can: (entity: PermissionEntity, action: PermissionAction) => boolean;
  canNav: (navKey: NavKey) => boolean;
  hasRole: (...roles: TenantRole[]) => boolean;
  effectiveRoles: TenantRole[];
  loading: boolean;
  isAuthenticated: boolean;
  isTenantAdmin: boolean;
  canManageEmployees: boolean;
  canManageCompensation: boolean;
  canViewCompensation: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const kernel = useSecurityKernel();

  return {
    can: kernel.can,
    canNav: kernel.canNav,
    hasRole: kernel.hasRole,
    effectiveRoles: kernel.effectiveRoles,
    loading: kernel.loading,
    isAuthenticated: kernel.isAuthenticated,
    isTenantAdmin: kernel.isTenantAdmin,
    canManageEmployees: kernel.canManageEmployees,
    canManageCompensation: kernel.canManageCompensation,
    canViewCompensation: kernel.canViewCompensation,
  };
}
