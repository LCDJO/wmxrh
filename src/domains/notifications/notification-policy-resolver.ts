/**
 * NotificationPolicyResolver
 *
 * Determines WHO should receive a notification based on:
 *   - Required roles (e.g., 'hr_manager', 'finance')
 *   - Scope (tenant / group / company)
 *   - Access Graph inheritance rules
 *
 * Flow:
 *   Event → PolicyResolver.resolve(policy) → user_id[] → Dispatcher.createBatch()
 */

import { supabase } from '@/integrations/supabase/client';

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export type NotificationScope =
  | { type: 'tenant'; tenantId: string }
  | { type: 'company_group'; tenantId: string; groupId: string }
  | { type: 'company'; tenantId: string; companyId: string };

export interface NotificationPolicy {
  /** Which roles should receive this notification */
  targetRoles: string[];
  /** Scope to filter recipients */
  scope: NotificationScope;
  /** Optional: also notify these specific users regardless of role */
  additionalUserIds?: string[];
  /** Optional: exclude these users (e.g., the actor who triggered the event) */
  excludeUserIds?: string[];
}

export interface ResolvedRecipient {
  userId: string;
  reason: string;
}

// ══════════════════════════════════════════════════════════════
// Policy Definitions — maps event types to recipient policies
// ══════════════════════════════════════════════════════════════

export type NotificationEventType =
  | 'SalaryAdjusted'
  | 'AdditionalAdded'
  | 'EmployeeHired'
  | 'JobPositionChanged'
  | 'EmployeeStatusChanged'
  | 'ModuleEnabled'
  | 'FeatureFlagChanged'
  | 'PolicyViolationDetected'
  | 'UserInvited'
  | 'RolePermissionsUpdated'
  | 'UnauthorizedAccessAttempt'
  | 'ContextSwitched'
  | 'LegislationInterpreted'
  | 'CriticalLegalChange'
  | 'ActionPlanCreated';

/**
 * Default role mapping per event type.
 * These can be overridden by tenant-level config in the future.
 */
export const EVENT_ROLE_MAP: Record<NotificationEventType, string[]> = {
  // Compensation → HR + Finance
  SalaryAdjusted: ['admin', 'owner', 'hr_manager', 'finance', 'company_admin'],
  AdditionalAdded: ['admin', 'owner', 'hr_manager', 'finance', 'company_admin'],

  // HR Core → HR + Managers
  EmployeeHired: ['admin', 'owner', 'hr_manager', 'company_admin'],
  JobPositionChanged: ['admin', 'owner', 'hr_manager', 'company_admin'],
  EmployeeStatusChanged: ['admin', 'owner', 'hr_manager', 'company_admin'],

  // Platform → Admins only
  ModuleEnabled: ['admin', 'owner', 'tenant_admin'],
  FeatureFlagChanged: ['admin', 'owner', 'tenant_admin'],
  PolicyViolationDetected: ['admin', 'owner', 'tenant_admin', 'security'],

  // Identity & Security → Admins + Security
  UserInvited: ['admin', 'owner', 'tenant_admin'],
  RolePermissionsUpdated: ['admin', 'owner', 'tenant_admin', 'security'],
  UnauthorizedAccessAttempt: ['admin', 'owner', 'tenant_admin', 'security'],
  ContextSwitched: [], // personal — only the actor

  // Legal AI Intelligence → HR + Compliance + Admins
  LegislationInterpreted: ['admin', 'owner', 'hr_manager', 'company_admin'],
  CriticalLegalChange: ['admin', 'owner', 'hr_manager', 'company_admin', 'security'],
  ActionPlanCreated: ['admin', 'owner', 'hr_manager', 'company_admin'],
};

// ══════════════════════════════════════════════════════════════
// Resolver
// ══════════════════════════════════════════════════════════════

export const notificationPolicyResolver = {
  /**
   * Resolve recipient user_ids for a given policy.
   *
   * Strategy:
   *   1. Query user_custom_roles for users with matching role slugs in scope
   *   2. Query tenant_memberships for users with matching membership role
   *   3. Apply scope inheritance:
   *      - tenant scope → all matching users in tenant
   *      - group scope  → matching users in group + tenant admins
   *      - company scope → matching users in company + group admins + tenant admins
   *   4. Merge additionalUserIds, exclude excludeUserIds
   *   5. Deduplicate and return
   */
  async resolve(policy: NotificationPolicy): Promise<ResolvedRecipient[]> {
    const { targetRoles, scope, additionalUserIds = [], excludeUserIds = [] } = policy;
    const recipients = new Map<string, string>();

    const tenantId = scope.tenantId;

    if (targetRoles.length > 0) {
      // ── 1. Custom roles (user_custom_roles + custom_roles) ──
      try {
        const { data: customRoleUsers } = await supabase
          .from('user_custom_roles')
          .select('user_id, custom_roles!inner(slug, scope_type, scope_id)')
          .eq('tenant_id', tenantId) as any;

        if (customRoleUsers) {
          for (const ucr of customRoleUsers) {
            const role = ucr.custom_roles;
            if (!role || !targetRoles.includes(role.slug)) continue;

            // Scope filtering with inheritance
            if (matchesScope(role.scope_type, role.scope_id, scope)) {
              recipients.set(ucr.user_id, `custom_role:${role.slug}`);
            }
          }
        }
      } catch {
        // custom roles table may not exist yet
      }

      // ── 2. Tenant membership roles ──
      try {
        const { data: members } = await supabase
          .from('tenant_memberships')
          .select('user_id, role')
          .eq('tenant_id', tenantId);

        if (members) {
          for (const m of members) {
            if (targetRoles.includes(m.role)) {
              recipients.set(m.user_id, `membership:${m.role}`);
            }
            // Tenant admins/owners always receive in any sub-scope
            if (['admin', 'owner'].includes(m.role) && scope.type !== 'tenant') {
              recipients.set(m.user_id, `inherited:${m.role}`);
            }
          }
        }
      } catch {
        // silently fail
      }
    }

    // ── 3. Additional explicit users ──
    for (const uid of additionalUserIds) {
      recipients.set(uid, 'explicit');
    }

    // ── 4. Exclude ──
    for (const uid of excludeUserIds) {
      recipients.delete(uid);
    }

    return Array.from(recipients.entries()).map(([userId, reason]) => ({
      userId,
      reason,
    }));
  },

  /**
   * Convenience: build a policy from an event type and scope.
   */
  buildPolicy(
    eventType: NotificationEventType,
    scope: NotificationScope,
    opts?: { additionalUserIds?: string[]; excludeUserIds?: string[] },
  ): NotificationPolicy {
    return {
      targetRoles: EVENT_ROLE_MAP[eventType] || [],
      scope,
      additionalUserIds: opts?.additionalUserIds,
      excludeUserIds: opts?.excludeUserIds,
    };
  },
};

// ══════════════════════════════════════════════════════════════
// Scope matching with inheritance
// ══════════════════════════════════════════════════════════════

function matchesScope(
  roleScopeType: string | null,
  roleScopeId: string | null,
  target: NotificationScope,
): boolean {
  // Tenant-level role → always matches (inherits all)
  if (!roleScopeType || roleScopeType === 'tenant') return true;

  if (target.type === 'company_group') {
    // Group role matches if same group
    if (roleScopeType === 'company_group' && roleScopeId === target.groupId) return true;
    return false;
  }

  if (target.type === 'company') {
    // Company role matches if same company
    if (roleScopeType === 'company' && roleScopeId === target.companyId) return true;
    // Group admin inherits companies — would need group lookup; for now, tenant roles cover this
    return false;
  }

  return true;
}
