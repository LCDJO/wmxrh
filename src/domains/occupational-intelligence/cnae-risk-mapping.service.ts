/**
 * CNAE → Risk Mapping Service
 *
 * Persists and queries CNAE risk mappings. Supports tenant-level
 * custom overrides over the built-in static classifier.
 */

import { supabase } from '@/integrations/supabase/client';
import type { QueryScope } from '@/domains/shared/scoped-query';
import { applyScope } from '@/domains/shared/scoped-query';
import { classifyCnae, mapRiskCategories, parseCnaeDivision } from './cnae-risk-classifier';
import { getApplicableNrs } from './nr-training-mapper';
import type { GrauRisco } from './types';
import type { Json } from '@/integrations/supabase/types';

// ─── Types ───

export interface CnaeRiskMapping {
  id: string;
  tenant_id: string;
  cnae_codigo: string;
  grau_risco: number;
  ambiente: string;
  exige_pgr: boolean;
  agentes_risco_provaveis: string[];
  nrs_aplicaveis: number[];
  description: string | null;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiskProfile {
  grau_risco: GrauRisco;
  agentes_risco_provaveis: string[];
  nrs_aplicaveis: number[];
  ambiente: string;
  exige_pgr: boolean;
}

export interface UpsertCnaeRiskMappingDTO {
  tenant_id: string;
  cnae_codigo: string;
  grau_risco?: number;
  ambiente?: string;
  exige_pgr?: boolean;
  agentes_risco_provaveis?: string[];
  nrs_aplicaveis?: number[];
  description?: string | null;
  is_custom?: boolean;
}

// ─── Ambiente detection ───

const CNAE_AMBIENTE_MAP: Record<string, string> = {
  '01': 'agro', '02': 'agro', '03': 'agro',
  '05': 'mineracao', '06': 'mineracao', '07': 'mineracao', '08': 'mineracao',
  '10': 'industrial', '11': 'industrial', '12': 'industrial', '13': 'industrial',
  '14': 'industrial', '15': 'industrial', '16': 'industrial', '17': 'industrial',
  '18': 'industrial', '19': 'industrial', '20': 'industrial', '21': 'industrial',
  '22': 'industrial', '23': 'industrial', '24': 'industrial', '25': 'industrial',
  '26': 'industrial', '27': 'industrial', '28': 'industrial', '29': 'industrial',
  '30': 'industrial', '31': 'industrial', '32': 'industrial', '33': 'industrial',
  '35': 'energia', '36': 'saneamento', '37': 'saneamento', '38': 'saneamento',
  '41': 'construcao', '42': 'construcao', '43': 'construcao',
  '45': 'comercio', '46': 'comercio', '47': 'comercio',
  '49': 'transporte', '50': 'transporte', '51': 'transporte', '52': 'logistica', '53': 'logistica',
  '55': 'hotelaria', '56': 'alimentacao',
  '58': 'administrativo', '59': 'administrativo', '60': 'telecom',
  '61': 'telecom', '62': 'administrativo', '63': 'administrativo',
  '64': 'administrativo', '65': 'administrativo', '66': 'administrativo',
  '68': 'administrativo', '69': 'administrativo', '70': 'administrativo',
  '71': 'engenharia', '72': 'administrativo', '73': 'administrativo',
  '80': 'seguranca', '81': 'limpeza', '82': 'administrativo',
  '84': 'administrativo', '85': 'educacao',
  '86': 'saude', '87': 'saude', '88': 'saude',
  '90': 'cultura', '91': 'cultura', '92': 'cultura', '93': 'cultura',
};

function detectAmbiente(cnaeDivision: string): string {
  return CNAE_AMBIENTE_MAP[cnaeDivision] ?? 'administrativo';
}

// ─── Service ───

export const cnaeRiskMappingService = {

  /**
   * Build a RiskProfile from CNAE code using static engine + optional DB override.
   */
  async getRiskProfile(cnaeCode: string, scope: QueryScope): Promise<RiskProfile> {
    // Check for tenant-level custom override first
    const custom = await this.getByCode(cnaeCode, scope);
    if (custom) {
      return {
        grau_risco: custom.grau_risco as GrauRisco,
        agentes_risco_provaveis: custom.agentes_risco_provaveis,
        nrs_aplicaveis: custom.nrs_aplicaveis,
        ambiente: custom.ambiente,
        exige_pgr: custom.exige_pgr,
      };
    }

    // Fallback to static classifier
    const cnaeInfo = classifyCnae(cnaeCode);
    const division = parseCnaeDivision(cnaeCode);
    const riskCategories = mapRiskCategories(cnaeInfo.grau_risco);
    const applicableNrs = getApplicableNrs(cnaeInfo.grau_risco);

    const agentes = riskCategories.flatMap(rc => rc.typical_agents);
    const nrs = [...new Set(applicableNrs.map(nr => nr.nr_number))].sort((a, b) => a - b);

    return {
      grau_risco: cnaeInfo.grau_risco,
      agentes_risco_provaveis: agentes,
      nrs_aplicaveis: nrs,
      ambiente: detectAmbiente(division),
      exige_pgr: true, // NR-1: obrigatório para todos
    };
  },

  /**
   * Build and persist a risk mapping from CNAE code.
   */
  async resolveAndPersist(tenantId: string, cnaeCode: string): Promise<CnaeRiskMapping> {
    const cnaeInfo = classifyCnae(cnaeCode);
    const division = parseCnaeDivision(cnaeCode);
    const riskCategories = mapRiskCategories(cnaeInfo.grau_risco);
    const applicableNrs = getApplicableNrs(cnaeInfo.grau_risco);

    return this.upsert({
      tenant_id: tenantId,
      cnae_codigo: cnaeCode,
      grau_risco: cnaeInfo.grau_risco,
      ambiente: detectAmbiente(division),
      exige_pgr: true,
      agentes_risco_provaveis: riskCategories.flatMap(rc => rc.typical_agents),
      nrs_aplicaveis: [...new Set(applicableNrs.map(nr => nr.nr_number))].sort((a, b) => a - b),
      description: cnaeInfo.description,
      is_custom: false,
    });
  },

  async getByCode(cnaeCode: string, scope: QueryScope): Promise<CnaeRiskMapping | null> {
    const q = applyScope(
      supabase.from('cnae_risk_mappings').select('*').eq('cnae_codigo', cnaeCode),
      scope,
    );
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data as CnaeRiskMapping | null;
  },

  async list(scope: QueryScope): Promise<CnaeRiskMapping[]> {
    const q = applyScope(
      supabase.from('cnae_risk_mappings').select('*').order('cnae_codigo'),
      scope,
    );
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as CnaeRiskMapping[];
  },

  async upsert(dto: UpsertCnaeRiskMappingDTO): Promise<CnaeRiskMapping> {
    const cnaeInfo = classifyCnae(dto.cnae_codigo);
    const division = parseCnaeDivision(dto.cnae_codigo);

    const payload = {
      tenant_id: dto.tenant_id,
      cnae_codigo: dto.cnae_codigo,
      grau_risco: dto.grau_risco ?? cnaeInfo.grau_risco,
      ambiente: dto.ambiente ?? detectAmbiente(division),
      exige_pgr: dto.exige_pgr ?? true,
      agentes_risco_provaveis: dto.agentes_risco_provaveis ?? [],
      nrs_aplicaveis: dto.nrs_aplicaveis ?? [],
      description: dto.description ?? null,
      is_custom: dto.is_custom ?? false,
    };

    const { data, error } = await supabase
      .from('cnae_risk_mappings')
      .upsert([payload], { onConflict: 'tenant_id,cnae_codigo' })
      .select()
      .single();

    if (error) throw error;
    return data as CnaeRiskMapping;
  },
};
