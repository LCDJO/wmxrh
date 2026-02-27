/**
 * UIFE — FederationRoleMapper
 *
 * Maps IdP groups/roles to Platform and Tenant roles.
 * Uses federation_role_mappings table for configurable mapping rules.
 *
 * Flow:
 *  1. SAML/OIDC assertion contains groups/roles from IdP
 *  2. RoleMapper resolves these to PlatformRoles and TenantRoles
 *  3. Provisions/deprovisions roles via user_roles + platform_users tables
 */

import { supabase } from '@/integrations/supabase/client';
import type { FederationRoleMappingAPI, RoleMappingRule, ResolvedRoles } from './types';

export function createFederationRoleMapper(): FederationRoleMappingAPI {
  return {
    async resolveRoles(idpConfigId, idpGroups) {
      if (!idpGroups || idpGroups.length === 0) {
        return { platformRoles: [], tenantRoles: [], unmappedGroups: [] };
      }

      // Fetch active mappings for this IdP, ordered by priority
      const { data: mappings, error } = await (supabase
        .from('federation_role_mappings' as any)
        .select('*')
        .eq('idp_config_id', idpConfigId)
        .eq('is_active', true)
        .in('idp_group_name', idpGroups)
        .order('priority', { ascending: false }) as any);

      if (error) {
        console.error('[UIFE:RoleMapper] Failed to fetch mappings:', error.message);
        return { platformRoles: [], tenantRoles: [], unmappedGroups: [...idpGroups] };
      }

      const platformRoles: Array<{ roleId: string; roleName?: string }> = [];
      const tenantRoles: string[] = [];
      const mappedGroups = new Set<string>();

      for (const m of (mappings || [])) {
        mappedGroups.add(m.idp_group_name);

        if (m.target_scope === 'platform' && m.platform_role_id) {
          if (!platformRoles.some(r => r.roleId === m.platform_role_id)) {
            platformRoles.push({ roleId: m.platform_role_id });
          }
        } else if (m.target_scope === 'tenant' && m.tenant_role) {
          if (!tenantRoles.includes(m.tenant_role)) {
            tenantRoles.push(m.tenant_role);
          }
        }
      }

      const unmappedGroups = idpGroups.filter(g => !mappedGroups.has(g));

      return { platformRoles, tenantRoles, unmappedGroups };
    },

    async provisionRoles(userId, tenantId, resolved) {
      const provisioned: string[] = [];

      // Provision platform roles
      for (const pr of resolved.platformRoles) {
        const { error } = await supabase
          .from('platform_users' as any)
          .update({ role_id: pr.roleId } as any)
          .eq('id', userId);

        if (!error) provisioned.push(`platform:${pr.roleId}`);
      }

      // Provision tenant roles via user_roles
      for (const tr of resolved.tenantRoles) {
        const { error } = await (supabase
          .from('user_roles' as any)
          .upsert({
            user_id: userId,
            role: tr,
          }, { onConflict: 'user_id,role' }) as any);

        if (!error) provisioned.push(`tenant:${tr}`);
      }

      // Update tenant membership role to highest-priority tenant role
      if (resolved.tenantRoles.length > 0) {
        const highestRole = resolved.tenantRoles[0]; // First = highest priority
        await supabase
          .from('tenant_memberships' as any)
          .update({ role: highestRole } as any)
          .eq('user_id', userId)
          .eq('tenant_id', tenantId);
      }

      return provisioned;
    },

    async deprovisionRoles(userId, tenantId, resolved) {
      const deprovisioned: string[] = [];

      for (const tr of resolved.tenantRoles) {
        const { error } = await (supabase
          .from('user_roles' as any)
          .delete()
          .eq('user_id', userId)
          .eq('role', tr) as any);

        if (!error) deprovisioned.push(`tenant:${tr}`);
      }

      return deprovisioned;
    },

    async getMappings(idpConfigId) {
      const { data, error } = await (supabase
        .from('federation_role_mappings' as any)
        .select('*, platform_roles:platform_role_id(id, name, slug)')
        .eq('idp_config_id', idpConfigId)
        .order('priority', { ascending: false }) as any);

      if (error) {
        console.error('[UIFE:RoleMapper] getMappings failed:', error.message);
        return [];
      }

      return (data || []).map((m: any) => ({
        id: m.id,
        idpConfigId: m.idp_config_id,
        tenantId: m.tenant_id,
        idpGroupName: m.idp_group_name,
        idpGroupId: m.idp_group_id,
        targetScope: m.target_scope,
        platformRoleId: m.platform_role_id,
        platformRoleName: m.platform_roles?.name,
        tenantRole: m.tenant_role,
        isActive: m.is_active,
        priority: m.priority,
        autoProvision: m.auto_provision,
        autoDeprovision: m.auto_deprovision,
      })) as RoleMappingRule[];
    },

    async createMapping(mapping) {
      const { data, error } = await (supabase
        .from('federation_role_mappings' as any)
        .insert({
          tenant_id: mapping.tenantId,
          idp_config_id: mapping.idpConfigId,
          idp_group_name: mapping.idpGroupName,
          idp_group_id: mapping.idpGroupId,
          target_scope: mapping.targetScope,
          platform_role_id: mapping.platformRoleId,
          tenant_role: mapping.tenantRole,
          is_active: mapping.isActive ?? true,
          priority: mapping.priority ?? 0,
          auto_provision: mapping.autoProvision ?? true,
          auto_deprovision: mapping.autoDeprovision ?? false,
        } as any)
        .select()
        .single() as any);

      if (error) throw new Error(`[UIFE:RoleMapper] createMapping failed: ${error.message}`);
      return data;
    },

    async updateMapping(id, patch) {
      const updateData: Record<string, unknown> = {};
      if (patch.idpGroupName !== undefined) updateData.idp_group_name = patch.idpGroupName;
      if (patch.idpGroupId !== undefined) updateData.idp_group_id = patch.idpGroupId;
      if (patch.targetScope !== undefined) updateData.target_scope = patch.targetScope;
      if (patch.platformRoleId !== undefined) updateData.platform_role_id = patch.platformRoleId;
      if (patch.tenantRole !== undefined) updateData.tenant_role = patch.tenantRole;
      if (patch.isActive !== undefined) updateData.is_active = patch.isActive;
      if (patch.priority !== undefined) updateData.priority = patch.priority;
      if (patch.autoProvision !== undefined) updateData.auto_provision = patch.autoProvision;
      if (patch.autoDeprovision !== undefined) updateData.auto_deprovision = patch.autoDeprovision;

      const { error } = await (supabase
        .from('federation_role_mappings' as any)
        .update(updateData as any)
        .eq('id', id) as any);

      if (error) throw new Error(`[UIFE:RoleMapper] updateMapping failed: ${error.message}`);
    },

    async deleteMapping(id) {
      const { error } = await (supabase
        .from('federation_role_mappings' as any)
        .delete()
        .eq('id', id) as any);

      if (error) throw new Error(`[UIFE:RoleMapper] deleteMapping failed: ${error.message}`);
    },
  };
}
