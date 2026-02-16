/**
 * Salary Adjustment Service
 * 
 * Queries isolated via SecurityContext.
 * Permission checks delegated to SecurityKernel pipeline.
 */

import { supabase } from '@/integrations/supabase/client';
import { secureQuery, secureInsert } from '@/domains/shared/secure-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import type { SalaryAdjustment, SalaryAdjustmentWithRelations, CreateSalaryAdjustmentDTO } from '@/domains/shared';

export const salaryAdjustmentService = {
  // ── SecurityContext API (preferred) ──

  async listByEmployeeSecure(employeeId: string, ctx: SecurityContext) {
    const q = secureQuery(supabase.from('salary_adjustments').select('*'), ctx)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SalaryAdjustment[];
  },

  async listByTenantSecure(ctx: SecurityContext) {
    const q = secureQuery(supabase.from('salary_adjustments').select('*, employees(name)'), ctx)
      .order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SalaryAdjustmentWithRelations[];
  },

  async createSecure(dto: CreateSalaryAdjustmentDTO, ctx: SecurityContext) {
    const secured = secureInsert(dto, ctx);
    const { data, error } = await supabase.from('salary_adjustments').insert([secured]).select().single();
    if (error) throw error;
    return data as SalaryAdjustment;
  },

  // ── Legacy API ──

  async listByEmployee(employeeId: string, scope: QueryScope) {
    const q = applyScope(supabase.from('salary_adjustments').select('*'), scope)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SalaryAdjustment[];
  },

  async listByTenant(scope: QueryScope) {
    const q = applyScope(supabase.from('salary_adjustments').select('*, employees(name)'), scope)
      .order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as SalaryAdjustmentWithRelations[];
  },

  async create(dto: CreateSalaryAdjustmentDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('salary_adjustments').insert([secured]).select().single();
    if (error) throw error;
    return data as SalaryAdjustment;
  },
};
