import { supabase } from '@/integrations/supabase/client';
import type { IDepartmentService } from '@/domains/shared';
import type { Department, DepartmentWithRelations, CreateDepartmentDTO } from '@/domains/shared';

export const departmentService: IDepartmentService = {
  async list(tenantId: string) {
    const { data, error } = await supabase.from('departments').select('*, companies(name)').eq('tenant_id', tenantId);
    if (error) throw error;
    return (data || []) as DepartmentWithRelations[];
  },

  async create(dto: CreateDepartmentDTO) {
    const { data, error } = await supabase.from('departments').insert(dto).select().single();
    if (error) throw error;
    return data as Department;
  },
};
