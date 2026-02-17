/**
 * FeatureChangeTracker — DB-backed feature-level mutation log.
 */
import { supabase } from '@/integrations/supabase/client';
import type { FeatureChange } from './types';

function rowToChange(row: Record<string, any>): FeatureChange {
  return {
    id: row.id,
    feature_key: row.feature_key,
    change_type: row.change_type as FeatureChange['change_type'],
    previous_state: row.previous_state ?? undefined,
    new_state: row.new_state ?? {},
    module_key: row.module_key ?? undefined,
    version_id: row.version_id ?? undefined,
    author: row.author,
    created_at: row.created_at,
  };
}

export class FeatureChangeTracker {
  async track(opts: {
    feature_key: string;
    change_type: FeatureChange['change_type'];
    previous_state?: Record<string, unknown>;
    new_state: Record<string, unknown>;
    module_key?: string;
    version_id?: string;
    author: string;
  }): Promise<FeatureChange> {
    const { data, error } = await (supabase.from('feature_changes') as any)
      .insert({
        feature_key: opts.feature_key,
        change_type: opts.change_type,
        previous_state: opts.previous_state ?? null,
        new_state: opts.new_state,
        module_key: opts.module_key ?? null,
        version_id: opts.version_id ?? null,
        author: opts.author,
      })
      .select()
      .single();
    if (error) throw new Error(`FeatureChangeTracker.track: ${error.message}`);
    return rowToChange(data);
  }

  async getByFeature(featureKey: string): Promise<FeatureChange[]> {
    const { data } = await (supabase.from('feature_changes') as any)
      .select('*')
      .eq('feature_key', featureKey)
      .order('created_at', { ascending: false });
    return (data ?? []).map(rowToChange);
  }

  async getByModule(moduleKey: string): Promise<FeatureChange[]> {
    const { data } = await (supabase.from('feature_changes') as any)
      .select('*')
      .eq('module_key', moduleKey)
      .order('created_at', { ascending: false });
    return (data ?? []).map(rowToChange);
  }

  async getByVersion(versionId: string): Promise<FeatureChange[]> {
    const { data } = await (supabase.from('feature_changes') as any)
      .select('*')
      .eq('version_id', versionId)
      .order('created_at', { ascending: false });
    return (data ?? []).map(rowToChange);
  }

  async getAll(): Promise<FeatureChange[]> {
    const { data } = await (supabase.from('feature_changes') as any)
      .select('*')
      .order('created_at', { ascending: false });
    return (data ?? []).map(rowToChange);
  }
}
