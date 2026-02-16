/**
 * IdentityGateway — Domain Gateway Layer for IAM
 *
 * Typed Commands and Queries that provide a clean contract
 * between the UI layer and the IAM domain service.
 *
 * Security Kernel integration:
 *   - Runs full SecurityPipeline on every mutation (8-stage check)
 *   - Emits IAM domain events on every mutation
 *   - Invalidates AccessGraph cache on role changes
 *   - Emits GraphEvent.UserRoleChanged for kernel listeners
 *   - Audit trail via AuditSecurityService
 *
 * NO security rule lives in the frontend — all enforcement
 * happens here at the Domain Gateway Layer.
 */

import { iamService, type CustomRole, type PermissionDefinition, type RolePermission, type UserCustomRole, type TenantUser } from '@/domains/iam/iam.service';
import { emitIAMEvent } from '@/domains/iam/iam.events';
import { graphEvents } from '@/domains/security/kernel/access-graph.events';
import { accessGraphService } from '@/domains/security/kernel/access-graph.service';
import { auditSecurity } from '@/domains/security/kernel/audit-security.service';
import { executeSecurityPipeline, SecurityPipelineError } from '@/domains/security/kernel/security-pipeline';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';

// ═══════════════════════════════════
// SECURITY ERRORS
// ═══════════════════════════════════

export class IAMAuthorizationError extends Error {
  constructor(action: string, reason: string) {
    super(`[IAM] ${action}: ${reason}`);
    this.name = 'IAMAuthorizationError';
  }
}

/**
 * Run the full 8-stage SecurityPipeline for an IAM mutation.
 * This replaces the old `requireTenantAdmin` simple boolean check.
 * 
 * Pipeline stages:
 *   1. RequestId → 2. Auth → 3. IBL Session → 4. ContextResolver
 *   5. AccessGraph → 6. RBAC+ABAC → 7. PolicyEngine → 8. Audit
 */
function requirePipelineAllow(
  action: 'create' | 'update' | 'delete' | 'view',
  gatewayAction: string,
  ctx?: SecurityContext | null,
  tenantId?: string,
): void {
  const result = executeSecurityPipeline({
    action,
    resource: 'user_roles',
    ctx: ctx ?? null,
    target: tenantId ? { tenant_id: tenantId } : undefined,
    // IAM mutations always go through the full pipeline
    skipAccessGraph: false,
    skipPolicy: false,
    skipAudit: false,
  });

  if (result.decision === 'deny') {
    throw new IAMAuthorizationError(
      gatewayAction,
      result.reason || `Pipeline negou: stage ${result.deniedAtStage} (${result.deniedBy})`,
    );
  }
}

/**
 * Fallback guard when SecurityContext is not available.
 * Uses the legacy isTenantAdmin boolean check + audit logging.
 * This ensures backward compatibility with components that haven't
 * been migrated to pass SecurityContext yet.
 */
function requireTenantAdmin(isTenantAdmin: boolean, action: string, tenantId?: string): void {
  if (!isTenantAdmin) {
    auditSecurity.logAccessDenied({
      resource: 'iam',
      reason: `Tentativa de ${action} sem permissão TenantAdmin`,
      metadata: { tenant_id: tenantId },
    });
    throw new IAMAuthorizationError(action, 'Apenas TenantAdmin pode executar esta ação');
  }
}

/**
 * Smart guard: uses SecurityPipeline when ctx is available,
 * falls back to requireTenantAdmin otherwise.
 */
function enforceIAMAccess(
  action: 'create' | 'update' | 'delete',
  gatewayAction: string,
  opts: { ctx?: SecurityContext | null; isTenantAdmin: boolean; tenantId?: string },
): void {
  if (opts.ctx) {
    requirePipelineAllow(action, gatewayAction, opts.ctx, opts.tenantId);
  } else {
    requireTenantAdmin(opts.isTenantAdmin, gatewayAction, opts.tenantId);
  }
}

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
  /** SecurityContext for pipeline enforcement */
  ctx?: SecurityContext | null;
}

