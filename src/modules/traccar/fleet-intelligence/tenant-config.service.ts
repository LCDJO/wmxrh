/**
 * TenantTraccarConfigService — CRUD de configuração Traccar por tenant.
 *
 * Gerencia endpoint, credenciais, protocolo e parâmetros de sync.
 */
import { supabase } from '@/integrations/supabase/client';
import type { TraccarProtocol } from '@/layers/tenant/traccar-config.types';

export interface TenantTraccarConfigRow {
  id: string;
  tenant_id: string;
  integration_key: string;
  config: {
    api_url: string;
    api_token: string;
    webhook_secret: string;
    protocol: TraccarProtocol;
    sync_interval_min: number;
    auto_sync: boolean;
    is_active: boolean;
    google_maps_api_key: string;
  };
  created_at: string;
  updated_at: string;
}

export interface SaveTenantTraccarConfigDTO {
  api_url: string;
  api_token: string;
  webhook_secret?: string;
  protocol?: TraccarProtocol;
  sync_interval_min?: number;
  auto_sync?: boolean;
  is_active?: boolean;
  google_maps_api_key?: string;
}

/**
 * Busca a configuração Traccar do tenant.
 */
export async function getTenantTraccarConfig(
  tenantId: string
): Promise<TenantTraccarConfigRow | null> {
  const { data, error } = await supabase
    .from('tenant_integration_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('integration_key', 'traccar')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as unknown as TenantTraccarConfigRow | null;
}

/**
 * Salva (upsert) a configuração Traccar do tenant.
 */
export async function saveTenantTraccarConfig(
  tenantId: string,
  config: SaveTenantTraccarConfigDTO
): Promise<void> {
  const { data: existing } = await supabase
    .from('tenant_integration_configs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('integration_key', 'traccar')
    .maybeSingle();

  const configPayload = {
    api_url: config.api_url,
    api_token: config.api_token,
    webhook_secret: config.webhook_secret ?? '',
    protocol: config.protocol ?? 'osmand',
    sync_interval_min: config.sync_interval_min ?? 5,
    auto_sync: config.auto_sync !== false,
    is_active: config.is_active !== false,
    google_maps_api_key: config.google_maps_api_key ?? '',
  };

  if (existing) {
    const { error } = await supabase
      .from('tenant_integration_configs')
      .update({ config: configPayload as any, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('tenant_integration_configs')
      .insert({
        tenant_id: tenantId,
        integration_key: 'traccar',
        config: configPayload as any,
      });
    if (error) throw new Error(error.message);
  }
}

/**
 * Desativa a integração Traccar do tenant.
 */
export async function deactivateTenantTraccar(tenantId: string): Promise<void> {
  const existing = await getTenantTraccarConfig(tenantId);
  if (!existing) return;

  const { error } = await supabase
    .from('tenant_integration_configs')
    .update({
      config: { ...existing.config, is_active: false } as any,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (error) throw new Error(error.message);
}
