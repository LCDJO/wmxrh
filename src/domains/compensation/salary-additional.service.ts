import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { SalaryAdditional, CreateSalaryAdditionalDTO } from '@/domains/shared';

export const salaryAdditionalService = {
  async listByEmployee(employeeId: string, scope: QueryScope) {
    const q = applyScope(supabase.from('salary_additionals').select('*'), scope)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SalaryAdditional[];
  },

  async create(dto: CreateSalaryAdditionalDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('salary_additionals').insert([secured]).select().single();
    if (error) throw error;
    return data as SalaryAdditional;
  },
};
