import { supabase } from '@/integrations/supabase/client';
import type { ISalaryAdjustmentService } from '@/domains/shared';
import type { SalaryAdjustment, SalaryAdjustmentWithRelations, CreateSalaryAdjustmentDTO } from '@/domains/shared';

export const salaryAdjustmentService: ISalaryAdjustmentService = {
  async listByEmployee(employeeId: string) {
    const { data, error } = await supabase
      .from('salary_adjustments')
      .select('*')
      .eq('employee_id', employeeId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as SalaryAdjustment[];
  },

  async listByTenant(tenantId: string) {
    const { data, error } = await supabase
      .from('salary_adjustments')
      .select('*, employees(name)')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as SalaryAdjustmentWithRelations[];
  },

  async create(dto: CreateSalaryAdjustmentDTO) {
    const { data, error } = await supabase
      .from('salary_adjustments')
      .insert([dto])
      .select()
      .single();
    if (error) throw error;
    return data as SalaryAdjustment;
  },
};
