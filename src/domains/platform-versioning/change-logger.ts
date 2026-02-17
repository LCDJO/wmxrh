/**
 * ChangeLogger — DB-backed immutable audit log for platform/module changes.
 */
import { supabase } from '@/integrations/supabase/client';
import type { PlatformChangeLog, ChangeType, ChangeLogEntry, ChangeCategory } from './types';

function rowToChangeLog(row: Record<string, any>): PlatformChangeLog {
  return {
    id: row.id,
    module_id: row.module_id ?? undefined,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    change_type: row.change_type as ChangeType,
    version_tag: row.version_tag,
    payload_diff: row.payload_diff ?? {},
    changed_by: row.changed_by,
    changed_at: row.changed_at,
  };
}

function rowToLegacy(row: Record<string, any>): ChangeLogEntry {
  return {
    id: row.id,
    category: (row.category ?? 'feature') as ChangeCategory,
    scope: (row.scope ?? 'platform') as 'platform' | 'module',
    scope_key: row.scope_key ?? undefined,
    title: row.title ?? '',
    description: row.description ?? '',
    author: row.author ?? row.changed_by ?? '',
    linked_version_id: row.linked_version_id ?? undefined,
    linked_release_id: row.linked_release_id ?? undefined,
    tags: row.tags ?? [],
    created_at: row.changed_at,
  };
}

export class ChangeLogger {
  // ── Primary API (PlatformChangeLog) ──

  async log(opts: {
    module_id?: string;
    entity_type: string;
    entity_id: string;
    change_type: ChangeType;
    version_tag: string;
    payload_diff: Record<string, unknown>;
    changed_by: string;
  }): Promise<PlatformChangeLog> {
    const { data, error } = await (supabase.from('platform_changelogs') as any)
      .insert({
        module_id: opts.module_id ?? null,
        entity_type: opts.entity_type,
        entity_id: opts.entity_id,
        change_type: opts.change_type,
        version_tag: opts.version_tag,
        payload_diff: opts.payload_diff,
        changed_by: opts.changed_by,
      })
      .select()
      .single();
    if (error) throw new Error(`ChangeLogger.log: ${error.message}`);
    return rowToChangeLog(data);
  }

  async getAll(): Promise<PlatformChangeLog[]> {
    const { data } = await (supabase.from('platform_changelogs') as any)
      .select('*')
      .order('changed_at', { ascending: false });
    return (data ?? []).map(rowToChangeLog);
  }

  async getByModule(moduleId: string): Promise<PlatformChangeLog[]> {
    const { data } = await (supabase.from('platform_changelogs') as any)
      .select('*')
      .eq('module_id', moduleId)
      .order('changed_at', { ascending: false });
    return (data ?? []).map(rowToChangeLog);
  }

  async getByEntity(entityType: string, entityId?: string): Promise<PlatformChangeLog[]> {
    let q = (supabase.from('platform_changelogs') as any).select('*').eq('entity_type', entityType);
    if (entityId) q = q.eq('entity_id', entityId);
    const { data } = await q.order('changed_at', { ascending: false });
    return (data ?? []).map(rowToChangeLog);
  }

  async getByChangeType(changeType: ChangeType): Promise<PlatformChangeLog[]> {
    const { data } = await (supabase.from('platform_changelogs') as any)
      .select('*')
      .eq('change_type', changeType)
      .order('changed_at', { ascending: false });
    return (data ?? []).map(rowToChangeLog);
  }

  async getByVersionTag(versionTag: string): Promise<PlatformChangeLog[]> {
    const { data } = await (supabase.from('platform_changelogs') as any)
      .select('*')
      .eq('version_tag', versionTag)
      .order('changed_at', { ascending: false });
    return (data ?? []).map(rowToChangeLog);
  }

  async getPlatformLevel(): Promise<PlatformChangeLog[]> {
    const { data } = await (supabase.from('platform_changelogs') as any)
      .select('*')
      .is('module_id', null)
      .order('changed_at', { ascending: false });
    return (data ?? []).map(rowToChangeLog);
  }

  async search(query: string): Promise<PlatformChangeLog[]> {
    // Simple text search via ilike on entity_type + entity_id
    const { data } = await (supabase.from('platform_changelogs') as any)
      .select('*')
      .or(`entity_type.ilike.%${query}%,entity_id.ilike.%${query}%,module_id.ilike.%${query}%`)
      .order('changed_at', { ascending: false });
    return (data ?? []).map(rowToChangeLog);
  }

  // ── Legacy API (ChangeLogEntry) ──

  async logLegacy(opts: {
    category: ChangeCategory;
    scope: 'platform' | 'module';
    scope_key?: string;
    title: string;
    description: string;
    author: string;
    linked_version_id?: string;
    linked_release_id?: string;
    tags?: string[];
  }): Promise<ChangeLogEntry> {
    const { data, error } = await (supabase.from('platform_changelogs') as any)
      .insert({
        entity_type: opts.scope === 'module' ? (opts.scope_key ?? 'module') : 'platform',
        entity_id: opts.scope_key ?? 'platform',
        change_type: 'created',
        version_tag: '',
        payload_diff: {},
        changed_by: opts.author,
        category: opts.category,
        scope: opts.scope,
        scope_key: opts.scope_key ?? null,
        title: opts.title,
        description: opts.description,
        author: opts.author,
        linked_version_id: opts.linked_version_id ?? null,
        linked_release_id: opts.linked_release_id ?? null,
        tags: opts.tags ?? [],
      })
      .select()
      .single();
    if (error) throw new Error(`ChangeLogger.logLegacy: ${error.message}`);
    return rowToLegacy(data);
  }

  async getLegacyAll(): Promise<ChangeLogEntry[]> {
    const { data } = await (supabase.from('platform_changelogs') as any)
      .select('*')
      .not('category', 'is', null)
      .order('changed_at', { ascending: false });
    return (data ?? []).map(rowToLegacy);
  }

  async getByVersion(versionId: string): Promise<ChangeLogEntry[]> {
    const { data } = await (supabase.from('platform_changelogs') as any)
      .select('*')
      .eq('linked_version_id', versionId)
      .order('changed_at', { ascending: false });
    return (data ?? []).map(rowToLegacy);
  }

  async getByRelease(releaseId: string): Promise<ChangeLogEntry[]> {
    const { data } = await (supabase.from('platform_changelogs') as any)
      .select('*')
      .eq('linked_release_id', releaseId)
      .order('changed_at', { ascending: false });
    return (data ?? []).map(rowToLegacy);
  }

  async getByCategory(category: ChangeCategory): Promise<ChangeLogEntry[]> {
    const { data } = await (supabase.from('platform_changelogs') as any)
      .select('*')
      .eq('category', category)
      .order('changed_at', { ascending: false });
    return (data ?? []).map(rowToLegacy);
  }

  async getByScope(scope: 'platform' | 'module', scopeKey?: string): Promise<ChangeLogEntry[]> {
    let q = (supabase.from('platform_changelogs') as any).select('*').eq('scope', scope);
    if (scopeKey) q = q.eq('scope_key', scopeKey);
    const { data } = await q.order('changed_at', { ascending: false });
    return (data ?? []).map(rowToLegacy);
  }
}
