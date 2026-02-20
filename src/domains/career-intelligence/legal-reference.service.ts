/**
 * Legal Reference Service — CRUD for legal knowledge base
 */
import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { scopedInsert } from '@/domains/shared/scoped-query';
import type { LegalReference, CreateLegalReferenceDTO, LegalReferenceTipo } from './types';

export const legalReferenceService = {
  async list(scope: QueryScope, tipo?: LegalReferenceTipo): Promise<LegalReference[]> {
    let q = supabase
      .from('legal_references')
      .select('*')
      .eq('tenant_id', scope.tenantId)
      .order('codigo_referencia');
    if (tipo) q = q.eq('tipo', tipo);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as LegalReference[];
  },

  async create(dto: CreateLegalReferenceDTO, scope: QueryScope): Promise<LegalReference> {
    const secured = scopedInsert(dto, scope) as unknown;
    const { data, error } = await supabase.from('legal_references').insert(secured as any).select().single();
    if (error) throw error;
    return data as unknown as LegalReference;
  },

  async update(id: string, dto: Partial<Omit<LegalReference, 'id' | 'tenant_id' | 'created_at'>>, scope: QueryScope): Promise<LegalReference> {
    const { data, error } = await supabase
      .from('legal_references')
      .update(dto as Record<string, unknown>)
      .eq('id', id)
      .eq('tenant_id', scope.tenantId)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as LegalReference;
  },

  async delete(id: string, scope: QueryScope): Promise<void> {
    const { error } = await supabase
      .from('legal_references')
      .delete()
      .eq('id', id)
      .eq('tenant_id', scope.tenantId);
    if (error) throw error;
  },

  async findByCode(codigo: string, scope: QueryScope): Promise<LegalReference | null> {
    const { data, error } = await supabase
      .from('legal_references')
      .select('*')
      .eq('tenant_id', scope.tenantId)
      .eq('codigo_referencia', codigo)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as LegalReference | null;
  },
};
