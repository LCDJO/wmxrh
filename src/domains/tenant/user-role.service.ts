import { supabase } from '@/integrations/supabase/client';
import type { IUserRoleService } from '@/domains/shared';
import type { UserRole, ScopeType, TenantRole } from '@/domains/shared';

export const userRoleService: IUserRoleService = {
  async listByTenant(tenantId: string) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return (data || []) as UserRole[];
  },

  async create(dto: { user_id: string; tenant_id: string; role: TenantRole; scope_type: ScopeType; scope_id?: string | null }) {
    const { data, error } = await supabase
      .from('user_roles')
      .insert([dto])
      .select()
      .single();
    if (error) throw error;
    return data as UserRole;
  },

  async delete(id: string) {
    const { error } = await supabase.from('user_roles').delete().eq('id', id);
    if (error) throw error;
  },
};
