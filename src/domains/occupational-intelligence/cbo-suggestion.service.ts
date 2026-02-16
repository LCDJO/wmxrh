/**
 * CBO Suggestion Service
 *
 * Persists CBO catalog and CNAE→CBO mappings.
 * Generates initial suggestions from the in-memory engine,
 * persists them, and supports RH approval workflow.
 */

import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope } from '@/domains/shared/scoped-query';
import { suggestCbos } from './cbo-suggester';
import { getApplicableNrs } from './nr-training-mapper';
import { classifyCnae, parseCnaeDivision } from './cnae-risk-classifier';
import type { Json } from '@/integrations/supabase/types';

// ─── Types ───

export interface CboCatalogRecord {
  id: string;
  tenant_id: string;
  cbo_codigo: string;
  nome_funcao: string;
  descricao: string | null;
  area_ocupacional: string | null;
  nrs_relacionadas: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CnaeCboMappingRecord {
  id: string;
  tenant_id: string;
  cnae_codigo: string;
  cbo_codigo: string;
  probabilidade: number;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

// ─── Service ───

export const cboSuggestionService = {

  /**
   * Generate CBO suggestions for a CNAE code, persist catalog entries
   * and mappings, returning pending-approval records.
   */
  async generateAndPersist(
    tenantId: string,
    cnaeCode: string,
  ): Promise<CnaeCboMappingRecord[]> {
    const division = parseCnaeDivision(cnaeCode);
    const suggestions = suggestCbos(division);
    const cnaeInfo = classifyCnae(cnaeCode);
    const nrs = getApplicableNrs(cnaeInfo.grau_risco).map(n => n.nr_number);

    if (suggestions.length === 0) return [];

    // 1. Upsert CBO catalog entries
    const catalogPayloads = suggestions.map(s => ({
      tenant_id: tenantId,
      cbo_codigo: s.cbo.code,
      nome_funcao: s.cbo.title,
      descricao: s.cbo.description,
      area_ocupacional: s.cbo.family,
      nrs_relacionadas: nrs,
    }));

    await supabase
      .from('cbo_catalog')
      .upsert(catalogPayloads, { onConflict: 'tenant_id,cbo_codigo' });

    // 2. Upsert CNAE→CBO mappings (pending approval)
    const mappingPayloads = suggestions.map(s => ({
      tenant_id: tenantId,
      cnae_codigo: cnaeCode,
      cbo_codigo: s.cbo.code,
      probabilidade: s.relevance,
      source: 'engine',
      approved: false,
    }));

    const { data, error } = await supabase
      .from('cnae_cbo_mappings')
      .upsert(mappingPayloads, { onConflict: 'tenant_id,cnae_codigo,cbo_codigo' })
      .select();

    if (error) throw error;
    return (data ?? []) as CnaeCboMappingRecord[];
  },

  /**
   * RH approves a CBO suggestion for a CNAE.
   */
  async approve(mappingId: string, userId: string): Promise<CnaeCboMappingRecord> {
    const { data, error } = await supabase
      .from('cnae_cbo_mappings')
      .update({
        approved: true,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', mappingId)
      .select()
      .single();

    if (error) throw error;
    return data as CnaeCboMappingRecord;
  },

  /**
   * RH bulk-approves multiple suggestions.
   */
  async bulkApprove(mappingIds: string[], userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('cnae_cbo_mappings')
      .update({
        approved: true,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .in('id', mappingIds)
      .select();

    if (error) throw error;
    return data?.length ?? 0;
  },

  /**
   * RH rejects (deletes) a CBO suggestion.
   */
  async reject(mappingId: string): Promise<void> {
    const { error } = await supabase
      .from('cnae_cbo_mappings')
      .delete()
      .eq('id', mappingId);

    if (error) throw error;
  },

  /**
   * List CBO mappings for a CNAE code within scope.
   */
  async listByCnae(cnaeCode: string, scope: QueryScope): Promise<CnaeCboMappingRecord[]> {
    const q = applyScope(
      supabase
        .from('cnae_cbo_mappings')
        .select('*')
        .eq('cnae_codigo', cnaeCode)
        .order('probabilidade', { ascending: false }),
      scope,
    );
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as CnaeCboMappingRecord[];
  },

  /**
   * List all CBO catalog entries.
   */
  async listCatalog(scope: QueryScope): Promise<CboCatalogRecord[]> {
    const q = applyScope(
      supabase.from('cbo_catalog').select('*').eq('is_active', true).order('cbo_codigo'),
      scope,
    );
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as CboCatalogRecord[];
  },

  /**
   * Get pending (not yet approved) suggestions for a CNAE.
   */
  async listPending(cnaeCode: string, scope: QueryScope): Promise<CnaeCboMappingRecord[]> {
    const q = applyScope(
      supabase
        .from('cnae_cbo_mappings')
        .select('*')
        .eq('cnae_codigo', cnaeCode)
        .eq('approved', false)
        .order('probabilidade', { ascending: false }),
      scope,
    );
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as CnaeCboMappingRecord[];
  },
};
