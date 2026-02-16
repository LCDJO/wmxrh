import { supabase } from '@/integrations/supabase/client';
import type { IEmployeeService } from '@/domains/shared';
import type { Employee, EmployeeWithRelations, CreateEmployeeDTO } from '@/domains/shared';

export const employeeService: IEmployeeService = {
  async list(tenantId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('*, positions(title), departments(name), companies(name), manager:employees!employees_manager_id_fkey(name)')
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return (data || []) as EmployeeWithRelations[];
  },

  async listSimple(tenantId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, company_id, department_id, position_id, current_salary, status')
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return data || [];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('*, positions(title), departments(name), companies(name), manager:employees!employees_manager_id_fkey(name)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as EmployeeWithRelations | null;
  },

  async create(dto: CreateEmployeeDTO) {
    const { data, error } = await supabase.from('employees').insert(dto).select().single();
    if (error) throw error;
    return data as Employee;
  },
};
