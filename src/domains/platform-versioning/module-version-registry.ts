/**
 * ModuleVersionRegistry — Tracks individual module version history.
 */
import type { ModuleVersion, SemanticVersion, ModuleDependency, ModuleVersionStatus } from './types';
import { compareVersions, formatVersion, versionId } from './version-utils';

export class ModuleVersionRegistry {
  private versions: Map<string, ModuleVersion[]> = new Map();

  register(
    moduleId: string,
    version: SemanticVersion,
    createdBy: string,
    opts?: {
      dependencies?: ModuleDependency[];
      breaking_changes?: boolean;
      changelog_summary?: string;
    },
  ): ModuleVersion {
    const mv: ModuleVersion = {
      id: versionId(),
      module_id: moduleId,
      version,
      version_tag: `v${formatVersion(version)}`,
      status: 'draft',
      breaking_changes: opts?.breaking_changes ?? false,
      dependencies: opts?.dependencies ?? [],
      changelog_summary: opts?.changelog_summary ?? '',
      released_at: null,
      created_at: new Date().toISOString(),
      created_by: createdBy,
    };
    const list = this.versions.get(moduleId) ?? [];
    list.push(mv);
    this.versions.set(moduleId, list);
    return mv;
  }

  release(moduleId: string, versionId: string): ModuleVersion | null {
    const v = (this.versions.get(moduleId) ?? []).find(x => x.id === versionId);
    if (!v) return null;
    v.status = 'released';
    v.released_at = new Date().toISOString();
    return v;
  }

  deprecate(moduleId: string, versionId: string): ModuleVersion | null {
    const v = (this.versions.get(moduleId) ?? []).find(x => x.id === versionId);
    if (!v) return null;
    v.status = 'deprecated';
    return v;
  }

  transition(moduleId: string, versionId: string, status: ModuleVersionStatus): ModuleVersion | null {
    const v = (this.versions.get(moduleId) ?? []).find(x => x.id === versionId);
    if (!v) return null;
    v.status = status;
    return v;
  }

  getCurrent(moduleId: string): ModuleVersion | null {
    const list = this.versions.get(moduleId) ?? [];
    return [...list].reverse().find(v => v.status === 'released') ?? null;
  }

  getById(moduleId: string, id: string): ModuleVersion | null {
    return (this.versions.get(moduleId) ?? []).find(v => v.id === id) ?? null;
  }

  listForModule(moduleId: string): ModuleVersion[] {
    return [...(this.versions.get(moduleId) ?? [])];
  }

  listAllCurrent(): ModuleVersion[] {
    const result: ModuleVersion[] = [];
    for (const key of this.versions.keys()) {
      const cur = this.getCurrent(key);
      if (cur) result.push(cur);
    }
    return result;
  }

  listModuleKeys(): string[] {
    return [...this.versions.keys()];
  }

  getLatest(moduleId: string): ModuleVersion | null {
    const list = this.versions.get(moduleId) ?? [];
    if (!list.length) return null;
    return list.reduce((a, b) => (compareVersions(a.version, b.version) >= 0 ? a : b));
  }
}
