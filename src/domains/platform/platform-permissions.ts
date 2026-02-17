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
  'billing.refund',
  'plan.manage',
  'fiscal.view',
  'fiscal.report',
  'support.impersonate',
  'platform_user.view',
  'platform_user.create',
  'platform_user.edit',
  'platform_user.delete',
  'security.view',
  'security.manage',
  // ── Future: Delegated Support ──
  'support.delegate',
  'support.escalate',
  // ── Future: Marketplace ──
  'marketplace.view',
  'marketplace.publish',
  'marketplace.approve',
  'marketplace.manage',
  // ── Future: Compliance ──
  'compliance.view',
  'compliance.audit',
  'compliance.enforce',
  'compliance.report',
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
    'platform_user.view',
    'security.view',
  ],

  platform_support: [
    'tenant.view',
    'support.impersonate',
    'audit.view',
    'module.view',
    'platform_user.view',
    'security.view',
  ],

  platform_finance: [
    'tenant.view',
    'billing.view',
    'billing.manage',
    'billing.refund',
    'plan.manage',
    'audit.view',
  ],

  platform_fiscal: [
    'tenant.view',
    'fiscal.view',
    'fiscal.report',
    'billing.view',
    'audit.view',
  ],

  platform_read_only: [
    'tenant.view',
    'module.view',
    'audit.view',
    'billing.view',
    'fiscal.view',
    'platform_user.view',
    'security.view',
  ],

  // ── Future roles: permissions prepared but minimal until activation ──
  platform_delegated_support: [
    'tenant.view',
    'support.impersonate',
    'support.delegate',
    'support.escalate',
    'audit.view',
  ],

  platform_marketplace_admin: [
    'marketplace.view',
    'marketplace.publish',
    'marketplace.approve',
    'marketplace.manage',
    'module.view',
    'audit.view',
  ],

  platform_compliance: [
    'tenant.view',
    'compliance.view',
    'compliance.audit',
    'compliance.enforce',
    'compliance.report',
    'audit.view',
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
