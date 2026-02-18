import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { CompanyGroup, CreateCompanyGroupDTO } from '@/domains/shared';

export const companyGroupService = {
  async list(scope: QueryScope) {
    const q = applyScope(supabase.from('company_groups').select('*'), scope, { skipScopeFilter: true });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as CompanyGroup[];
  },

  async create(dto: CreateCompanyGroupDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('company_groups').insert(secured).select().single();
    if (error) throw error;
    return data as CompanyGroup;
  },

  async update(id: string, dto: Partial<Omit<CompanyGroup, 'id' | 'tenant_id' | 'created_at'>>, scope: QueryScope) {
    const { data, error } = await supabase
      .from('company_groups')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as CompanyGroup;
  },

  async softDelete(id: string, scope: QueryScope) {
    const { error } = await supabase
      .from('company_groups')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },
};
