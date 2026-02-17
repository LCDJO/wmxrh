/**
 * ModuleVersionRegistry — Tracks individual module version history.
 */
import type { ModuleVersion, SemanticVersion, ModuleDependency, ReleaseStatus } from './types';
import { compareVersions, versionId } from './version-utils';

export class ModuleVersionRegistry {
  private versions: Map<string, ModuleVersion[]> = new Map();

  register(
    moduleKey: string,
    version: SemanticVersion,
    createdBy: string,
    opts?: {
      dependencies?: ModuleDependency[];
      min_platform_version?: SemanticVersion;
      changelog_entries?: string[];
      breaking_changes?: string[];
      migration_notes?: string;
    },
  ): ModuleVersion {
    const mv: ModuleVersion = {
      id: versionId(),
      module_key: moduleKey,
      version,
      status: 'draft',
      min_platform_version: opts?.min_platform_version,
      dependencies: opts?.dependencies ?? [],
      changelog_entries: opts?.changelog_entries ?? [],
      breaking_changes: opts?.breaking_changes ?? [],
      migration_notes: opts?.migration_notes,
      created_at: new Date().toISOString(),
      created_by: createdBy,
    };
    const list = this.versions.get(moduleKey) ?? [];
    list.push(mv);
    this.versions.set(moduleKey, list);
    return mv;
  }

  publish(moduleKey: string, versionId: string): ModuleVersion | null {
    const list = this.versions.get(moduleKey) ?? [];
    const v = list.find(x => x.id === versionId);
    if (!v) return null;
    v.status = 'published';
    v.published_at = new Date().toISOString();
    return v;
  }

  transition(moduleKey: string, versionId: string, status: ReleaseStatus): ModuleVersion | null {
    const v = (this.versions.get(moduleKey) ?? []).find(x => x.id === versionId);
    if (!v) return null;
    v.status = status;
    return v;
  }

  getCurrent(moduleKey: string): ModuleVersion | null {
    const list = this.versions.get(moduleKey) ?? [];
    return [...list].reverse().find(v => v.status === 'published') ?? null;
  }

  getById(moduleKey: string, id: string): ModuleVersion | null {
    return (this.versions.get(moduleKey) ?? []).find(v => v.id === id) ?? null;
  }

  listForModule(moduleKey: string): ModuleVersion[] {
    return [...(this.versions.get(moduleKey) ?? [])];
  }

  listAllCurrent(): ModuleVersion[] {
    const result: ModuleVersion[] = [];
    for (const key of this.versions.keys()) {
      const cur = this.getCurrent(key);
      if (cur) result.push(cur);
    }
    return result;
  }

  /** All modules that have any version registered */
  listModuleKeys(): string[] {
    return [...this.versions.keys()];
  }

  /** Get latest version (any status) */
  getLatest(moduleKey: string): ModuleVersion | null {
    const list = this.versions.get(moduleKey) ?? [];
    if (!list.length) return null;
    return list.reduce((a, b) => (compareVersions(a.version, b.version) >= 0 ? a : b));
  }
}
