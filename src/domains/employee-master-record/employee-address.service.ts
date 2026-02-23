/**
 * Employee Address Service
 * CRUD for employee_addresses satellite table.
 */
import { supabase } from '@/integrations/supabase/client';
import type { EmployeeAddress, CreateEmployeeAddressDTO } from './types';

export const employeeAddressService = {
  async listByEmployee(employeeId: string, tenantId: string) {
    const { data, error } = await supabase
      .from('employee_addresses')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false });
    if (error) throw error;
    return (data ?? []) as EmployeeAddress[];
  },

  async create(dto: CreateEmployeeAddressDTO) {
    const { data, error } = await supabase
      .from('employee_addresses')
      .insert(dto)
      .select()
      .single();
    if (error) throw error;
    return data as EmployeeAddress;
  },

  async update(id: string, tenantId: string, dto: Partial<Omit<EmployeeAddress, 'id' | 'tenant_id' | 'employee_id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('employee_addresses')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as EmployeeAddress;
  },

  async softDelete(id: string, tenantId: string) {
    const { error } = await supabase
      .from('employee_addresses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  },
};