export interface RemoveRoleFromUserCommand {
  assignment_id: string;
  user_id?: string;
  tenant_id?: string;
  role_id?: string;
  ctx?: SecurityContext | null;
}

export interface CreateRoleCommand {
  tenant_id: string;
  name: string;
  description?: string;
  created_by?: string;
  is_tenant_admin: boolean;
  ctx?: SecurityContext | null;
}

export interface CloneRoleCommand {
  source_role_id: string;
  tenant_id: string;
  new_name: string;
  created_by?: string;
  is_tenant_admin: boolean;
  ctx?: SecurityContext | null;
}

export interface DeleteRoleCommand {
  role_id: string;
  tenant_id?: string;
  is_tenant_admin: boolean;
  ctx?: SecurityContext | null;
}

export interface UpdateRolePermissionsCommand {
  role_id: string;
  permission_ids: string[];
  scope_type?: 'tenant' | 'company_group' | 'company';
  granted_by?: string;
  tenant_id?: string;
  is_tenant_admin: boolean;
  ctx?: SecurityContext | null;
}

// ═══════════════════════════════════
// QUERY TYPES
// ═══════════════════════════════════

export interface GetTenantUsersQuery { tenant_id: string; }
export interface GetRolesQuery { tenant_id: string; }
export interface GetPermissionsMatrixQuery { role_id: string; }
export interface GetAllPermissionsQuery {}
export interface GetUserAssignmentsQuery { tenant_id: string; }
export interface GetScopeOptionsQuery { tenant_id: string; }

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
    // Pipeline enforcement when ctx is available
    if (cmd.ctx) {
      requirePipelineAllow('create', 'assignRoleToUser', cmd.ctx, cmd.tenant_id);
    }

    const result = await iamService.assignRole({
      user_id: cmd.user_id,
      role_id: cmd.role_id,
      tenant_id: cmd.tenant_id,
      scope_type: cmd.scope_type,
      scope_id: cmd.scope_id,
      assigned_by: cmd.assigned_by,
    });

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

    accessGraphService.invalidateUser(cmd.user_id, cmd.tenant_id, 'ROLE_CHANGED');
    graphEvents.userRoleChanged(cmd.tenant_id, cmd.user_id, cmd.role_id, 'insert');

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
    if (cmd.ctx && cmd.tenant_id) {
      requirePipelineAllow('delete', 'removeRoleFromUser', cmd.ctx, cmd.tenant_id);
    }

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
    enforceIAMAccess('create', 'createRole', {
      ctx: cmd.ctx,
      isTenantAdmin: cmd.is_tenant_admin,
      tenantId: cmd.tenant_id,
    });

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
    enforceIAMAccess('create', 'cloneRole', {
      ctx: cmd.ctx,
      isTenantAdmin: cmd.is_tenant_admin,
      tenantId: cmd.tenant_id,
    });

    return iamService.cloneRole(cmd.source_role_id, cmd.tenant_id, cmd.new_name, cmd.created_by);
  },

  async deleteRole(cmd: DeleteRoleCommand): Promise<void> {
    enforceIAMAccess('delete', 'deleteRole', {
      ctx: cmd.ctx,
      isTenantAdmin: cmd.is_tenant_admin,
      tenantId: cmd.tenant_id,
    });

    const roles = await iamService.listRoles(cmd.tenant_id || '');
    const target = roles.find(r => r.id === cmd.role_id);
    if (target?.is_system) {
      throw new IAMAuthorizationError('deleteRole', 'Cargos de sistema (is_system) não podem ser deletados');
    }

    await iamService.deleteRole(cmd.role_id);

    if (cmd.tenant_id) {
      accessGraphService.invalidateTenant(cmd.tenant_id, 'ROLE_CHANGED' as any);
    }
  },

  async updateRolePermissions(cmd: UpdateRolePermissionsCommand): Promise<void> {
    enforceIAMAccess('update', 'updateRolePermissions', {
      ctx: cmd.ctx,
      isTenantAdmin: cmd.is_tenant_admin,
      tenantId: cmd.tenant_id,
    });

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

  // ── Queries (read-only — no side-effects) ──

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
