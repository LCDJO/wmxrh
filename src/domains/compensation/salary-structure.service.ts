/**
 * Salary Structure Service
 * Manages salary composition (aggregate root) with rubrics.
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type {
  SalaryStructure, SalaryStructureWithRubrics, SalaryRubric,
  CreateSalaryStructureDTO, CreateSalaryRubricDTO,
} from '@/domains/shared/types';

export const salaryStructureService = {
  async listByEmployee(employeeId: string, scope: QueryScope) {
    const q = applyScope(
      supabase.from('salary_structures').select('*, salary_rubrics(*), employees!salary_structures_employee_id_fkey(name)'),
      scope
    ).eq('employee_id', employeeId).order('start_date', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as SalaryStructureWithRubrics[];
  },

  async getActive(employeeId: string, scope: QueryScope) {
    const q = applyScope(
      supabase.from('salary_structures').select('*, salary_rubrics(*)'),
      scope
    ).eq('employee_id', employeeId).eq('is_active', true).maybeSingle();
    const { data, error } = await q;
    if (error) throw error;
    return data as unknown as SalaryStructureWithRubrics | null;
  },

  async listByTenant(scope: QueryScope) {
    const q = applyScope(
      supabase.from('salary_structures').select('*, salary_rubrics(*), employees!salary_structures_employee_id_fkey(name)'),
      scope
    ).eq('is_active', true).order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as SalaryStructureWithRubrics[];
  },

  async create(dto: CreateSalaryStructureDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('salary_structures').insert(secured).select().single();
    if (error) throw error;
    return data as unknown as SalaryStructure;
  },

  async addRubric(dto: CreateSalaryRubricDTO) {
    const { data, error } = await supabase.from('salary_rubrics').insert(dto).select().single();
    if (error) throw error;
    return data as unknown as SalaryRubric;
  },

  async removeRubric(rubricId: string) {
    const { error } = await supabase.from('salary_rubrics').delete().eq('id', rubricId);
    if (error) throw error;
  },
};
