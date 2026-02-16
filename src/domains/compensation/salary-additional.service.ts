import { supabase } from '@/integrations/supabase/client';
import type { ISalaryAdditionalService } from '@/domains/shared';
import type { SalaryAdditional, CreateSalaryAdditionalDTO } from '@/domains/shared';

export const salaryAdditionalService: ISalaryAdditionalService = {
  async listByEmployee(employeeId: string) {
    const { data, error } = await supabase
      .from('salary_additionals')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as SalaryAdditional[];
  },

  async create(dto: CreateSalaryAdditionalDTO) {
    const { data, error } = await supabase
      .from('salary_additionals')
      .insert([dto])
      .select()
      .single();
    if (error) throw error;
    return data as SalaryAdditional;
  },
};
