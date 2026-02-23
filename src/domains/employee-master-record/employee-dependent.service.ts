/**
 * Employee Dependent Service
 * CRUD for employee_dependents satellite table.
 */
import { supabase } from '@/integrations/supabase/client';
import type { EmployeeDependent, CreateEmployeeDependentDTO } from './types';

export const employeeDependentService = {
  async listByEmployee(employeeId: string, tenantId: string) {
    const { data, error } = await supabase
      .from('employee_dependents')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('name');
    if (error) throw error;
    return (data ?? []) as EmployeeDependent[];
  },

  async create(dto: CreateEmployeeDependentDTO) {
    const { data, error } = await supabase
      .from('employee_dependents')
      .insert(dto)
      .select()
      .single();
    if (error) throw error;
    return data as EmployeeDependent;
  },

  async update(id: string, tenantId: string, dto: Partial<Omit<EmployeeDependent, 'id' | 'tenant_id' | 'employee_id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('employee_dependents')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as EmployeeDependent;
  },

  async softDelete(id: string, tenantId: string) {
    const { error } = await supabase
      .from('employee_dependents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  },
};
