import { supabase } from '@/integrations/supabase/client';
import type { ICompanyGroupService } from '@/domains/shared';
import type { CompanyGroup, CreateCompanyGroupDTO } from '@/domains/shared';

export const companyGroupService: ICompanyGroupService = {
  async list(tenantId: string) {
    const { data, error } = await supabase.from('company_groups').select('*').eq('tenant_id', tenantId);
    if (error) throw error;
    return (data || []) as CompanyGroup[];
  },

  async create(dto: CreateCompanyGroupDTO) {
    const { data, error } = await supabase.from('company_groups').insert(dto).select().single();
    if (error) throw error;
    return data as CompanyGroup;
  },
};
