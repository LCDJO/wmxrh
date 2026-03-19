import { supabase } from '@/integrations/supabase/client';

const ESOCIAL_INTEGRATION_KEY = 'esocial';
export const ESOCIAL_DOCS_URL = 'https://www.gov.br/esocial/pt-br/documentacao-tecnica';

export type ESocialEnvironment = 'sandbox' | 'production';
export type ESocialSendMode = 'manual' | 'auto';

export interface ESocialValidationFlags {
  validate_cpf: boolean;
  validate_cnpj: boolean;
  apply_rules: boolean;
  block_on_error: boolean;
}

export interface ESocialSettingsConfig {
  is_active: boolean;
  has_api_key: boolean;
  docs_url: string;
  environment: ESocialEnvironment;
  employer_cnpj: string;
  employer_name: string;
  cnae: string;
  tax_classification: string;
  send_mode: ESocialSendMode;
  retry_limit: number;
  validation_flags: ESocialValidationFlags;
}

export interface ESocialCertificateSummary {
  id: string;
  certificate_path: string;
  expires_at: string;
  is_active: boolean;
  updated_at: string;
}

export interface ESocialRecentLog {
  id: string;
  action: string;
  description: string | null;
  created_at: string;
}

interface SaveESocialSettingsInput {
  tenantId: string;
  apiKey?: string;
  isActive: boolean;
  environment: ESocialEnvironment;
  employerCnpj: string;
  employerName: string;
  cnae: string;
  taxClassification: string;
  sendMode: ESocialSendMode;
  retryLimit: number;
  validationFlags: ESocialValidationFlags;
}

const DEFAULT_VALIDATION_FLAGS: ESocialValidationFlags = {
  validate_cpf: true,
  validate_cnpj: true,
  apply_rules: true,
  block_on_error: true,
};

const DEFAULT_SETTINGS: ESocialSettingsConfig = {
  is_active: false,
  has_api_key: false,
  docs_url: ESOCIAL_DOCS_URL,
  environment: 'sandbox',
  employer_cnpj: '',
  employer_name: '',
  cnae: '',
  tax_classification: '',
  send_mode: 'manual',
  retry_limit: 5,
  validation_flags: DEFAULT_VALIDATION_FLAGS,
};

function sanitizeDigits(value: unknown, maxLength?: number): string {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  return typeof maxLength === 'number' ? digits.slice(0, maxLength) : digits;
}

function sanitizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeValidationFlags(value: unknown): ESocialValidationFlags {
  if (!value || typeof value !== 'object') return { ...DEFAULT_VALIDATION_FLAGS };

  const flags = value as Record<string, unknown>;

  return {
    validate_cpf: flags.validate_cpf !== false,
    validate_cnpj: flags.validate_cnpj !== false,
    apply_rules: flags.apply_rules !== false,
    block_on_error: flags.block_on_error !== false,
  };
}

function toSettingsConfig(config: Record<string, unknown> | null | undefined, isActiveFallback = false): ESocialSettingsConfig {
  const apiKey = typeof config?.api_key === 'string' ? config.api_key.trim() : '';
  const environment = config?.environment === 'production' ? 'production' : 'sandbox';
  const sendMode = config?.send_mode === 'auto' ? 'auto' : 'manual';
  const retryLimitRaw = typeof config?.retry_limit === 'number' ? config.retry_limit : Number(config?.retry_limit ?? DEFAULT_SETTINGS.retry_limit);
  const retryLimit = Number.isFinite(retryLimitRaw) ? Math.min(Math.max(Math.trunc(retryLimitRaw), 1), 10) : DEFAULT_SETTINGS.retry_limit;

  return {
    is_active: typeof config?.is_active === 'boolean' ? config.is_active : isActiveFallback,
    has_api_key: apiKey.length > 0,
    docs_url: ESOCIAL_DOCS_URL,
    environment,
    employer_cnpj: sanitizeDigits(config?.employer_cnpj, 14),
    employer_name: sanitizeText(config?.employer_name, 160),
    cnae: sanitizeDigits(config?.cnae, 7),
    tax_classification: sanitizeText(config?.tax_classification, 80),
    send_mode: sendMode,
    retry_limit: retryLimit,
    validation_flags: normalizeValidationFlags(config?.validation_flags),
  };
}

export const esocialSettingsService = {
  async getSettings(tenantId: string): Promise<ESocialSettingsConfig> {
    const { data, error } = await supabase
      .from('tenant_integration_configs')
      .select('config, is_active')
      .eq('tenant_id', tenantId)
      .eq('integration_key', ESOCIAL_INTEGRATION_KEY)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Falha ao carregar parâmetros do eSocial.');
    }

    const config = data?.config && typeof data.config === 'object'
      ? data.config as Record<string, unknown>
      : null;

    return toSettingsConfig(config, data?.is_active ?? false);
  },

  async saveSettings(input: SaveESocialSettingsInput): Promise<ESocialSettingsConfig> {
    const trimmedApiKey = input.apiKey?.trim() ?? '';

    const { data: existing, error: fetchError } = await supabase
      .from('tenant_integration_configs')
      .select('id, config')
      .eq('tenant_id', input.tenantId)
      .eq('integration_key', ESOCIAL_INTEGRATION_KEY)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message || 'Falha ao localizar configuração do eSocial.');
    }

    const currentConfig = existing?.config && typeof existing.config === 'object'
      ? existing.config as Record<string, unknown>
      : {};

    const nextConfig: Record<string, unknown> = {
      ...currentConfig,
      is_active: input.isActive,
      environment: input.environment,
      employer_cnpj: sanitizeDigits(input.employerCnpj, 14),
      employer_name: sanitizeText(input.employerName, 160),
      cnae: sanitizeDigits(input.cnae, 7),
      tax_classification: sanitizeText(input.taxClassification, 80),
      send_mode: input.sendMode,
      retry_limit: Math.min(Math.max(Math.trunc(input.retryLimit), 1), 10),
      validation_flags: normalizeValidationFlags(input.validationFlags),
      updated_at: new Date().toISOString(),
    };

    if (trimmedApiKey) {
      nextConfig.api_key = trimmedApiKey;
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from('tenant_integration_configs')
        .update({
          config: nextConfig as any,
          is_active: input.isActive,
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(updateError.message || 'Falha ao atualizar configuração do eSocial.');
      }
    } else {
      const { error: insertError } = await supabase
        .from('tenant_integration_configs')
        .insert({
          tenant_id: input.tenantId,
          integration_key: ESOCIAL_INTEGRATION_KEY,
          config: nextConfig as any,
          is_active: input.isActive,
        });

      if (insertError) {
        throw new Error(insertError.message || 'Falha ao criar configuração do eSocial.');
      }
    }

    return toSettingsConfig(nextConfig, input.isActive);
  },

  async getCertificateSummary(tenantId: string): Promise<ESocialCertificateSummary | null> {
    const { data, error } = await supabase
      .from('esocial_certificates')
      .select('id, certificate_path, expires_at, is_active, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || 'Falha ao carregar certificado do eSocial.');
    }

    return data ?? null;
  },

  async getRecentLogs(tenantId: string): Promise<ESocialRecentLog[]> {
    const { data, error } = await supabase
      .from('esocial_event_logs')
      .select('id, action, description, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) {
      throw new Error(error.message || 'Falha ao carregar logs do eSocial.');
    }

    return data ?? [];
  },
};
