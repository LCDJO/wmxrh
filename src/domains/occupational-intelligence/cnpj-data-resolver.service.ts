/**
 * CNPJ Data Resolver Service
 *
 * Resolves CNPJ → CNAE profile, persists to company_cnae_profiles,
 * and integrates with the Occupational Intelligence Engine.
 */

import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope } from '@/domains/shared/scoped-query';
import { classifyCnae, parseCnaeDivision } from './cnae-risk-classifier';
import type { GrauRisco } from './types';

// ─── Types ───

export interface CompanyCNAEProfile {
  id: string;
  tenant_id: string;
  company_id: string;
  cnpj: string;
  cnae_principal: string;
  cnaes_secundarios: string[];
  descricao_atividade: string;
  grau_risco_sugerido: number;
  resolved_at: string | null;
  source: string;
  raw_response: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ResolvedCNPJData {
  cnpj: string;
  cnae_principal: string;
  cnaes_secundarios: string[];
  descricao_atividade: string;
  razao_social?: string;
  raw: Record<string, unknown>;
}

export interface UpsertCNAEProfileDTO {
  tenant_id: string;
  company_id: string;
  cnpj: string;
  cnae_principal: string;
  cnaes_secundarios?: string[];
  descricao_atividade?: string;
  source?: string;
  raw_response?: Record<string, unknown> | null;
}

// ─── Helpers ───

function sanitizeCnpj(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '').slice(0, 14);
}

function isValidCnpj(cnpj: string): boolean {
  const digits = sanitizeCnpj(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

// ─── Service ───

export const cnpjDataResolverService = {

  /**
   * Fetch CNPJ data from BrasilAPI (free, no key required).
   * Returns structured CNAE data or null if unavailable.
   */
  async resolveCNPJ(cnpj: string): Promise<ResolvedCNPJData | null> {
    const cleaned = sanitizeCnpj(cnpj);
    if (!isValidCnpj(cleaned)) {
      console.warn('[CNPJ Resolver] CNPJ inválido:', cnpj);
      return null;
    }

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleaned}`);
      if (!response.ok) {
        console.warn('[CNPJ Resolver] API retornou status:', response.status);
        return null;
      }

      const data = await response.json();

      const cnaePrincipal = String(data.cnae_fiscal ?? '').trim();
      const cnaesSecundarios = Array.isArray(data.cnaes_secundarios)
        ? data.cnaes_secundarios.map((c: { codigo?: number }) => String(c.codigo ?? ''))
          .filter((c: string) => c.length > 0)
        : [];

      return {
        cnpj: cleaned,
        cnae_principal: cnaePrincipal,
        cnaes_secundarios: cnaesSecundarios,
        descricao_atividade: String(data.cnae_fiscal_descricao ?? ''),
        razao_social: data.razao_social ?? undefined,
        raw: data,
      };
    } catch (err) {
      console.error('[CNPJ Resolver] Falha na consulta:', err);
      return null;
    }
  },

  /**
   * Resolve CNPJ and persist profile (upsert).
   */
  async resolveAndPersist(
    tenantId: string,
    companyId: string,
    cnpj: string,
  ): Promise<CompanyCNAEProfile | null> {
    const resolved = await this.resolveCNPJ(cnpj);
    if (!resolved) return null;

    const cnaeInfo = classifyCnae(resolved.cnae_principal, resolved.descricao_atividade);

    return this.upsert({
      tenant_id: tenantId,
      company_id: companyId,
      cnpj: resolved.cnpj,
      cnae_principal: resolved.cnae_principal,
      cnaes_secundarios: resolved.cnaes_secundarios,
      descricao_atividade: resolved.descricao_atividade,
      source: 'brasilapi',
      raw_response: resolved.raw,
    }, cnaeInfo.grau_risco);
  },

  /**
   * Upsert CNAE profile for a company.
   */
  async upsert(dto: UpsertCNAEProfileDTO, grauRisco?: GrauRisco): Promise<CompanyCNAEProfile | null> {
    const cleaned = sanitizeCnpj(dto.cnpj);
    if (!isValidCnpj(cleaned)) return null;

    const grau = grauRisco ?? classifyCnae(dto.cnae_principal).grau_risco;

    const payload = {
      tenant_id: dto.tenant_id,
      company_id: dto.company_id,
      cnpj: cleaned,
      cnae_principal: dto.cnae_principal,
      cnaes_secundarios: dto.cnaes_secundarios ?? [],
      descricao_atividade: dto.descricao_atividade ?? '',
      grau_risco_sugerido: grau,
      source: dto.source ?? 'manual',
      raw_response: (dto.raw_response ?? null) as import('@/integrations/supabase/types').Json,
      resolved_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('company_cnae_profiles')
      .upsert([payload], { onConflict: 'tenant_id,company_id' })
      .select()
      .single();

    if (error) {
      console.error('[CNPJ Resolver] Upsert error:', error);
      throw error;
    }

    return data as CompanyCNAEProfile;
  },

  /**
   * Get existing CNAE profile for a company.
   */
  async getByCompany(companyId: string, scope: QueryScope): Promise<CompanyCNAEProfile | null> {
    const q = applyScope(
      supabase.from('company_cnae_profiles').select('*').eq('company_id', companyId),
      scope,
    );
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data as CompanyCNAEProfile | null;
  },

  /**
   * List all CNAE profiles for the scope.
   */
  async list(scope: QueryScope): Promise<CompanyCNAEProfile[]> {
    const q = applyScope(
      supabase.from('company_cnae_profiles').select('*'),
      scope,
    );
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as CompanyCNAEProfile[];
  },
};
