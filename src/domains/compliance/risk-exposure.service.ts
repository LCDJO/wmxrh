/**
 * Risk Exposure Service
 * Manages employee-level risk exposures, EPI, and hazard pay integration.
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { EmployeeRiskExposure, CreateEmployeeRiskExposureDTO } from '@/domains/shared/types';

export const riskExposureService = {
  async listByEmployee(employeeId: string, scope: QueryScope) {
    const q = applyScope(
      supabase.from('employee_risk_exposures').select('*, occupational_risk_factors(*), exposure_groups(*)'),
      scope
    ).eq('employee_id', employeeId).is('deleted_at', null).order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as EmployeeRiskExposure[];
  },

  async listByTenant(scope: QueryScope) {
    const q = applyScope(
      supabase.from('employee_risk_exposures').select('*, occupational_risk_factors(*), exposure_groups(*), employees(name)'),
      scope,
      { skipScopeFilter: true }
    ).is('deleted_at', null).eq('is_active', true).order('risk_level', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as EmployeeRiskExposure[];
  },

  async create(dto: CreateEmployeeRiskExposureDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('employee_risk_exposures').insert(secured).select().single();
    if (error) throw error;
    return data as EmployeeRiskExposure;
  },

  async update(id: string, updates: Partial<EmployeeRiskExposure>) {
    const { data, error } = await supabase.from('employee_risk_exposures').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as EmployeeRiskExposure;
  },

  async softDelete(id: string) {
    const { error } = await supabase.from('employee_risk_exposures').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id);
    if (error) throw error;
  },

  async listHazardPayEmployees(scope: QueryScope) {
    const q = applyScope(
      supabase.from('employee_risk_exposures').select('*, occupational_risk_factors(name, category), employees(name, current_salary)'),
      scope,
      { skipScopeFilter: true }
    ).eq('generates_hazard_pay', true).eq('is_active', true).is('deleted_at', null);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as EmployeeRiskExposure[];
  },
};
