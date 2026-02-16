import { supabase } from '@/integrations/supabase/client';
import type { IPositionService } from '@/domains/shared';
import type { Position, PositionWithRelations, CreatePositionDTO } from '@/domains/shared';

export const positionService: IPositionService = {
  async list(tenantId: string) {
    const { data, error } = await supabase.from('positions').select('*, companies(name)').eq('tenant_id', tenantId);
    if (error) throw error;
    return (data || []) as PositionWithRelations[];
  },

  async create(dto: CreatePositionDTO) {
    const { data, error } = await supabase.from('positions').insert(dto).select().single();
    if (error) throw error;
    return data as Position;
  },
};
