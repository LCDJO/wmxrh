/**
 * Salary Benchmark Service — Market/internal salary benchmarks per position
 */
import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { scopedInsert } from '@/domains/shared/scoped-query';
import type { CareerSalaryBenchmark, CreateCareerSalaryBenchmarkDTO } from './types';

export const salaryBenchmarkService = {
  async listByPosition(positionId: string, scope: QueryScope): Promise<CareerSalaryBenchmark[]> {
    const { data, error } = await supabase
      .from('career_salary_benchmarks')
      .select('*')
      .eq('career_position_id', positionId)
      .eq('tenant_id', scope.tenantId)
      .order('referencia_data', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as CareerSalaryBenchmark[];
  },

  async create(dto: CreateCareerSalaryBenchmarkDTO, scope: QueryScope): Promise<CareerSalaryBenchmark> {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('career_salary_benchmarks').insert(secured).select().single();
    if (error) throw error;
    return data as unknown as CareerSalaryBenchmark;
  },
};
