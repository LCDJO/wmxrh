/**
 * Career Legal Mapping Service — Links positions to legal requirements
 */
import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { scopedInsert } from '@/domains/shared/scoped-query';
import type { CareerLegalMapping, CreateCareerLegalMappingDTO } from './types';

export const careerLegalMappingService = {
  async listByPosition(positionId: string, scope: QueryScope): Promise<CareerLegalMapping[]> {
    const { data, error } = await supabase
      .from('career_legal_mappings')
      .select('*')
      .eq('career_position_id', positionId)
      .eq('tenant_id', scope.tenantId)
      .order('nr_codigo');
    if (error) throw error;
    return (data || []) as unknown as CareerLegalMapping[];
  },

  async list(scope: QueryScope): Promise<CareerLegalMapping[]> {
    const { data, error } = await supabase
      .from('career_legal_mappings')
      .select('*')
      .eq('tenant_id', scope.tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as CareerLegalMapping[];
  },

  async create(dto: CreateCareerLegalMappingDTO, scope: QueryScope): Promise<CareerLegalMapping> {
    const secured = scopedInsert(dto, scope) as unknown;
    const { data, error } = await supabase.from('career_legal_mappings').insert(secured as any).select().single();
    if (error) throw error;
    return data as unknown as CareerLegalMapping;
  },

  async update(id: string, dto: Partial<Omit<CareerLegalMapping, 'id' | 'tenant_id' | 'created_at'>>, scope: QueryScope): Promise<CareerLegalMapping> {
    const { data, error } = await supabase
      .from('career_legal_mappings')
      .update(dto as Record<string, unknown>)
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as CareerLegalMapping;
  },

  async delete(id: string, scope: QueryScope): Promise<void> {
    const { error } = await supabase
      .from('career_legal_mappings')
      .delete()
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },
};
