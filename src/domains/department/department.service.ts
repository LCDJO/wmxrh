import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { Department, DepartmentWithRelations, CreateDepartmentDTO } from '@/domains/shared';

export const departmentService = {
  async list(scope: QueryScope) {
    const q = applyScope(supabase.from('departments').select('*, companies(name)'), scope);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as DepartmentWithRelations[];
  },

  async create(dto: CreateDepartmentDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('departments').insert(secured).select().single();
    if (error) throw error;
    return data as Department;
  },
};
