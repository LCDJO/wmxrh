/**
 * PlatformVersionRegistry — DB-backed platform version history.
 */
import { supabase } from '@/integrations/supabase/client';
import type { PlatformVersion, SemanticVersion, ReleaseStatus, PlatformReleaseType } from './types';
import { formatVersion } from './version-utils';

function rowToVersion(row: Record<string, any>): PlatformVersion {
  return {
    id: row.id,
    version: {
      major: row.version_major,
      minor: row.version_minor,
      patch: row.version_patch,
      prerelease: row.version_prerelease ?? undefined,
      build: row.version_build ?? undefined,
    },
    version_tag: row.version_tag,
    title: row.title,
    description: row.description,
    release_type: row.release_type as PlatformReleaseType,
    modules_included: row.modules_included ?? [],
    status: row.status as ReleaseStatus,
    release_id: row.release_id ?? undefined,
    changelog_entries: row.changelog_entries ?? [],
    released_by: row.released_by,
    released_at: row.released_at,
    created_at: row.created_at,
    rollback_from: row.rollback_from ?? undefined,
  };
}

export class PlatformVersionRegistry {
  async register(
    version: SemanticVersion,
    releasedBy: string,
    opts: {
      title: string;
      description: string;
      release_type: PlatformReleaseType;
      modules_included?: string[];
      release_id?: string;
      changelog_entries?: string[];
    },
  ): Promise<PlatformVersion> {
    const { data, error } = await (supabase.from('platform_versions') as any)
      .insert({
        version_major: version.major,
        version_minor: version.minor,
        version_patch: version.patch,
        version_prerelease: version.prerelease ?? null,
        version_build: version.build ?? null,
        version_tag: `v${formatVersion(version)}`,
        title: opts.title,
        description: opts.description,
        release_type: opts.release_type,
        modules_included: opts.modules_included ?? [],
        release_id: opts.release_id ?? null,
        changelog_entries: opts.changelog_entries ?? [],
        released_by: releasedBy,
        status: 'draft',
      })
      .select()
      .single();
    if (error) throw new Error(`PlatformVersionRegistry.register: ${error.message}`);
    return rowToVersion(data);
  }

  async publish(vId: string): Promise<PlatformVersion | null> {
    const { data, error } = await (supabase.from('platform_versions') as any)
      .update({ status: 'final', released_at: new Date().toISOString() })
      .eq('id', vId)
      .neq('status', 'final')
      .select()
      .single();
    if (error || !data) return null;
    return rowToVersion(data);
  }

  async transition(vId: string, status: ReleaseStatus): Promise<PlatformVersion | null> {
    const { data, error } = await (supabase.from('platform_versions') as any)
      .update({ status })
      .eq('id', vId)
      .select()
      .single();
    if (error || !data) return null;
    return rowToVersion(data);
  }

  async getCurrent(): Promise<PlatformVersion | null> {
    const { data } = await (supabase.from('platform_versions') as any)
      .select('*')
      .eq('status', 'final')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? rowToVersion(data) : null;
  }

  async getById(id: string): Promise<PlatformVersion | null> {
    const { data } = await (supabase.from('platform_versions') as any)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return data ? rowToVersion(data) : null;
  }

  async list(): Promise<PlatformVersion[]> {
    const { data } = await (supabase.from('platform_versions') as any)
      .select('*')
      .order('created_at', { ascending: false });
    return (data ?? []).map(rowToVersion);
  }

  async history(limit = 20): Promise<PlatformVersion[]> {
    const { data } = await (supabase.from('platform_versions') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map(rowToVersion);
  }
}
