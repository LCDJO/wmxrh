import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { Employee, EmployeeWithRelations, CreateEmployeeDTO } from '@/domains/shared';

const EMPLOYEE_SELECT = '*, positions(title), departments(name), companies(name), manager:employees!employees_manager_id_fkey(name)';

export const employeeService = {
  async list(scope: QueryScope) {
    const q = applyScope(supabase.from('employees').select(EMPLOYEE_SELECT), scope);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as EmployeeWithRelations[];
  },

  async listSimple(scope: QueryScope) {
    const q = applyScope(
      supabase.from('employees').select('id, company_id, department_id, position_id, current_salary, status'),
      scope
    );
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async getById(id: string, scope: QueryScope) {
    const q = applyScope(supabase.from('employees').select(EMPLOYEE_SELECT), scope)
      .eq('id', id);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data as EmployeeWithRelations | null;
  },

  async create(dto: CreateEmployeeDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('employees').insert(secured).select().single();
    if (error) throw error;
    return data as Employee;
  },
};
