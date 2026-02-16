import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { SalaryAdjustment, SalaryAdjustmentWithRelations, CreateSalaryAdjustmentDTO } from '@/domains/shared';

export const salaryAdjustmentService = {
  async listByEmployee(employeeId: string, scope: QueryScope) {
    const q = applyScope(supabase.from('salary_adjustments').select('*'), scope)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SalaryAdjustment[];
  },

  async listByTenant(scope: QueryScope) {
    const q = applyScope(supabase.from('salary_adjustments').select('*, employees(name)'), scope)
      .order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SalaryAdjustmentWithRelations[];
  },

  async create(dto: CreateSalaryAdjustmentDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('salary_adjustments').insert([secured]).select().single();
    if (error) throw error;
    return data as SalaryAdjustment;
  },
};
