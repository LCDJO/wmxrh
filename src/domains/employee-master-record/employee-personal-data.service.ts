/**
 * Employee Personal Data — Service
 *
 * Manages personal/biographical data (CPF, PIS, birth, family).
 */
import { supabase } from '@/integrations/supabase/client';
import type { EmployeePersonalData, CreateEmployeePersonalDataDTO } from './types';

export const employeePersonalDataService = {
  async getByEmployee(employeeId: string, tenantId: string): Promise<EmployeePersonalData | null> {
    const { data, error } = await supabase
      .from('employee_personal_data')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data as EmployeePersonalData | null;
  },

  async upsert(dto: CreateEmployeePersonalDataDTO): Promise<EmployeePersonalData> {
    // Try update first, then insert
    const existing = await employeePersonalDataService.getByEmployee(dto.employee_id, dto.tenant_id);
    if (existing) {
      const { data, error } = await supabase
        .from('employee_personal_data')
        .update(dto)
        .eq('id', existing.id)
        .eq('tenant_id', dto.tenant_id)
        .select()
        .single();
      if (error) throw error;
      return data as EmployeePersonalData;
    }
    const { data, error } = await supabase
      .from('employee_personal_data')
      .insert(dto)
      .select()
      .single();
    if (error) throw error;
    return data as EmployeePersonalData;
  },
};
