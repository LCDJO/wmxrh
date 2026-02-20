/**
 * Career Legal Requirements Service
 * Maps legal/NR/PCMSO requirements per career position
 */
import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { scopedInsert } from '@/domains/shared/scoped-query';
import type { CareerLegalRequirement, CreateCareerLegalRequirementDTO } from './types';

export const legalRequirementsService = {
  async listByPosition(positionId: string, scope: QueryScope): Promise<CareerLegalRequirement[]> {
    const { data, error } = await supabase
      .from('career_legal_requirements')
      .select('*')
      .eq('career_position_id', positionId)
      .eq('tenant_id', scope.tenantId)
      .order('tipo');
    if (error) throw error;
    return (data || []) as unknown as CareerLegalRequirement[];
  },

  async create(dto: CreateCareerLegalRequirementDTO, scope: QueryScope): Promise<CareerLegalRequirement> {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('career_legal_requirements').insert(secured).select().single();
    if (error) throw error;
    return data as unknown as CareerLegalRequirement;
  },

  async delete(id: string, scope: QueryScope): Promise<void> {
    const { error } = await supabase
      .from('career_legal_requirements')
      .delete()
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },
};
