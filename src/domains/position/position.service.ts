import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope, scopedInsert } from '@/domains/shared/scoped-query';
import { supabase } from '@/integrations/supabase/client';
import type { Position, PositionWithRelations, CreatePositionDTO } from '@/domains/shared';

export const positionService = {
  async list(scope: QueryScope) {
    const q = applyScope(supabase.from('positions').select('*, companies(name)'), scope);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as PositionWithRelations[];
  },

  async create(dto: CreatePositionDTO, scope: QueryScope) {
    const secured = scopedInsert(dto, scope);
    const { data, error } = await supabase.from('positions').insert(secured).select().single();
    if (error) throw error;
    return data as Position;
  },

  async update(id: string, dto: Partial<Omit<Position, 'id' | 'tenant_id' | 'created_at'>>, scope: QueryScope) {
    const { data, error } = await supabase
      .from('positions')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as Position;
  },

  async softDelete(id: string, scope: QueryScope) {
    const { error } = await supabase
      .from('positions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },
};
