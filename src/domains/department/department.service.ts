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

  async update(id: string, dto: Partial<Omit<Department, 'id' | 'tenant_id' | 'created_at'>>, scope: QueryScope) {
    const { data, error } = await supabase
      .from('departments')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as Department;
  },

  async softDelete(id: string, scope: QueryScope) {
    const { error } = await supabase
      .from('departments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },
};
