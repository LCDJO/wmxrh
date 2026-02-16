/**
 * IAM CQRS Read Models
 *
 * Scope-aware, cached read models that react to IdentityBoundary context switches.
 * Each view is a React Query hook with composite keys that include the active scope.
 *
 *   TenantUserListView        — users filtered by scope
 *   RolePermissionsMatrixView — permissions for a role (cached by role_id)
 *   AccessGraphSummaryView    — aggregate counts for the access graph tab
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import { identityGateway } from '@/domains/iam/identity.gateway';
import { accessGraphCache } from '@/domains/security/kernel/access-graph.cache';
import type { TenantUser, UserCustomRole, CustomRole, PermissionDefinition, RolePermission } from '@/domains/iam/iam.service';

// ══════════════════════════════════════
// SCOPE KEY BUILDER
// ══════════════════════════════════════

interface ScopeKey {
  tenantId: string | undefined;
  groupId: string | null;
  companyId: string | null;
}

function useScopeKey(): ScopeKey {
  const { currentTenant } = useTenant();
  const { scope } = useScope();
  return {
    tenantId: currentTenant?.id,
    groupId: scope.groupId,
    companyId: scope.companyId,
  };
}

/** Builds a composite query key that includes the active scope for automatic refetch on context switch */
function buildScopedKey(base: string, sk: ScopeKey): unknown[] {
  return [base, sk.tenantId, sk.groupId, sk.companyId];
}

// ══════════════════════════════════════
// TenantUserListView
// ══════════════════════════════════════

export interface TenantUserListViewResult {
  members: TenantUser[];
  assignments: UserCustomRole[];
  isLoading: boolean;
  /** Filtered members based on current scope */
  filteredMembers: TenantUser[];
  /** Assignments filtered to current scope */
  filteredAssignments: UserCustomRole[];
}

export function useTenantUserListView(): TenantUserListViewResult {
  const sk = useScopeKey();

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: buildScopedKey('iam_members', sk),
    queryFn: () => identityGateway.getTenantUsers({ tenant_id: sk.tenantId! }),
    enabled: !!sk.tenantId,
    staleTime: 2 * 60 * 1000, // 2 min stale — members don't change often
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: buildScopedKey('iam_assignments', sk),
    queryFn: () => identityGateway.getUserAssignments({ tenant_id: sk.tenantId! }),
    enabled: !!sk.tenantId,
    staleTime: 2 * 60 * 1000,
  });

  // Filter by scope: if a company or group is selected, only show users with roles scoped there
  const { filteredMembers, filteredAssignments } = useMemo(() => {
    if (!sk.companyId && !sk.groupId) {
      // Tenant-level scope: show all
      return { filteredMembers: members, filteredAssignments: assignments };
    }

    // Filter assignments to the active scope
    const scopedAssignments = assignments.filter(a => {
      if (sk.companyId && a.scope_type === 'company' && a.scope_id === sk.companyId) return true;
      if (sk.groupId && a.scope_type === 'company_group' && a.scope_id === sk.groupId) return true;
      // Tenant-scoped assignments are always visible
      if (a.scope_type === 'tenant') return true;
      return false;
    });

    // Show all members (they belong to the tenant), but assignments are filtered
    return { filteredMembers: members, filteredAssignments: scopedAssignments };
  }, [members, assignments, sk.companyId, sk.groupId]);

  return {
    members,
    assignments,
    isLoading: membersLoading || assignmentsLoading,
    filteredMembers,
    filteredAssignments,
  };
}

// ══════════════════════════════════════
// RolePermissionsMatrixView
// ══════════════════════════════════════

export interface RolePermissionsMatrixViewResult {
  roles: CustomRole[];
  permissions: PermissionDefinition[];
  isLoading: boolean;
}

export function useRolePermissionsMatrixView(): RolePermissionsMatrixViewResult {
  const sk = useScopeKey();

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: buildScopedKey('iam_roles', sk),
    queryFn: () => identityGateway.getRoles({ tenant_id: sk.tenantId! }),
    enabled: !!sk.tenantId,
    staleTime: 3 * 60 * 1000, // 3 min — roles are stable
  });

  const { data: permissions = [], isLoading: permsLoading } = useQuery({
    queryKey: ['iam_permissions'],
    queryFn: () => identityGateway.getAllPermissions(),
    staleTime: 10 * 60 * 1000, // 10 min — permission definitions rarely change
  });

  return { roles, permissions, isLoading: rolesLoading || permsLoading };
}

/**
 * Cached permission matrix for a single role.
 * Uses AccessGraph cache TTL alignment to avoid recomputation.
 */
export function useRolePermissionsCached(roleId: string | null) {
  return useQuery({
    queryKey: ['iam_role_perms', roleId],
    queryFn: () => identityGateway.getPermissionsMatrix({ role_id: roleId! }),
    enabled: !!roleId,
    staleTime: 5 * 60 * 1000, // Aligned with AccessGraph cache TTL (5 min)
    gcTime: 10 * 60 * 1000,
  });
}

// ══════════════════════════════════════
// AccessGraphSummaryView
// ══════════════════════════════════════

export interface AccessGraphSummary {
  totalUsers: number;
  totalRoles: number;
  totalPermissions: number;
  usersWithRoles: number;
  averageRolesPerUser: number;
  cacheStats: {
    cacheSize: number;
    totalInvalidations: number;
  };
}

