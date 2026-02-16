/**
 * NR Training Requirement Service
 *
 * Persists NR training catalog and generates company+CBO-specific
 * training requirements based on risk grade and applicable NRs.
 */

import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope } from '@/domains/shared/scoped-query';
import { getApplicableNrs, getTrainingRequirements } from './nr-training-mapper';
import type { GrauRisco } from './types';

// ─── Types ───

export interface NrTrainingCatalogRecord {
  id: string;
  tenant_id: string;
  nr_codigo: number;
  nome: string;
  descricao: string | null;
  obrigatoria_para_grau_risco: number[];
  periodicidade: string;
  carga_horaria_minima: number;
  validade_meses: number | null;
  base_legal: string | null;
  target_cbos: string[];
  is_active: boolean;
  is_system: boolean;
  exige_reciclagem: boolean;
  exige_avaliacao_medica: boolean;
  exige_assinatura_termo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingRequirementRecord {
  id: string;
  tenant_id: string;
  company_id: string;
  company_group_id: string | null;
  catalog_item_id: string;
  cbo_codigo: string;
  nr_codigo: number;
  obrigatorio: boolean;
  condicional_por_risco: boolean;
  grau_risco_minimo: number;
  source: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ─── Service ───

export const nrTrainingRequirementService = {

  /**
   * List NR training catalog for the tenant.
   */
  async listCatalog(scope: QueryScope): Promise<NrTrainingCatalogRecord[]> {
    const q = applyScope(
      supabase
        .from('nr_training_catalog')
        .select('*')
        .eq('is_active', true)
        .order('nr_codigo'),
      scope,
      { skipSoftDelete: true },
    );
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as NrTrainingCatalogRecord[];
  },

  /**
   * Generate training requirements for a company + CBO combination.
   * Uses the catalog entries matching the company's risk grade and CBO.
   */
  async generateForCompanyCbo(
    tenantId: string,
    companyId: string,
    companyGroupId: string | null,
    grauRisco: GrauRisco,
    cboCodigo: string,
  ): Promise<TrainingRequirementRecord[]> {
    // 1. Get catalog items that apply to this risk grade
    const { data: catalog, error: catErr } = await supabase
      .from('nr_training_catalog')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .contains('obrigatoria_para_grau_risco', [grauRisco]);

    if (catErr) throw catErr;
    if (!catalog || catalog.length === 0) return [];

    // 2. Filter by CBO compatibility
    const applicable = catalog.filter(c => {
      if (!c.target_cbos || c.target_cbos.length === 0) return true;
      return c.target_cbos.includes(cboCodigo);
    });

    if (applicable.length === 0) return [];

    // 3. Upsert training requirements
    const payloads = applicable.map(c => {
      // Determine if this is conditional based on risk grade
      const isUniversal = (c.obrigatoria_para_grau_risco as number[]).length === 4;
      const minGrau = Math.min(...(c.obrigatoria_para_grau_risco as number[]));

      return {
        tenant_id: tenantId,
        company_id: companyId,
        company_group_id: companyGroupId,
        catalog_item_id: c.id,
        cbo_codigo: cboCodigo,
        nr_codigo: c.nr_codigo,
        obrigatorio: true,
        condicional_por_risco: !isUniversal,
        grau_risco_minimo: minGrau,
        source: 'engine',
      };
    });

    const { data, error } = await supabase
      .from('training_requirements')
      .upsert(payloads, { onConflict: 'tenant_id,company_id,cbo_codigo,catalog_item_id' })
      .select();

    if (error) throw error;
    return (data ?? []) as TrainingRequirementRecord[];
  },

  /**
   * List training requirements for a company.
   */
  async listByCompany(companyId: string, scope: QueryScope): Promise<TrainingRequirementRecord[]> {
    const q = applyScope(
      supabase
        .from('training_requirements')
        .select('*')
        .eq('company_id', companyId)
        .order('nr_codigo'),
      scope,
    );
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as TrainingRequirementRecord[];
  },

  /**
   * List training requirements for a specific CBO within a company.
   */
  async listByCompanyCbo(companyId: string, cboCodigo: string, scope: QueryScope): Promise<TrainingRequirementRecord[]> {
    const q = applyScope(
      supabase
        .from('training_requirements')
        .select('*')
        .eq('company_id', companyId)
        .eq('cbo_codigo', cboCodigo)
        .order('nr_codigo'),
      scope,
    );
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as TrainingRequirementRecord[];
  },

  /**
   * Toggle obrigatorio flag.
   */
  async toggleObrigatorio(requirementId: string, obrigatorio: boolean): Promise<void> {
    const { error } = await supabase
      .from('training_requirements')
      .update({ obrigatorio })
      .eq('id', requirementId);
    if (error) throw error;
  },

  /**
   * Soft-delete a training requirement.
   */
  async remove(requirementId: string): Promise<void> {
    const { error } = await supabase
      .from('training_requirements')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', requirementId);
    if (error) throw error;
  },
};
