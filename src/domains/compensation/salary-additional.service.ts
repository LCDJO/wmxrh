/**
 * Salary Additional Service
 * 
 * Queries isolated via SecurityContext.
 * Permission checks delegated to SecurityKernel pipeline.
 */

import { supabase } from '@/integrations/supabase/client';
import { secureQuery, secureInsert } from '@/domains/shared/secure-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import type { SalaryAdditional, CreateSalaryAdditionalDTO } from '@/domains/shared';

export const salaryAdditionalService = {
  // ── SecurityContext API (preferred) ──

  async listByEmployeeSecure(employeeId: string, ctx: SecurityContext) {
    const q = secureQuery(supabase.from('salary_additionals').select('*'), ctx)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SalaryAdditional[];
  },

  async createSecure(dto: CreateSalaryAdditionalDTO, ctx: SecurityContext) {
    const secured = secureInsert(dto, ctx);
    const { data, error } = await supabase.from('salary_additionals').insert([secured]).select().single();
    if (error) throw error;
    return data as SalaryAdditional;
  },

  // ── Legacy API ──

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
