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
  'coupon.view',
  'coupon.create',
  'coupon.update',
  'coupon.disable',
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
  // ── Growth / Landing Pages ──
  'landing_page.view',
  'landing_page.create',
  'landing_page.submit',
  'landing_page.approve',
  'landing_page.reject',
  'landing_page.publish',
  'landing_page.delete',
  // ── Landing Governance (granular) ──
  'landing.create',
  'landing.edit',
  'landing.submit_for_review',
  'landing.view_drafts',
  'landing.approve',
  'landing.reject',
  'landing.publish',
  'landing.delete_draft',
  'landing.create_version',
  'landing.publish_version',
  // ── Growth AI / Marketing ──
  'growth.view',
  'growth.create',
  'growth.edit',
  'growth.submit',
  'growth.approve',
  'growth.publish',
  'growth.delete',
  'growth.version_view',
  // ── Website (institucional) ──
  'website.view',
  'website.create',
  'website.edit',
  'website.submit',
  'website.approve',
  'website.reject',
  'website.publish',
  'website.delete',
  'website.seo_manage',
  'website.structure_manage',
  // ── A/B Experiments ──
  'ab_experiment.start',
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
    'landing_page.view',
    'landing_page.create',
    'landing_page.submit',
    'landing_page.approve',
    'landing_page.reject',
    'landing_page.publish',
    'landing_page.delete',
    'ab_experiment.start',
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
    'coupon.view',
    'coupon.create',
    'coupon.update',
    'coupon.disable',
    'audit.view',
  ],

  platform_fiscal: [
    'tenant.view',
    'fiscal.view',
    'fiscal.report',
    'billing.view',
    'coupon.view',
    'audit.view',
  ],

  platform_read_only: [
    'tenant.view',
    'module.view',
    'audit.view',
    'billing.view',
    'coupon.view',
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

  platform_marketing: [
    'tenant.view',
    'landing_page.view',
    'landing_page.create',
    'landing_page.submit',
    'landing_page.delete',
    'audit.view',
    'ab_experiment.start',
    // Landing governance (granular)
    'landing.create',
    'landing.edit',
    'landing.submit_for_review',
    'landing.view_drafts',
    'landing.delete_draft',
    'landing.create_version',
    // Website (view + submit)
    'website.view',
    'website.create',
    'website.edit',
    'website.submit',
  ],

  platform_marketing_team: [
    'growth.view',
    'growth.create',
    'growth.edit',
    'growth.submit',
    'growth.version_view',
    'landing_page.view',
    'landing_page.create',
    'landing_page.submit',
    'audit.view',
    // Landing governance (granular)
    'landing.create',
    'landing.edit',
    'landing.submit_for_review',
    'landing.view_drafts',
    'landing.delete_draft',
    'landing.create_version',
    // Website (create/edit/submit)
    'website.view',
    'website.create',
    'website.edit',
    'website.submit',
  ],

  platform_marketing_director: [
    'growth.view',
    'growth.create',
    'growth.edit',
    'growth.submit',
    'growth.approve',
    'growth.publish',
    'growth.delete',
    'growth.version_view',
    'landing_page.view',
    'landing_page.create',
    'landing_page.submit',
    'landing_page.approve',
    'landing_page.reject',
    'landing_page.publish',
    'landing_page.delete',
    'audit.view',
    // Landing governance (granular)
    'landing.create',
    'landing.edit',
    'landing.submit_for_review',
    'landing.view_drafts',
    'landing.approve',
    'landing.reject',
    'landing.publish',
    'landing.delete_draft',
    'landing.create_version',
    'landing.publish_version',
    // Website (full governance)
    'website.view',
    'website.create',
    'website.edit',
    'website.submit',
    'website.approve',
    'website.reject',
    'website.publish',
    'website.delete',
    'website.seo_manage',
    'website.structure_manage',
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
