import { supabase } from '@/integrations/supabase/client';
import type { ISalaryHistoryService } from '@/domains/shared';
import type { SalaryHistory, SalaryHistoryWithRelations, CreateSalaryHistoryDTO } from '@/domains/shared';

export const salaryHistoryService: ISalaryHistoryService = {
  async listByTenant(tenantId: string) {
    const { data, error } = await supabase
      .from('salary_history')
      .select('*, employees(name)')
      .eq('tenant_id', tenantId)
      .order('effective_date', { ascending: false });
    if (error) throw error;
    return (data || []) as SalaryHistoryWithRelations[];
  },

  async listByEmployee(employeeId: string) {
    const { data, error } = await supabase
      .from('salary_history')
      .select('*')
      .eq('employee_id', employeeId)
      .order('effective_date', { ascending: false });
    if (error) throw error;
    return (data || []) as SalaryHistory[];
  },

  async create(dto: CreateSalaryHistoryDTO) {
    const { data, error } = await supabase.from('salary_history').insert(dto).select().single();
    if (error) throw error;
    return data as SalaryHistory;
  },
};
