import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { SalaryContract, CreateSalaryContractDTO } from '@/domains/shared';

export const salaryContractService = {
  async listByEmployee(employeeId: string, scope: QueryScope) {
    const q = applyScope(supabase.from('salary_contracts').select('*'), scope)
      .eq('employee_id', employeeId)
      .order('start_date', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SalaryContract[];
  },

  async getActive(employeeId: string, scope: QueryScope) {
    const q = applyScope(supabase.from('salary_contracts').select('*'), scope)
      .eq('employee_id', employeeId)
      .eq('is_active', true);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data as SalaryContract | null;
  },

  async create(dto: CreateSalaryContractDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('salary_contracts').insert([secured]).select().single();
    if (error) throw error;
    return data as SalaryContract;
  },
};
