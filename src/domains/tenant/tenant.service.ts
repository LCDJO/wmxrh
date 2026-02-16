/**
 * Tenant Service - Supabase Implementation
 * 
 * When migrating to microservices, replace this with an API client
 * that implements ITenantService against the Tenant microservice.
 */

import { supabase } from '@/integrations/supabase/client';
import type { ITenantService } from '@/domains/shared';
import type { Tenant, TenantMembership, CreateTenantDTO } from '@/domains/shared';

export const tenantService: ITenantService = {
  async list() {
    const { data, error } = await supabase.from('tenants').select('*');
    if (error) throw error;
    return (data || []) as Tenant[];
  },

  async create(dto: CreateTenantDTO) {
    // NOTE: Cannot use .select().single() here because the SELECT RLS policy
    // (is_tenant_member) fails before the AFTER INSERT trigger creates the membership.
    const { error } = await supabase.from('tenants').insert(dto);
    if (error) throw error;
    // The AFTER INSERT trigger auto_add_tenant_owner creates the membership.
    // The caller (refreshTenants) will reload memberships to pick up the new tenant.
    return { id: '', name: dto.name } as Tenant;
  },

  async getMemberships(userId: string) {
    const { data, error } = await supabase
      .from('tenant_memberships')
      .select('*, tenants(*)')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []) as (TenantMembership & { tenants: Tenant })[];
  },
};
