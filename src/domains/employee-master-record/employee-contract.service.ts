/**
 * Employee Contract Service
 * CRUD for employee_contracts satellite table (dados contratuais CLT).
 */
import { supabase } from '@/integrations/supabase/client';
import type { EmployeeContract, CreateEmployeeContractDTO } from './types';

export const employeeContractService = {
  async listByEmployee(employeeId: string, tenantId: string) {
    const { data, error } = await supabase
      .from('employee_contracts')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('started_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as EmployeeContract[];
  },

  async getCurrent(employeeId: string, tenantId: string) {
    const { data, error } = await supabase
      .from('employee_contracts')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .eq('is_current', true)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data as EmployeeContract | null;
  },

  async create(dto: CreateEmployeeContractDTO) {
    const { data, error } = await supabase
      .from('employee_contracts')
      .insert(dto as any)
      .select()
      .single();
    if (error) throw error;
    return data as EmployeeContract;
  },

  async update(id: string, tenantId: string, dto: Partial<Omit<EmployeeContract, 'id' | 'tenant_id' | 'employee_id' | 'created_at'>>) {
    const { data, error } = await supabase
      .from('employee_contracts')
      .update(dto as any)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as EmployeeContract;
  },

  async closeContract(id: string, tenantId: string, endReason: string) {
    const { error } = await supabase
      .from('employee_contracts')
      .update({
        is_current: false,
        ended_at: new Date().toISOString().split('T')[0],
        end_reason: endReason,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
  },
};
