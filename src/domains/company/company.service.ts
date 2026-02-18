import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { Company, CompanyWithRelations, CreateCompanyDTO } from '@/domains/shared';

export const companyService = {
  async list(scope: QueryScope) {
    const q = applyScope(supabase.from('companies').select('*, company_groups(name)'), scope, { skipScopeFilter: true });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as CompanyWithRelations[];
  },

  async listSimple(scope: QueryScope) {
    const q = applyScope(supabase.from('companies').select('id, name'), scope, { skipScopeFilter: true });
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async create(dto: CreateCompanyDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('companies').insert(secured).select().single();
    if (error) throw error;
    return data as Company;
  },

  async update(id: string, dto: Partial<Omit<Company, 'id' | 'tenant_id' | 'created_at'>>, scope: QueryScope) {
    const { data, error } = await supabase
      .from('companies')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as Company;
  },

  async softDelete(id: string, scope: QueryScope) {
    const { error } = await supabase
      .from('companies')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },
};
