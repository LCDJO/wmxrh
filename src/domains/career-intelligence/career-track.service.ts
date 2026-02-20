/**
 * Career Track Service — Pairwise career progression (origem → destino)
 */
import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { scopedInsert } from '@/domains/shared/scoped-query';
import type { CareerTrack, CreateCareerTrackDTO } from './types';

export const careerTrackService = {
  async list(scope: QueryScope): Promise<CareerTrack[]> {
    const { data, error } = await supabase
      .from('career_tracks')
      .select('*')
      .eq('tenant_id', scope.tenantId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as CareerTrack[];
  },

  async listByOrigin(positionId: string, scope: QueryScope): Promise<CareerTrack[]> {
    const { data, error } = await supabase
      .from('career_tracks')
      .select('*')
      .eq('cargo_origem_id', positionId)
      .eq('tenant_id', scope.tenantId)
      .eq('ativo', true)
      .order('tempo_minimo_meses');
    if (error) throw error;
    return (data || []) as unknown as CareerTrack[];
  },

  async create(dto: CreateCareerTrackDTO, scope: QueryScope): Promise<CareerTrack> {
    const secured = scopedInsert(dto, scope) as unknown;
    const { data, error } = await supabase.from('career_tracks').insert(secured as any).select().single();
    if (error) throw error;
    return data as unknown as CareerTrack;
  },

  async update(id: string, dto: Partial<Omit<CareerTrack, 'id' | 'tenant_id' | 'created_at'>>, scope: QueryScope): Promise<CareerTrack> {
    const { data, error } = await supabase
      .from('career_tracks')
      .update(dto as Record<string, unknown>)
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as CareerTrack;
  },

  async delete(id: string, scope: QueryScope): Promise<void> {
    const { error } = await supabase
      .from('career_tracks')
      .delete()
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },
};
