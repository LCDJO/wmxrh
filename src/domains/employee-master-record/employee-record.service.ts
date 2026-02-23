/**
 * Employee Record — Aggregate Root Service
 *
 * Manages the EmployeeRecord entity (matricula, status, dates).
 */
import { supabase } from '@/integrations/supabase/client';
import type { EmployeeRecord, CreateEmployeeRecordDTO } from './types';

export const employeeRecordService = {
  async getByEmployee(employeeId: string, tenantId: string): Promise<EmployeeRecord | null> {
    const { data, error } = await supabase
      .from('employee_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data as EmployeeRecord | null;
  },

  async create(dto: CreateEmployeeRecordDTO): Promise<EmployeeRecord> {
    const { data, error } = await supabase
      .from('employee_records')
      .insert(dto)
      .select()
      .single();
    if (error) throw error;
    return data as EmployeeRecord;
  },

  async update(id: string, tenantId: string, dto: Partial<Omit<CreateEmployeeRecordDTO, 'tenant_id' | 'employee_id'>>): Promise<EmployeeRecord> {
    const { data, error } = await supabase
      .from('employee_records')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as EmployeeRecord;
  },
};
