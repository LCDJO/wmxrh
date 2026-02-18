/**
 * Employee Service
 * 
 * Queries isolated via SecurityContext — never accepts raw tenant_id.
 * Permission checks delegated to SecurityKernel pipeline.
 */

import { supabase } from '@/integrations/supabase/client';
import { secureQuery, secureInsert } from '@/domains/shared/secure-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';
import type { Employee, EmployeeWithRelations, CreateEmployeeDTO } from '@/domains/shared';

const EMPLOYEE_SELECT = '*, positions(title), departments(name), companies(name), manager:employees!manager_id(name)';

export const employeeService = {
  // ── SecurityContext API (preferred) ──

  async listSecure(ctx: SecurityContext) {
    const q = secureQuery(supabase.from('employees').select(EMPLOYEE_SELECT), ctx);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as EmployeeWithRelations[];
  },

  async listSimpleSecure(ctx: SecurityContext) {
    const q = secureQuery(
      supabase.from('employees').select('id, company_id, department_id, position_id, current_salary, status'),
      ctx
    );
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async getByIdSecure(id: string, ctx: SecurityContext) {
    const q = secureQuery(supabase.from('employees').select(EMPLOYEE_SELECT), ctx)
      .eq('id', id);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data as EmployeeWithRelations | null;
  },

  async createSecure(dto: CreateEmployeeDTO, ctx: SecurityContext) {
    const secured = secureInsert(dto, ctx);
    const { data, error } = await supabase.from('employees').insert(secured).select().single();
    if (error) throw error;
    return data as Employee;
  },

  // ── Legacy API (backward compat) ──

  async list(scope: QueryScope) {
    const q = applyScope(supabase.from('employees').select(EMPLOYEE_SELECT), scope);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as EmployeeWithRelations[];
  },

  async listSimple(scope: QueryScope) {
    const q = applyScope(
      supabase.from('employees').select('id, company_id, department_id, position_id, current_salary, status'),
      scope
    );
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async getById(id: string, scope: QueryScope) {
    const q = applyScope(supabase.from('employees').select(EMPLOYEE_SELECT), scope)
      .eq('id', id);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data as EmployeeWithRelations | null;
  },

  async create(dto: CreateEmployeeDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('employees').insert(secured).select().single();
    if (error) throw error;
    return data as Employee;
  },

  async update(id: string, dto: Partial<Omit<Employee, 'id' | 'tenant_id' | 'created_at'>>, scope: QueryScope) {
    const { data, error } = await supabase
      .from('employees')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as Employee;
  },

  async softDelete(id: string, scope: QueryScope) {
    const { error } = await supabase
      .from('employees')
      .update({ deleted_at: new Date().toISOString(), status: 'inactive' as any })
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },
};
