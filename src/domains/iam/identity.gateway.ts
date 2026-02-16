/**
 * IdentityGateway — Domain Gateway Layer for IAM
 *
 * Typed Commands and Queries that provide a clean contract
 * between the UI layer and the IAM domain service.
 *
 * Security Kernel integration:
 *   - Emits IAM domain events on every mutation
 *   - Invalidates AccessGraph cache on role changes
 *   - Emits GraphEvent.UserRoleChanged for kernel listeners
 */

import { iamService, type CustomRole, type PermissionDefinition, type RolePermission, type UserCustomRole, type TenantUser } from '@/domains/iam/iam.service';
import { emitIAMEvent, type IAMDomainEvent } from '@/domains/iam/iam.events';
import { graphEvents } from '@/domains/security/kernel/access-graph.events';
import { accessGraphService } from '@/domains/security/kernel/access-graph.service';

// ═══════════════════════════════════
// COMMAND TYPES
// ═══════════════════════════════════

export interface CreateTenantUserCommand {
  tenant_id: string;
  email: string;
  name?: string;
  invited_by?: string;
}

export interface AssignRoleToUserCommand {
  user_id: string;
  role_id: string;
  tenant_id: string;
  scope_type?: 'tenant' | 'company_group' | 'company';
  scope_id?: string | null;
  assigned_by?: string;
}

export interface RemoveRoleFromUserCommand {
  assignment_id: string;
  /** Required for event emission / cache invalidation */
  user_id?: string;
  tenant_id?: string;
  role_id?: string;
}

export interface CreateRoleCommand {
  tenant_id: string;
  name: string;
  description?: string;
  created_by?: string;
}

export interface CloneRoleCommand {
  source_role_id: string;
  tenant_id: string;
  new_name: string;
  created_by?: string;
}

export interface DeleteRoleCommand {
  role_id: string;
  tenant_id?: string;
}

export interface UpdateRolePermissionsCommand {
  role_id: string;
  permission_ids: string[];
  scope_type?: 'tenant' | 'company_group' | 'company';
  granted_by?: string;
  tenant_id?: string;
}

// ═══════════════════════════════════
// QUERY TYPES
// ═══════════════════════════════════

export interface GetTenantUsersQuery {
  tenant_id: string;
}

export interface GetRolesQuery {
  tenant_id: string;
}

export interface GetPermissionsMatrixQuery {
  role_id: string;
}

export interface GetAllPermissionsQuery {}

export interface GetUserAssignmentsQuery {
  tenant_id: string;
}

export interface GetScopeOptionsQuery {
  tenant_id: string;
}

// ═══════════════════════════════════
// QUERY RESULTS
// ═══════════════════════════════════

export interface PermissionsMatrixResult {
  rolePermissions: RolePermission[];
  allPermissions: PermissionDefinition[];
}

export interface ScopeOptionsResult {
  companies: { id: string; name: string }[];
  companyGroups: { id: string; name: string }[];
}

// ═══════════════════════════════════
// GATEWAY
// ═══════════════════════════════════

