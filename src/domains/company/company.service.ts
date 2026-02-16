import { supabase } from '@/integrations/supabase/client';
import type { ICompanyService } from '@/domains/shared';
import type { Company, CompanyWithRelations, CreateCompanyDTO } from '@/domains/shared';

export const companyService: ICompanyService = {
  async list(tenantId: string) {
    const { data, error } = await supabase.from('companies').select('*, company_groups(name)').eq('tenant_id', tenantId).is('deleted_at', null);
    if (error) throw error;
    return (data || []) as CompanyWithRelations[];
  },

  async listSimple(tenantId: string) {
    const { data, error } = await supabase.from('companies').select('id, name').eq('tenant_id', tenantId).is('deleted_at', null);
    if (error) throw error;
    return data || [];
  },

  async create(dto: CreateCompanyDTO) {
    const { data, error } = await supabase.from('companies').insert(dto).select().single();
    if (error) throw error;
    return data as Company;
  },
};
