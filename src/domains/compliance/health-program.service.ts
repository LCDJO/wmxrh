/**
 * Health Program & Exam Service
 * Manages PCMSO, PGR, LTCAT programs and ASO exams.
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type {
  HealthProgram, CreateHealthProgramDTO,
  EmployeeHealthExam, CreateHealthExamDTO,
  OccupationalRiskFactor, ExposureGroup,
} from '@/domains/shared/types';

export const healthProgramService = {
  // ── Programs ──
  async listPrograms(scope: QueryScope) {
    const q = applyScope(
      supabase.from('health_programs').select('*'),
      scope
    ).order('valid_until', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as HealthProgram[];
  },

  async createProgram(dto: CreateHealthProgramDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('health_programs').insert(secured).select().single();
    if (error) throw error;
    return data as HealthProgram;
  },

  async updateProgram(id: string, dto: Partial<Omit<HealthProgram, 'id' | 'tenant_id' | 'created_at'>>, scope: QueryScope) {
    const { data, error } = await supabase
      .from('health_programs')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as HealthProgram;
  },

  async deleteProgram(id: string, scope: QueryScope) {
    const { error } = await supabase
      .from('health_programs')
      .delete()
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },

  // ── Exams (ASO) ──
  async listExams(scope: QueryScope, employeeId?: string) {
    let q = applyScope(
      supabase.from('employee_health_exams').select('*'),
      scope
    ).order('exam_date', { ascending: false });
    if (employeeId) q = q.eq('employee_id', employeeId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as EmployeeHealthExam[];
  },

  async createExam(dto: CreateHealthExamDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('employee_health_exams').insert(secured).select().single();
    if (error) throw error;
    return data as EmployeeHealthExam;
  },

  async deleteExam(id: string, scope: QueryScope) {
    const { error } = await supabase
      .from('employee_health_exams')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },

  // ── Risk Factors ──
  async listRiskFactors(scope: QueryScope) {
    const q = applyScope(
      supabase.from('occupational_risk_factors').select('*'),
      scope,
      { skipScopeFilter: true, skipSoftDelete: true }
    ).order('category').order('name');
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as OccupationalRiskFactor[];
  },

  // ── Exposure Groups (GHE) ──
  async listExposureGroups(scope: QueryScope) {
    const q = applyScope(
      supabase.from('exposure_groups').select('*'),
      scope
    ).order('code');
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as ExposureGroup[];
  },
};
