/**
 * ModuleVersionRegistry — DB-backed module version tracking.
 */
import { supabase } from '@/integrations/supabase/client';
import type { ModuleVersion, SemanticVersion, ModuleDependency, ModuleVersionStatus } from './types';
import { compareVersions, formatVersion } from './version-utils';

function rowToModuleVersion(row: Record<string, any>): ModuleVersion {
  return {
    id: row.id,
    module_id: row.module_id,
    version: {
      major: row.version_major,
      minor: row.version_minor,
      patch: row.version_patch,
      prerelease: row.version_prerelease ?? undefined,
    },
    version_tag: row.version_tag,
    status: row.status as ModuleVersionStatus,
    breaking_changes: row.breaking_changes,
    dependencies: (row.dependencies ?? []) as ModuleDependency[],
    changelog_summary: row.changelog_summary ?? '',
    released_at: row.released_at,
    created_at: row.created_at,
    created_by: row.created_by,
  };
}

export class ModuleVersionRegistry {
  async register(
    moduleId: string,
    version: SemanticVersion,
    createdBy: string,
    opts?: {
      dependencies?: ModuleDependency[];
      breaking_changes?: boolean;
      changelog_summary?: string;
    },
  ): Promise<ModuleVersion> {
    const { data, error } = await (supabase.from('module_versions') as any)
      .insert({
        module_id: moduleId,
        version_major: version.major,
        version_minor: version.minor,
        version_patch: version.patch,
        version_prerelease: version.prerelease ?? null,
        version_tag: `v${formatVersion(version)}`,
        status: 'draft',
        breaking_changes: opts?.breaking_changes ?? false,
        dependencies: opts?.dependencies ?? [],
        changelog_summary: opts?.changelog_summary ?? '',
        created_by: createdBy,
      })
      .select()
      .single();
    if (error) throw new Error(`ModuleVersionRegistry.register: ${error.message}`);
    return rowToModuleVersion(data);
  }

  async release(moduleId: string, versionId: string): Promise<ModuleVersion | null> {
    const { data } = await (supabase.from('module_versions') as any)
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('id', versionId)
      .eq('module_id', moduleId)
      .select()
      .single();
    return data ? rowToModuleVersion(data) : null;
  }

  async deprecate(moduleId: string, versionId: string): Promise<ModuleVersion | null> {
    const { data } = await (supabase.from('module_versions') as any)
      .update({ status: 'deprecated' })
      .eq('id', versionId)
      .eq('module_id', moduleId)
      .select()
      .single();
    return data ? rowToModuleVersion(data) : null;
  }

  async transition(moduleId: string, versionId: string, status: ModuleVersionStatus): Promise<ModuleVersion | null> {
    const { data } = await (supabase.from('module_versions') as any)
      .update({ status })
      .eq('id', versionId)
      .eq('module_id', moduleId)
      .select()
      .single();
    return data ? rowToModuleVersion(data) : null;
  }

  async getCurrent(moduleId: string): Promise<ModuleVersion | null> {
    const { data } = await (supabase.from('module_versions') as any)
      .select('*')
      .eq('module_id', moduleId)
      .eq('status', 'released')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? rowToModuleVersion(data) : null;
  }

  async getById(moduleId: string, id: string): Promise<ModuleVersion | null> {
    const { data } = await (supabase.from('module_versions') as any)
      .select('*')
      .eq('id', id)
      .eq('module_id', moduleId)
      .maybeSingle();
    return data ? rowToModuleVersion(data) : null;
  }

  async listForModule(moduleId: string): Promise<ModuleVersion[]> {
    const { data } = await (supabase.from('module_versions') as any)
      .select('*')
      .eq('module_id', moduleId)
      .order('created_at', { ascending: false });
    return (data ?? []).map(rowToModuleVersion);
  }

  async listAllCurrent(): Promise<ModuleVersion[]> {
    // Get distinct modules then fetch current for each
    const { data: all } = await (supabase.from('module_versions') as any)
      .select('*')
      .eq('status', 'released')
      .order('created_at', { ascending: false });
    if (!all) return [];
    // Deduplicate: keep first (newest) per module_id
    const seen = new Set<string>();
    const result: ModuleVersion[] = [];
    for (const row of all) {
      if (!seen.has(row.module_id)) {
        seen.add(row.module_id);
        result.push(rowToModuleVersion(row));
      }
    }
    return result;
  }

  async listModuleKeys(): Promise<string[]> {
    const { data } = await (supabase.from('module_versions') as any)
      .select('module_id');
    if (!data) return [];
    return [...new Set((data as any[]).map(r => r.module_id))];
  }

  async getLatest(moduleId: string): Promise<ModuleVersion | null> {
    const { data } = await (supabase.from('module_versions') as any)
      .select('*')
      .eq('module_id', moduleId)
      .order('version_major', { ascending: false })
      .order('version_minor', { ascending: false })
      .order('version_patch', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? rowToModuleVersion(data) : null;
  }
}
