/**
 * SupportModuleVersion — Layer-specific version tracking for support_module.
 *
 * Links to a ModuleVersion and adds UI schema snapshots + feature flags
 * for both the Tenant App and Platform Console layers.
 */
import { supabase } from '@/integrations/supabase/client';

export interface SupportModuleVersion {
  id: string;
  module_id: string;
  module_version_id: string | null;
  tenant_ui_schema: Record<string, unknown>;
  platform_ui_schema: Record<string, unknown>;
  feature_flags: Record<string, boolean | string | number>;
  released_at: string | null;
  created_at: string;
  created_by: string | null;
}

function rowToSupportModuleVersion(row: Record<string, any>): SupportModuleVersion {
  return {
    id: row.id,
    module_id: row.module_id,
    module_version_id: row.module_version_id ?? null,
    tenant_ui_schema: row.tenant_ui_schema ?? {},
    platform_ui_schema: row.platform_ui_schema ?? {},
    feature_flags: row.feature_flags ?? {},
    released_at: row.released_at ?? null,
    created_at: row.created_at,
    created_by: row.created_by ?? null,
  };
}

export class SupportModuleVersionRegistry {
  async create(opts: {
    module_version_id?: string;
    tenant_ui_schema?: Record<string, unknown>;
    platform_ui_schema?: Record<string, unknown>;
    feature_flags?: Record<string, boolean | string | number>;
    created_by?: string;
  }): Promise<SupportModuleVersion> {
    const { data, error } = await (supabase.from('support_module_versions') as any)
      .insert({
        module_id: 'support_module',
        module_version_id: opts.module_version_id ?? null,
        tenant_ui_schema: opts.tenant_ui_schema ?? {},
        platform_ui_schema: opts.platform_ui_schema ?? {},
        feature_flags: opts.feature_flags ?? {},
        created_by: opts.created_by ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(`SupportModuleVersionRegistry.create: ${error.message}`);
    return rowToSupportModuleVersion(data);
  }

  async release(id: string): Promise<SupportModuleVersion | null> {
    const { data } = await (supabase.from('support_module_versions') as any)
      .update({ released_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return data ? rowToSupportModuleVersion(data) : null;
  }

  async getById(id: string): Promise<SupportModuleVersion | null> {
    const { data } = await (supabase.from('support_module_versions') as any)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return data ? rowToSupportModuleVersion(data) : null;
  }

  async getCurrent(): Promise<SupportModuleVersion | null> {
    const { data } = await (supabase.from('support_module_versions') as any)
      .select('*')
      .eq('module_id', 'support_module')
      .not('released_at', 'is', null)
      .order('released_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? rowToSupportModuleVersion(data) : null;
  }

  async listAll(): Promise<SupportModuleVersion[]> {
    const { data } = await (supabase.from('support_module_versions') as any)
      .select('*')
      .eq('module_id', 'support_module')
      .order('created_at', { ascending: false });
    return (data ?? []).map(rowToSupportModuleVersion);
  }
}
