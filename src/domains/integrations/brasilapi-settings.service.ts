import { supabase } from '@/integrations/supabase/client';

const INTEGRATION_KEY = 'brasilapi';

export interface BrasilApiSettingsConfig {
  is_active: boolean;
  has_api_key: boolean;
  api_base_url: string;
  enable_cnpj: boolean;
  enable_cep: boolean;
  enable_cnae: boolean;
  cache_ttl_hours: number;
  docs_url: string;
}

interface SaveBrasilApiSettingsInput {
  tenantId: string;
  apiKey?: string;
  isActive: boolean;
  apiBaseUrl?: string;
  enableCnpj: boolean;
  enableCep: boolean;
  enableCnae: boolean;
  cacheTtlHours: number;
}

const DEFAULT_SETTINGS: BrasilApiSettingsConfig = {
  is_active: false,
  has_api_key: false,
  api_base_url: 'https://brasilapi.com.br/api',
  enable_cnpj: true,
  enable_cep: true,
  enable_cnae: true,
  cache_ttl_hours: 24,
  docs_url: 'https://brasilapi.com.br/docs',
};

function toConfig(
  config: Record<string, unknown> | null | undefined,
  isActiveFallback = false,
): BrasilApiSettingsConfig {
  const apiKey = typeof config?.api_key === 'string' ? config.api_key.trim() : '';
  const cacheTtlRaw = typeof config?.cache_ttl_hours === 'number'
    ? config.cache_ttl_hours
    : Number(config?.cache_ttl_hours ?? DEFAULT_SETTINGS.cache_ttl_hours);
  const cacheTtl = Number.isFinite(cacheTtlRaw) ? Math.min(Math.max(Math.trunc(cacheTtlRaw), 1), 168) : DEFAULT_SETTINGS.cache_ttl_hours;

  return {
    is_active: typeof config?.is_active === 'boolean' ? config.is_active : isActiveFallback,
    has_api_key: apiKey.length > 0,
    api_base_url: typeof config?.api_base_url === 'string' && config.api_base_url.trim()
      ? config.api_base_url.trim()
      : DEFAULT_SETTINGS.api_base_url,
    enable_cnpj: config?.enable_cnpj !== false,
    enable_cep: config?.enable_cep !== false,
    enable_cnae: config?.enable_cnae !== false,
    cache_ttl_hours: cacheTtl,
    docs_url: DEFAULT_SETTINGS.docs_url,
  };
}

export const brasilapiSettingsService = {
  async getSettings(tenantId: string): Promise<BrasilApiSettingsConfig> {
    const { data, error } = await supabase
      .from('tenant_integration_configs')
      .select('config, is_active')
      .eq('tenant_id', tenantId)
      .eq('integration_key', INTEGRATION_KEY)
      .maybeSingle();

    if (error) throw new Error(error.message || 'Falha ao carregar parâmetros da BrasilAPI.');

    const config = data?.config && typeof data.config === 'object'
      ? data.config as Record<string, unknown>
      : null;

    return toConfig(config, data?.is_active ?? false);
  },

  async saveSettings(input: SaveBrasilApiSettingsInput): Promise<BrasilApiSettingsConfig> {
    const trimmedApiKey = input.apiKey?.trim() ?? '';

    const { data: existing, error: fetchError } = await supabase
      .from('tenant_integration_configs')
      .select('id, config')
      .eq('tenant_id', input.tenantId)
      .eq('integration_key', INTEGRATION_KEY)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message || 'Falha ao localizar configuração da BrasilAPI.');

    const currentConfig = existing?.config && typeof existing.config === 'object'
      ? existing.config as Record<string, unknown>
      : {};

    const nextConfig: Record<string, unknown> = {
      ...currentConfig,
      is_active: input.isActive,
      api_base_url: input.apiBaseUrl?.trim() || DEFAULT_SETTINGS.api_base_url,
      enable_cnpj: input.enableCnpj,
      enable_cep: input.enableCep,
      enable_cnae: input.enableCnae,
      cache_ttl_hours: Math.min(Math.max(Math.trunc(input.cacheTtlHours), 1), 168),
      updated_at: new Date().toISOString(),
    };

    if (trimmedApiKey) {
      nextConfig.api_key = trimmedApiKey;
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from('tenant_integration_configs')
        .update({ config: nextConfig as any, is_active: input.isActive })
        .eq('id', existing.id);
      if (updateError) throw new Error(updateError.message || 'Falha ao atualizar configuração da BrasilAPI.');
    } else {
      const { error: insertError } = await supabase
        .from('tenant_integration_configs')
        .insert({
          tenant_id: input.tenantId,
          integration_key: INTEGRATION_KEY,
          config: nextConfig as any,
          is_active: input.isActive,
        });
      if (insertError) throw new Error(insertError.message || 'Falha ao criar configuração da BrasilAPI.');
    }

    return toConfig(nextConfig, input.isActive);
  },

  async testConnection(tenantId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('brasilapi-proxy', {
        body: { action: 'test_connection', tenant_id: tenantId },
      });
      if (error) return { success: false, message: error.message };
      if (data?.error) return { success: false, message: data.error };
      return { success: true, message: 'Conexão realizada com sucesso.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro ao testar conexão.' };
    }
  },
};
