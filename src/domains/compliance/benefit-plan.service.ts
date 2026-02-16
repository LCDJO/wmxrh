/**
 * Benefit Plan Service
 * Manages VA/VR, health, dental plans.
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { BenefitPlan, CreateBenefitPlanDTO, EmployeeBenefit, CreateEmployeeBenefitDTO } from '@/domains/shared/types';

export const benefitPlanService = {
  async listPlans(scope: QueryScope) {
    const q = applyScope(
      supabase.from('benefit_plans').select('*'),
      scope,
      { skipScopeFilter: true }
    ).order('benefit_type').order('name');
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as BenefitPlan[];
  },

  async createPlan(dto: CreateBenefitPlanDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('benefit_plans').insert(secured).select().single();
    if (error) throw error;
    return data as BenefitPlan;
  },

  async listEmployeeBenefits(employeeId: string, scope: QueryScope) {
    const q = applyScope(
      supabase.from('employee_benefits').select('*, benefit_plans(*)'),
      scope
    ).eq('employee_id', employeeId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as EmployeeBenefit[];
  },

  async createEmployeeBenefit(dto: CreateEmployeeBenefitDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('employee_benefits').insert(secured).select().single();
    if (error) throw error;
    return data as EmployeeBenefit;
  },
};
