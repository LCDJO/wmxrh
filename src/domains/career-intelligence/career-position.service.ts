/**
 * Career Position Service — CRUD for PCCS positions
 */
import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type {
  CareerPosition,
  CreateCareerPositionDTO,
  CareerLegalRequirement,
  CareerSalaryBenchmark,
  CareerRiskAlert,
  CareerPositionWithRelations,
} from './types';

export const careerPositionService = {
  async list(scope: QueryScope): Promise<CareerPosition[]> {
    const q = applyScope(
      supabase.from('career_positions').select('*').is('deleted_at', null).order('nome'),
      scope
    );
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as CareerPosition[];
  },

  async getById(id: string, scope: QueryScope): Promise<CareerPositionWithRelations | null> {
    const { data: pos, error } = await supabase
      .from('career_positions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .is('deleted_at', null)
      .single();
    if (error || !pos) return null;

    const [reqs, benchmarks, alerts] = await Promise.all([
      supabase.from('career_legal_requirements').select('*').eq('career_position_id', id).eq('tenant_id', scope.tenantId),
      supabase.from('career_salary_benchmarks').select('*').eq('career_position_id', id).eq('tenant_id', scope.tenantId),
      supabase.from('career_risk_alerts').select('*').eq('career_position_id', id).eq('tenant_id', scope.tenantId).eq('resolvido', false),
    ]);

    return {
      ...(pos as unknown as CareerPosition),
      legal_requirements: (reqs.data || []) as unknown as CareerLegalRequirement[],
      salary_benchmarks: (benchmarks.data || []) as unknown as CareerSalaryBenchmark[],
      risk_alerts: (alerts.data || []) as unknown as CareerRiskAlert[],
    };
  },

  async create(dto: CreateCareerPositionDTO, scope: QueryScope): Promise<CareerPosition> {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('career_positions').insert(secured).select().single();
    if (error) throw error;
    return data as unknown as CareerPosition;
  },

  async update(id: string, dto: Partial<Omit<CareerPosition, 'id' | 'tenant_id' | 'created_at'>>, scope: QueryScope): Promise<CareerPosition> {
    const { data, error } = await supabase
      .from('career_positions')
      .update(dto as Record<string, unknown>)
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as CareerPosition;
  },

  async softDelete(id: string, scope: QueryScope): Promise<void> {
    const { error } = await supabase
      .from('career_positions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },
};
