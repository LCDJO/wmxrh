/**
 * ReleaseManager — DB-backed release lifecycle management.
 */
import { supabase } from '@/integrations/supabase/client';
import type { Release, ReleaseStatus, DependencySnapshot, PreReleaseCheck } from './types';

function rowToRelease(row: Record<string, any>): Release {
  return {
    id: row.id,
    name: row.name,
    status: row.status as ReleaseStatus,
    platform_version_id: row.platform_version_id,
    module_versions: row.module_versions ?? [],
    changelog_entries: row.changelog_entries ?? [],
    dependency_snapshot: row.dependency_snapshot ?? { timestamp: '', modules: [], conflicts: [] },
    pre_checks: (row.pre_checks ?? []) as PreReleaseCheck[],
    promoted_to_candidate_by: row.promoted_to_candidate_by ?? undefined,
    promoted_to_candidate_at: row.promoted_to_candidate_at ?? undefined,
    finalized_by: row.finalized_by ?? undefined,
    finalized_at: row.finalized_at ?? undefined,
    rolled_back_at: row.rolled_back_at ?? undefined,
    rollback_reason: row.rollback_reason ?? undefined,
    created_at: row.created_at,
    created_by: row.created_by,
  };
}

export class ReleaseManager {
  async create(opts: {
    name: string;
    createdBy: string;
    platform_version_id?: string;
    module_versions?: string[];
    dependency_snapshot?: DependencySnapshot;
  }): Promise<Release> {
    const { data, error } = await (supabase.from('versioning_releases') as any)
      .insert({
        name: opts.name,
        status: 'draft',
        platform_version_id: opts.platform_version_id ?? null,
        module_versions: opts.module_versions ?? [],
        changelog_entries: [],
        dependency_snapshot: opts.dependency_snapshot ?? { timestamp: new Date().toISOString(), modules: [], conflicts: [] },
        pre_checks: [],
        created_by: opts.createdBy,
      })
      .select()
      .single();
    if (error) throw new Error(`ReleaseManager.create: ${error.message}`);
    return rowToRelease(data);
  }

  async addModuleVersion(releaseId: string, moduleVersionId: string): Promise<void> {
    const r = await this.getById(releaseId);
    if (!r) return;
    if (r.module_versions.includes(moduleVersionId)) return;
    await (supabase.from('versioning_releases') as any)
      .update({ module_versions: [...r.module_versions, moduleVersionId] })
      .eq('id', releaseId);
  }

  async setPlatformVersion(releaseId: string, platformVersionId: string): Promise<void> {
    await (supabase.from('versioning_releases') as any)
      .update({ platform_version_id: platformVersionId })
      .eq('id', releaseId);
  }

  async addChangelogEntry(releaseId: string, entryId: string): Promise<void> {
    const r = await this.getById(releaseId);
    if (!r) return;
    if (r.changelog_entries.includes(entryId)) return;
    await (supabase.from('versioning_releases') as any)
      .update({ changelog_entries: [...r.changelog_entries, entryId] })
      .eq('id', releaseId);
  }

  async addPreCheck(releaseId: string, check: PreReleaseCheck): Promise<void> {
    const r = await this.getById(releaseId);
    if (!r) return;
    await (supabase.from('versioning_releases') as any)
      .update({ pre_checks: [...r.pre_checks, check] })
      .eq('id', releaseId);
  }

  async promoteToCandidate(releaseId: string, promotedBy: string): Promise<Release | null> {
    const { data } = await (supabase.from('versioning_releases') as any)
      .update({
        status: 'candidate',
        promoted_to_candidate_by: promotedBy,
        promoted_to_candidate_at: new Date().toISOString(),
      })
      .eq('id', releaseId)
      .eq('status', 'draft')
      .select()
      .single();
    return data ? rowToRelease(data) : null;
  }

  async finalize(releaseId: string, finalizedBy: string): Promise<Release | null> {
    const r = await this.getById(releaseId);
    if (!r || r.status !== 'candidate') return null;
    const failed = r.pre_checks.filter(c => c.status === 'failed');
    if (failed.length > 0) return null;
    const { data } = await (supabase.from('versioning_releases') as any)
      .update({
        status: 'final',
        finalized_by: finalizedBy,
        finalized_at: new Date().toISOString(),
      })
      .eq('id', releaseId)
      .select()
      .single();
    return data ? rowToRelease(data) : null;
  }

  async transition(releaseId: string, status: ReleaseStatus): Promise<Release | null> {
    const updates: Record<string, any> = { status };
    if (status === 'rolled_back') updates.rolled_back_at = new Date().toISOString();
    const { data } = await (supabase.from('versioning_releases') as any)
      .update(updates)
      .eq('id', releaseId)
      .select()
      .single();
    return data ? rowToRelease(data) : null;
  }

  async getById(id: string): Promise<Release | null> {
    const { data } = await (supabase.from('versioning_releases') as any)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return data ? rowToRelease(data) : null;
  }

  async getCurrent(): Promise<Release | null> {
    const { data } = await (supabase.from('versioning_releases') as any)
      .select('*')
      .eq('status', 'final')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? rowToRelease(data) : null;
  }

  async list(): Promise<Release[]> {
    const { data } = await (supabase.from('versioning_releases') as any)
      .select('*')
      .order('created_at', { ascending: false });
    return (data ?? []).map(rowToRelease);
  }

  async listByStatus(status: ReleaseStatus): Promise<Release[]> {
    const { data } = await (supabase.from('versioning_releases') as any)
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });
    return (data ?? []).map(rowToRelease);
  }
}
