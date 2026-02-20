/**
 * Career Path Service — CRUD for career progression tracks
 */
import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import type {
  CareerPath,
  CareerPathWithSteps,
  CareerPathStep,
  CareerPosition,
  CreateCareerPathDTO,
  CreateCareerPathStepDTO,
} from './types';

export const careerPathService = {
  async list(scope: QueryScope): Promise<CareerPath[]> {
    const q = applyScope(
      supabase.from('career_paths').select('*').eq('ativo', true).order('nome'),
      scope
    );
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as CareerPath[];
  },

  async getWithSteps(id: string, scope: QueryScope): Promise<CareerPathWithSteps | null> {
    const { data: path, error } = await supabase
      .from('career_paths')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .single();
    if (error || !path) return null;

    const { data: steps } = await supabase
      .from('career_path_steps')
      .select('*, career_positions(*)')
      .eq('career_path_id', id)
      .eq('tenant_id', scope.tenantId)
      .order('ordem');

    return {
      ...(path as unknown as CareerPath),
      steps: ((steps || []) as unknown as (CareerPathStep & { career_positions: CareerPosition })[]).map(s => ({
        ...s,
        position: s.career_positions,
      })),
    };
  },

  async create(dto: CreateCareerPathDTO, scope: QueryScope): Promise<CareerPath> {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('career_paths').insert(secured).select().single();
    if (error) throw error;
    return data as unknown as CareerPath;
  },

  async addStep(dto: CreateCareerPathStepDTO, scope: QueryScope): Promise<CareerPathStep> {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('career_path_steps').insert(secured).select().single();
    if (error) throw error;
    return data as unknown as CareerPathStep;
  },

  async removeStep(stepId: string, scope: QueryScope): Promise<void> {
    const { error } = await supabase
      .from('career_path_steps')
      .delete()
      .eq('id', stepId)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },
};
