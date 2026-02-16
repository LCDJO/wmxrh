/**
 * Salary Contract Service
 * 
 * Queries isolated via SecurityContext.
 * Permission checks delegated to SecurityKernel pipeline.
 */

import { supabase } from '@/integrations/supabase/client';
import { secureQuery, secureInsert } from '@/domains/shared/secure-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import type { SalaryContract, CreateSalaryContractDTO } from '@/domains/shared';

export const salaryContractService = {
  // ── SecurityContext API (preferred) ──

  async listByEmployeeSecure(employeeId: string, ctx: SecurityContext) {
    const q = secureQuery(supabase.from('salary_contracts').select('*'), ctx)
      .eq('employee_id', employeeId)
      .order('start_date', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SalaryContract[];
  },

  async getActiveSecure(employeeId: string, ctx: SecurityContext) {
    const q = secureQuery(supabase.from('salary_contracts').select('*'), ctx)
      .eq('employee_id', employeeId)
      .eq('is_active', true);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data as SalaryContract | null;
  },

  async createSecure(dto: CreateSalaryContractDTO, ctx: SecurityContext) {
    const secured = secureInsert(dto, ctx);
    const { data, error } = await supabase.from('salary_contracts').insert([secured]).select().single();
    if (error) throw error;
    return data as SalaryContract;
  },

  // ── Legacy API ──

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
