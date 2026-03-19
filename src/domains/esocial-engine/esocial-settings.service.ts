import { supabase } from '@/integrations/supabase/client';

const ESOCIAL_INTEGRATION_KEY = 'esocial';
export const ESOCIAL_DOCS_URL = 'https://www.gov.br/esocial/pt-br/documentacao-tecnica';

export interface ESocialSettingsConfig {
  is_active: boolean;
  has_api_key: boolean;
  docs_url: string;
}

interface SaveESocialSettingsInput {
  tenantId: string;
  apiKey?: string;
  isActive: boolean;
}

function toSettingsConfig(config: Record<string, unknown> | null | undefined, isActiveFallback = false): ESocialSettingsConfig {
  const apiKey = typeof config?.api_key === 'string' ? config.api_key.trim() : '';
  const isActive = typeof config?.is_active === 'boolean' ? config.is_active : isActiveFallback;

  return {
    is_active: isActive,
    has_api_key: apiKey.length > 0,
    docs_url: ESOCIAL_DOCS_URL,
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

  async saveSettings({ tenantId, apiKey, isActive }: SaveESocialSettingsInput): Promise<ESocialSettingsConfig> {
    const trimmedApiKey = apiKey?.trim() ?? '';

    const { data: existing, error: fetchError } = await supabase
      .from('tenant_integration_configs')
      .select('id, config')
      .eq('tenant_id', tenantId)
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
      is_active: isActive,
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
          is_active: isActive,
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(updateError.message || 'Falha ao atualizar configuração do eSocial.');
      }
    } else {
      const { error: insertError } = await supabase
        .from('tenant_integration_configs')
        .insert({
          tenant_id: tenantId,
          integration_key: ESOCIAL_INTEGRATION_KEY,
          config: nextConfig as any,
          is_active: isActive,
        });

      if (insertError) {
        throw new Error(insertError.message || 'Falha ao criar configuração do eSocial.');
      }
    }

    return toSettingsConfig(nextConfig, isActive);
  },
};