export const identityGateway = {
  // ── Commands ──

  async createTenantUser(cmd: CreateTenantUserCommand): Promise<TenantUser> {
    const result = await iamService.inviteUser({
      tenant_id: cmd.tenant_id,
      email: cmd.email,
      name: cmd.name,
      invited_by: cmd.invited_by,
    });

    emitIAMEvent({
      type: 'UserInvited',
      timestamp: Date.now(),
      tenant_id: cmd.tenant_id,
      email: cmd.email,
      user_id: result.user_id,
      invited_by: cmd.invited_by,
    });

    return result;
  },

  async assignRoleToUser(cmd: AssignRoleToUserCommand): Promise<UserCustomRole> {
    const result = await iamService.assignRole({
      user_id: cmd.user_id,
      role_id: cmd.role_id,
      tenant_id: cmd.tenant_id,
      scope_type: cmd.scope_type,
      scope_id: cmd.scope_id,
      assigned_by: cmd.assigned_by,
    });

    // 1. Emit IAM domain event
    emitIAMEvent({
      type: 'UserRoleAssigned',
      timestamp: Date.now(),
      tenant_id: cmd.tenant_id,
      user_id: cmd.user_id,
      role_id: cmd.role_id,
      scope_type: cmd.scope_type,
      scope_id: cmd.scope_id,
      assigned_by: cmd.assigned_by,
    });

    // 2. Invalidate AccessGraph cache + emit kernel event
    accessGraphService.invalidateUser(cmd.user_id, cmd.tenant_id, 'ROLE_CHANGED');
    graphEvents.userRoleChanged(cmd.tenant_id, cmd.user_id, cmd.role_id, 'insert');

    // 3. Emit AccessGraphRebuilt
    emitIAMEvent({
      type: 'AccessGraphRebuilt',
      timestamp: Date.now(),
      tenant_id: cmd.tenant_id,
      user_id: cmd.user_id,
      reason: 'UserRoleAssigned',
    });

    return result;
  },

  async removeRoleFromUser(cmd: RemoveRoleFromUserCommand): Promise<void> {
    await iamService.removeAssignment(cmd.assignment_id);

    if (cmd.user_id && cmd.tenant_id) {
      emitIAMEvent({
        type: 'UserRoleRemoved',
        timestamp: Date.now(),
        tenant_id: cmd.tenant_id,
        user_id: cmd.user_id,
        assignment_id: cmd.assignment_id,
      });

      accessGraphService.invalidateUser(cmd.user_id, cmd.tenant_id, 'ROLE_CHANGED');
      graphEvents.userRoleChanged(cmd.tenant_id, cmd.user_id, cmd.role_id || cmd.assignment_id, 'delete');

      emitIAMEvent({
        type: 'AccessGraphRebuilt',
        timestamp: Date.now(),
        tenant_id: cmd.tenant_id,
        user_id: cmd.user_id,
        reason: 'UserRoleRemoved',
      });
    }
  },

  async createRole(cmd: CreateRoleCommand): Promise<CustomRole> {
    const slug = cmd.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    return iamService.createRole({
      tenant_id: cmd.tenant_id,
      name: cmd.name,
      slug,
      description: cmd.description,
      created_by: cmd.created_by,
    });
  },

  async cloneRole(cmd: CloneRoleCommand): Promise<CustomRole> {
    return iamService.cloneRole(cmd.source_role_id, cmd.tenant_id, cmd.new_name, cmd.created_by);
  },

  async deleteRole(cmd: DeleteRoleCommand): Promise<void> {
    await iamService.deleteRole(cmd.role_id);

    // Invalidate entire tenant — any user with this role is affected
    if (cmd.tenant_id) {
      accessGraphService.invalidateTenant(cmd.tenant_id, 'ROLE_CHANGED' as any);
    }
  },

  async updateRolePermissions(cmd: UpdateRolePermissionsCommand): Promise<void> {
    await iamService.setRolePermissions(
      cmd.role_id,
      cmd.permission_ids,
      cmd.scope_type || 'tenant',
      cmd.granted_by,
    );

    emitIAMEvent({
      type: 'RolePermissionsUpdated',
      timestamp: Date.now(),
      tenant_id: cmd.tenant_id || '',
      role_id: cmd.role_id,
      permission_count: cmd.permission_ids.length,
      granted_by: cmd.granted_by,
    });

    // Invalidate entire tenant — all users with this role need graph refresh
    if (cmd.tenant_id) {
      accessGraphService.invalidateTenant(cmd.tenant_id, 'ROLE_CHANGED' as any);

      emitIAMEvent({
        type: 'AccessGraphRebuilt',
        timestamp: Date.now(),
        tenant_id: cmd.tenant_id,
        user_id: null,
        reason: 'RolePermissionsUpdated',
      });
    }
  },

  // ── Queries (unchanged — no side-effects) ──

  async getTenantUsers(query: GetTenantUsersQuery): Promise<TenantUser[]> {
    return iamService.listTenantMembers(query.tenant_id);
  },

  async getRoles(query: GetRolesQuery): Promise<CustomRole[]> {
    return iamService.listRoles(query.tenant_id);
  },

  async getAllPermissions(_query?: GetAllPermissionsQuery): Promise<PermissionDefinition[]> {
    return iamService.listPermissions();
  },

  async getPermissionsMatrix(query: GetPermissionsMatrixQuery): Promise<RolePermission[]> {
    return iamService.listRolePermissions(query.role_id);
  },

  async getUserAssignments(query: GetUserAssignmentsQuery): Promise<UserCustomRole[]> {
    return iamService.listUserAssignments(query.tenant_id);
  },

  async getScopeOptions(query: GetScopeOptionsQuery): Promise<ScopeOptionsResult> {
    const [companies, companyGroups] = await Promise.all([
      iamService.listCompanies(query.tenant_id),
      iamService.listCompanyGroups(query.tenant_id),
    ]);
    return { companies, companyGroups };
  },
};