export interface AccessGraphSummaryViewResult {
  summary: AccessGraphSummary;
  members: TenantUser[];
  assignments: UserCustomRole[];
  roles: CustomRole[];
  permissions: PermissionDefinition[];
  isLoading: boolean;
}

export function useAccessGraphSummaryView(): AccessGraphSummaryViewResult {
  const userList = useTenantUserListView();
  const roleMatrix = useRolePermissionsMatrixView();

  const summary = useMemo<AccessGraphSummary>(() => {
    const uniqueUsersWithRoles = new Set(userList.filteredAssignments.map(a => a.user_id)).size;
    const totalUsers = userList.filteredMembers.length;
    const cacheStats = accessGraphCache.getStats();

    return {
      totalUsers,
      totalRoles: roleMatrix.roles.length,
      totalPermissions: roleMatrix.permissions.length,
      usersWithRoles: uniqueUsersWithRoles,
      averageRolesPerUser: totalUsers > 0
        ? +(userList.filteredAssignments.length / totalUsers).toFixed(1)
        : 0,
      cacheStats: {
        cacheSize: cacheStats.size,
        totalInvalidations: cacheStats.totalInvalidations,
      },
    };
  }, [userList.filteredMembers, userList.filteredAssignments, roleMatrix.roles, roleMatrix.permissions]);

  return {
    summary,
    members: userList.filteredMembers,
    assignments: userList.filteredAssignments,
    roles: roleMatrix.roles,
    permissions: roleMatrix.permissions,
    isLoading: userList.isLoading || roleMatrix.isLoading,
  };
}

// ══════════════════════════════════════
// RolePermissionGraphView
// ══════════════════════════════════════

export interface RolePermissionGraphViewResult {
  graph: { roleId: string; perms: RolePermission[] }[];
  isLoading: boolean;
}

export function useRolePermissionGraphView(roleIds: string[]): RolePermissionGraphViewResult {
  const sk = useScopeKey();
  const stableKey = useMemo(() => [...roleIds].sort().join(','), [roleIds]);

  const { data: graph = [], isLoading } = useQuery({
    queryKey: buildScopedKey('iam_perm_graph', { ...sk, extra: stableKey } as any),
    queryFn: () => identityGateway.getPermissionGraph({ tenant_id: sk.tenantId!, role_ids: roleIds }),
    enabled: !!sk.tenantId && roleIds.length > 0,
    staleTime: 3 * 60 * 1000,
  });

  return { graph, isLoading };
}

// ══════════════════════════════════════
// RoleInheritanceGraphView
// ══════════════════════════════════════

export interface RoleInheritanceGraphViewResult {
  roles: CustomRole[];
  inheritances: { id: string; parent_role_id: string; child_role_id: string; tenant_id: string }[];
  isLoading: boolean;
}

export function useRoleInheritanceGraphView(): RoleInheritanceGraphViewResult {
  const sk = useScopeKey();

  const { data, isLoading } = useQuery({
    queryKey: buildScopedKey('iam_role_graph', sk),
    queryFn: () => identityGateway.getRoleGraph({ tenant_id: sk.tenantId! }),
    enabled: !!sk.tenantId,
    staleTime: 3 * 60 * 1000,
  });

  return {
    roles: data?.roles ?? [],
    inheritances: data?.inheritances ?? [],
    isLoading,
  };
}

// ══════════════════════════════════════
// AccessPreviewView
// ══════════════════════════════════════

export interface AccessPreviewViewResult {
  permissions: PermissionDefinition[];
  inheritedFrom: string[];
  isLoading: boolean;
}

export function useAccessPreviewView(roleId: string | null): AccessPreviewViewResult {
  const sk = useScopeKey();

  const { data, isLoading } = useQuery({
    queryKey: ['iam_access_preview', roleId, sk.tenantId],
    queryFn: () => identityGateway.previewRoleAccess({ role_id: roleId!, tenant_id: sk.tenantId! }),
    enabled: !!roleId && !!sk.tenantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    permissions: data?.permissions ?? [],
    inheritedFrom: data?.inheritedFrom ?? [],
    isLoading,
  };
}

// ══════════════════════════════════════
// SCOPE-AWARE INVALIDATION HOOK
// ══════════════════════════════════════

/**
 * Hook that invalidates all IAM queries when scope changes.
 * Should be called once per IAM page.
 */
export function useIAMScopeInvalidation() {
  const qc = useQueryClient();
  const sk = useScopeKey();

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['iam_roles'] });
    qc.invalidateQueries({ queryKey: ['iam_assignments'] });
    qc.invalidateQueries({ queryKey: ['iam_members'] });
    qc.invalidateQueries({ queryKey: ['iam_perm_graph'] });
    qc.invalidateQueries({ queryKey: ['iam_role_graph'] });
    qc.invalidateQueries({ queryKey: ['iam_access_preview'] });
  }, [qc]);

  // Listen to AccessGraph cache invalidations for proactive refetch
  useEffect(() => {
    const unsub = accessGraphCache.onInvalidation((event) => {
      if (event.tenant_id === sk.tenantId) {
        invalidateAll();
      }
    });
    return unsub;
  }, [sk.tenantId, invalidateAll]);

  return invalidateAll;
}
