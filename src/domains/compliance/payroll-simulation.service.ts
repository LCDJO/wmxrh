/**
 * Payroll Simulation Service
 * Calls the DB function to simulate INSS/IRRF/FGTS calculations.
 */

import { supabase } from '@/integrations/supabase/client';
import type { PayrollSimulationResult } from '@/domains/shared/types';

export const payrollSimulationService = {
  async simulate(tenantId: string, baseSalary: number, referenceDate?: string): Promise<PayrollSimulationResult> {
    const { data, error } = await supabase.rpc('calculate_payroll_simulation', {
      _tenant_id: tenantId,
      _base_salary: baseSalary,
      _reference_date: referenceDate || new Date().toISOString().split('T')[0],
    });
    if (error) throw error;
    return data as unknown as PayrollSimulationResult;
  },
};
