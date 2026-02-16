/**
 * SecurityKernel — PermissionEngine
 * 
 * Stateless permission evaluator.
 * SINGLE SOURCE OF TRUTH for action × entity → roles mapping.
 * Delegates to the existing permission matrix.
 */

import {
  hasPermission,
  canAccessNavItem,
  PERMISSION_MATRIX,
  type PermissionAction,
  type PermissionEntity,
  type NavKey,
} from '../permissions';
import type { TenantRole } from '@/domains/shared/types';

export interface PermissionCheck {
  entity: PermissionEntity;
  action: PermissionAction;
}

export interface PermissionEngineAPI {
  /** Check if roles can perform action on entity */
  can: (entity: PermissionEntity, action: PermissionAction, roles: TenantRole[]) => boolean;
  /** Check if roles can access a nav item */
  canNav: (navKey: NavKey, roles: TenantRole[]) => boolean;
  /** Check if roles include any of the given roles */
  hasAnyRole: (userRoles: TenantRole[], ...targetRoles: TenantRole[]) => boolean;
  /** Batch check multiple permissions at once */
  canAll: (checks: PermissionCheck[], roles: TenantRole[]) => boolean;
  /** Batch check — returns true if at least one passes */
  canAny: (checks: PermissionCheck[], roles: TenantRole[]) => boolean;
  /** Get allowed roles for an entity+action */
  getAllowedRoles: (entity: PermissionEntity, action: PermissionAction) => TenantRole[];
}

export const permissionEngine: PermissionEngineAPI = {
  can: (entity, action, roles) => hasPermission(entity, action, roles),

  canNav: (navKey, roles) => canAccessNavItem(navKey, roles),

  hasAnyRole: (userRoles, ...targetRoles) =>
    userRoles.some(r => targetRoles.includes(r)),

  canAll: (checks, roles) =>
    checks.every(c => hasPermission(c.entity, c.action, roles)),

  canAny: (checks, roles) =>
    checks.some(c => hasPermission(c.entity, c.action, roles)),

  getAllowedRoles: (entity, action) =>
    PERMISSION_MATRIX[entity]?.[action] ?? [],
};
