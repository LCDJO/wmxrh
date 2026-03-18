/**
 * External Data Service — Frontend API layer
 *
 * Calls the `external-data-resolver` edge function for:
 *   1. Receita Federal CNPJ resolution (server-side, admin only)
 *   2. SERPRO CPF resolution for admission flows
 *   3. IBGE CNAE catalog lookup
 *   4. NR version updates check
 */

import { supabase } from '@/integrations/supabase/client';

export interface ExternalCnpjResult {
  cnpj: string;
  cnae_principal: string;
  cnaes_secundarios: string[];
  descricao_atividade: string;
  razao_social: string | null;
  situacao_cadastral: string | null;
  uf: string | null;
  municipio: string | null;
  source: 'receita_federal' | 'brasilapi';
  resolved_at: string;
}

export interface ExternalCpfResult {
  cpf: string;
  nome: string | null;
  data_nascimento: string | null;
  situacao_cadastral: string | null;
  source: 'serpro';
  resolved_at: string;
}

export interface CpfIntegrationConfig {
  provider: 'serpro';
  is_active: boolean;
  has_consumer_key: boolean;
  has_consumer_secret: boolean;
  api_base_url: string;
  endpoint_path_template: string;
  docs_url: string;
}

export class CpfLookupDisabledError extends Error {
  readonly code = 'CPF_LOOKUP_DISABLED';

  constructor(message = 'Integração de CPF desativada.') {
    super(message);
    this.name = 'CpfLookupDisabledError';
  }
}

export interface CnaeDivision {
  id: string;
  descricao: string;
}

export interface NrVersionInfo {
  nr_versions: Record<number, { version: string; last_update: string }>;
  last_checked: string;
  source: string;
  note: string;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('external-data-resolver', {
    body,
  });
  if (error) throw new Error(error.message ?? 'Edge function error');
  if (data?.error) throw new Error(data.error);
  return data.data as T;
}

export const externalDataService = {
  /**
   * Resolve CNPJ via server-side (Receita Federal → BrasilAPI fallback).
   * Requires tenant_admin role.
   */
  async resolveCnpj(
    cnpj: string,
    tenantId?: string,
    companyId?: string,
  ): Promise<ExternalCnpjResult> {
    return invoke<ExternalCnpjResult>({
      action: 'resolve_cnpj',
      cnpj,
      tenant_id: tenantId,
      company_id: companyId,
    });
  },

  /**
   * Resolve CPF via configured SERPRO integration.
   */
  async resolveCpf(cpf: string, tenantId: string): Promise<ExternalCpfResult> {
    return invoke<ExternalCpfResult>({
      action: 'resolve_cpf',
      cpf,
      tenant_id: tenantId,
    });
  },

  /**
   * Read tenant CPF integration configuration without exposing secrets.
   */
  async getCpfConfig(tenantId: string): Promise<CpfIntegrationConfig> {
    return invoke<CpfIntegrationConfig>({
      action: 'get_cpf_config',
      tenant_id: tenantId,
    });
  },

  /**
   * Save tenant CPF integration configuration.
   */
  async saveCpfConfig(input: {
    tenantId: string;
    consumerKey?: string;
    consumerSecret?: string;
    apiBaseUrl?: string;
    endpointPathTemplate?: string;
    isActive: boolean;
  }): Promise<CpfIntegrationConfig> {
    return invoke<CpfIntegrationConfig>({
      action: 'save_cpf_config',
      tenant_id: input.tenantId,
      consumer_key: input.consumerKey,
      consumer_secret: input.consumerSecret,
      api_base_url: input.apiBaseUrl,
      endpoint_path_template: input.endpointPathTemplate,
      is_active: input.isActive,
    });
  },

  /**
   * Lookup CNAE from IBGE catalog by code.
   */
  async lookupCnae(cnaeCode: string): Promise<CnaeDivision[]> {
    return invoke<CnaeDivision[]>({
      action: 'lookup_cnae',
      cnae_code: cnaeCode,
    });
  },

  /**
   * Search CNAE by description in IBGE catalog.
   */
  async searchCnae(search: string): Promise<CnaeDivision[]> {
    return invoke<CnaeDivision[]>({
      action: 'lookup_cnae',
      search,
    });
  },

  /**
   * Check for NR version updates.
   */
  async checkNrUpdates(): Promise<NrVersionInfo> {
    return invoke<NrVersionInfo>({
      action: 'check_nr_updates',
    });
  },
};