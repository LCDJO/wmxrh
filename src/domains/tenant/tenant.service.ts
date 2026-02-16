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
    const { data, error } = await supabase.from('tenants').insert(dto).select().single();
    if (error) throw error;
    return data as Tenant;
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
