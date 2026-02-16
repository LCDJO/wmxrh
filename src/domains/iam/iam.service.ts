/**
 * IAM Service — Custom Roles, Permissions, User Role Assignments
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════
// TYPES
// ═══════════════════════════════════

export interface CustomRole {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PermissionDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string;
  resource: string;
  action: string;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  scope_type: 'tenant' | 'company_group' | 'company';
  granted_at: string;
  granted_by: string | null;
  permission_definitions?: PermissionDefinition;
}

export interface UserCustomRole {
  id: string;
  user_id: string;
  role_id: string;
  tenant_id: string;
  scope_type: 'tenant' | 'company_group' | 'company';
  scope_id: string | null;
  assigned_by: string | null;
  assigned_at: string;
  custom_roles?: CustomRole;
}

export interface TenantUser {
  id: string;
  user_id: string;
  tenant_id: string;
  name: string | null;
  email: string | null;
  status: string;
  role: string;
  created_by: string | null;
  created_at: string;
}

// ═══════════════════════════════════
// SERVICE
// ═══════════════════════════════════

export const iamService = {
  // ── Custom Roles ──

  async listRoles(tenantId: string): Promise<CustomRole[]> {
    const { data, error } = await supabase
      .from('custom_roles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('is_system', { ascending: false })
      .order('name');
    if (error) throw error;
    return (data || []) as CustomRole[];
  },

  async createRole(dto: { tenant_id: string; name: string; slug: string; description?: string; created_by?: string }): Promise<CustomRole> {
    const { data, error } = await supabase
      .from('custom_roles')
      .insert([dto])
      .select()
      .single();
    if (error) throw error;
    return data as CustomRole;
  },

  async updateRole(id: string, dto: { name?: string; description?: string; is_active?: boolean }): Promise<CustomRole> {
    const { data, error } = await supabase
      .from('custom_roles')
      .update(dto)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CustomRole;
  },

  async deleteRole(id: string): Promise<void> {
    const { error } = await supabase.from('custom_roles').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Permission Definitions ──

  async listPermissions(): Promise<PermissionDefinition[]> {
    const { data, error } = await supabase
      .from('permission_definitions')
      .select('*')
      .order('module')
      .order('code');
    if (error) throw error;
    return (data || []) as PermissionDefinition[];
  },

  // ── Role Permissions ──

  async listRolePermissions(roleId: string): Promise<RolePermission[]> {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*, permission_definitions(*)')
      .eq('role_id', roleId);
    if (error) throw error;
    return (data || []) as RolePermission[];
  },

  async setRolePermissions(roleId: string, permissionIds: string[], scopeType: 'tenant' | 'company_group' | 'company' = 'tenant', grantedBy?: string): Promise<void> {
    // Delete current permissions
    const { error: delError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);
    if (delError) throw delError;

    if (permissionIds.length === 0) return;

    // Insert new
    const rows = permissionIds.map(pid => ({
      role_id: roleId,
      permission_id: pid,
      scope_type: scopeType,
      granted_by: grantedBy || null,
    }));
    const { error: insError } = await supabase
      .from('role_permissions')
      .insert(rows);
    if (insError) throw insError;
  },

  async cloneRole(sourceRoleId: string, tenantId: string, newName: string, createdBy?: string): Promise<CustomRole> {
    // 1. Create the new role
    const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    const { data: newRole, error: roleErr } = await supabase
      .from('custom_roles')
      .insert([{ tenant_id: tenantId, name: newName, slug, description: `Clonado de ${sourceRoleId}`, created_by: createdBy || null }])
      .select()
      .single();
    if (roleErr) throw roleErr;

    // 2. Copy permissions
    const { data: sourcePerms, error: permErr } = await supabase
      .from('role_permissions')
      .select('permission_id, scope_type')
      .eq('role_id', sourceRoleId);
    if (permErr) throw permErr;

    if (sourcePerms && sourcePerms.length > 0) {
      const rows = sourcePerms.map(sp => ({
        role_id: (newRole as CustomRole).id,
        permission_id: sp.permission_id,
        scope_type: sp.scope_type,
        granted_by: createdBy || null,
      }));
      const { error: insErr } = await supabase.from('role_permissions').insert(rows);
      if (insErr) throw insErr;
    }

    return newRole as CustomRole;
  },

  async inviteUser(dto: { tenant_id: string; email: string; name?: string; role_id?: string; scope_type?: 'tenant' | 'company_group' | 'company'; scope_id?: string; invited_by?: string }): Promise<TenantUser> {
    // We don't create an auth user here — just a membership record with status 'invited'
    // A real invite flow would send an email via edge function
    const { data, error } = await supabase
      .from('tenant_memberships')
      .insert([{
        tenant_id: dto.tenant_id,
        user_id: crypto.randomUUID(), // placeholder until user signs up
        email: dto.email,
        name: dto.name || null,
        role: 'viewer',
        status: 'invited',
        created_by: dto.invited_by || null,
      }])
      .select()
      .single();
    if (error) throw error;
    return data as TenantUser;
  },

  // ── Scope helpers ──

  async listCompanies(tenantId: string): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  async listCompanyGroups(tenantId: string): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from('company_groups')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  // ── User Custom Role Assignments ──

  async listUserAssignments(tenantId: string): Promise<UserCustomRole[]> {
    const { data, error } = await supabase
      .from('user_custom_roles')
      .select('*, custom_roles(*)')
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return (data || []) as UserCustomRole[];
  },

  async assignRole(dto: { user_id: string; role_id: string; tenant_id: string; scope_type?: 'tenant' | 'company_group' | 'company'; scope_id?: string | null; assigned_by?: string }): Promise<UserCustomRole> {
    const { data, error } = await supabase
      .from('user_custom_roles')
      .insert([{
        user_id: dto.user_id,
        role_id: dto.role_id,
        tenant_id: dto.tenant_id,
        scope_type: dto.scope_type || 'tenant',
        scope_id: dto.scope_id || null,
        assigned_by: dto.assigned_by || null,
      }])
      .select('*, custom_roles(*)')
      .single();
    if (error) throw error;
    return data as UserCustomRole;
  },

  async removeAssignment(id: string): Promise<void> {
    const { error } = await supabase.from('user_custom_roles').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Tenant Members (from tenant_memberships) ──

  async listTenantMembers(tenantId: string): Promise<TenantUser[]> {
    const { data, error } = await supabase
      .from('tenant_memberships')
      .select('*')
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return (data || []) as TenantUser[];
  },
};
