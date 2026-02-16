/**
 * Platform Permission Model
 * 
 * Completely separate from tenant-level permissions.
 * Maps PlatformRoles → PlatformPermissions.
 */

// ═══════════════════════════════════
// PERMISSION DEFINITIONS
// ═══════════════════════════════════

export const PLATFORM_PERMISSIONS = [
  'tenant.create',
  'tenant.view',
  'tenant.edit',
  'tenant.suspend',
  'tenant.delete',
  'module.view',
  'module.enable',
  'module.disable',
  'audit.view',
  'billing.view',
  'billing.manage',
  'platform_user.view',
  'platform_user.create',
  'platform_user.edit',
  'platform_user.delete',
  'security.view',
  'security.manage',
] as const;

export type PlatformPermission = typeof PLATFORM_PERMISSIONS[number];

// ═══════════════════════════════════
// ROLE → PERMISSION MATRIX
// ═══════════════════════════════════

import type { PlatformRoleType } from './PlatformGuard';

const ALL_PERMISSIONS: readonly PlatformPermission[] = [...PLATFORM_PERMISSIONS];

const PLATFORM_PERMISSION_MATRIX: Record<PlatformRoleType, readonly PlatformPermission[]> = {
  platform_super_admin: ALL_PERMISSIONS,

  platform_operations: [
    'tenant.create',
    'tenant.view',
    'tenant.edit',
    'tenant.suspend',
    'module.view',
    'module.enable',
    'module.disable',
    'audit.view',
    'billing.view',
    'platform_user.view',
    'security.view',
  ],

  platform_support: [
    'tenant.view',
    'audit.view',
    'module.view',
    'platform_user.view',
    'security.view',
  ],

  platform_finance: [
    'tenant.view',
    'billing.view',
    'billing.manage',
    'audit.view',
  ],

  platform_read_only: [
    'tenant.view',
    'module.view',
    'audit.view',
    'billing.view',
    'platform_user.view',
    'security.view',
  ],
};

// ═══════════════════════════════════
// CHECK FUNCTIONS
// ═══════════════════════════════════

export function hasPlatformPermission(
  role: PlatformRoleType | null | undefined,
  permission: PlatformPermission,
): boolean {
  if (!role) return false;
  return PLATFORM_PERMISSION_MATRIX[role]?.includes(permission) ?? false;
}

export function getAllPlatformPermissions(role: PlatformRoleType): readonly PlatformPermission[] {
  return PLATFORM_PERMISSION_MATRIX[role] ?? [];
}

export { PLATFORM_PERMISSION_MATRIX };
