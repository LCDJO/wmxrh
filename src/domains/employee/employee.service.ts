import { supabase } from '@/integrations/supabase/client';
import type { IEmployeeService } from '@/domains/shared';
import type { Employee, EmployeeWithRelations, CreateEmployeeDTO } from '@/domains/shared';

const EMPLOYEE_SELECT = '*, positions(title), departments(name), companies(name), manager:employees!employees_manager_id_fkey(name)';

export const employeeService: IEmployeeService & {
  listByGroup(tenantId: string, groupId: string): Promise<EmployeeWithRelations[]>;
  listByCompany(tenantId: string, companyId: string): Promise<EmployeeWithRelations[]>;
} = {
  async list(tenantId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select(EMPLOYEE_SELECT)
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return (data || []) as EmployeeWithRelations[];
  },

  async listByGroup(tenantId: string, groupId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select(EMPLOYEE_SELECT)
      .eq('tenant_id', tenantId)
      .eq('company_group_id', groupId);
    if (error) throw error;
    return (data || []) as EmployeeWithRelations[];
  },

  async listByCompany(tenantId: string, companyId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select(EMPLOYEE_SELECT)
      .eq('tenant_id', tenantId)
      .eq('company_id', companyId);
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
      .select(EMPLOYEE_SELECT)
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
