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
};
