import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { SalaryHistory, SalaryHistoryWithRelations, CreateSalaryHistoryDTO } from '@/domains/shared';

export const salaryHistoryService = {
  async listByTenant(scope: QueryScope) {
    const q = applyScope(supabase.from('salary_history').select('*, employees(name)'), scope)
      .order('effective_date', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SalaryHistoryWithRelations[];
  },

  async listByEmployee(employeeId: string, scope: QueryScope) {
    const q = applyScope(supabase.from('salary_history').select('*'), scope)
      .eq('employee_id', employeeId)
      .order('effective_date', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SalaryHistory[];
  },

  async create(dto: CreateSalaryHistoryDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('salary_history').insert(secured).select().single();
    if (error) throw error;
    return data as SalaryHistory;
  },
};
