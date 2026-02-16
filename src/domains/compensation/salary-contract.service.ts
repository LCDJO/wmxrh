import { supabase } from '@/integrations/supabase/client';
import type { ISalaryContractService } from '@/domains/shared';
import type { SalaryContract, CreateSalaryContractDTO } from '@/domains/shared';

export const salaryContractService: ISalaryContractService = {
  async listByEmployee(employeeId: string) {
    const { data, error } = await supabase
      .from('salary_contracts')
      .select('*')
      .eq('employee_id', employeeId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false });
    if (error) throw error;
    return (data || []) as SalaryContract[];
  },

  async getActive(employeeId: string) {
    const { data, error } = await supabase
      .from('salary_contracts')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data as SalaryContract | null;
  },

  async create(dto: CreateSalaryContractDTO) {
    const { data, error } = await supabase
      .from('salary_contracts')
      .insert([dto])
      .select()
      .single();
    if (error) throw error;
    return data as SalaryContract;
  },
};
