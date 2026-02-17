/**
 * ReleaseManager — Groups platform + module versions into auditable releases.
 */
import type { Release, ReleaseStatus, DependencySnapshot, PreReleaseCheck } from './types';
import { versionId } from './version-utils';

export class ReleaseManager {
  private releases: Release[] = [];

  create(opts: {
    name: string;
    createdBy: string;
    platform_version_id?: string;
    module_versions?: string[];
    dependency_snapshot?: DependencySnapshot;
  }): Release {
    const release: Release = {
      id: versionId(),
      name: opts.name,
      status: 'draft',
      platform_version_id: opts.platform_version_id,
      module_versions: opts.module_versions ?? [],
      changelog_entries: [],
      dependency_snapshot: opts.dependency_snapshot ?? { timestamp: new Date().toISOString(), modules: [], conflicts: [] },
      pre_checks: [],
      created_at: new Date().toISOString(),
      created_by: opts.createdBy,
    };
    this.releases.push(release);
    return release;
  }

  addModuleVersion(releaseId: string, moduleVersionId: string): void {
    const r = this.getById(releaseId);
    if (r && !r.module_versions.includes(moduleVersionId)) {
      r.module_versions.push(moduleVersionId);
    }
  }

  addChangelogEntry(releaseId: string, entryId: string): void {
    const r = this.getById(releaseId);
    if (r && !r.changelog_entries.includes(entryId)) {
      r.changelog_entries.push(entryId);
    }
  }

  addPreCheck(releaseId: string, check: PreReleaseCheck): void {
    const r = this.getById(releaseId);
    if (r) r.pre_checks.push(check);
  }

  approve(releaseId: string, approvedBy: string): Release | null {
    const r = this.getById(releaseId);
    if (!r || r.status !== 'draft') return null;
    r.approved_by = approvedBy;
    r.approved_at = new Date().toISOString();
    r.status = 'staging';
    return r;
  }

  transition(releaseId: string, status: ReleaseStatus): Release | null {
    const r = this.getById(releaseId);
    if (!r) return null;
    r.status = status;
    if (status === 'published') r.published_at = new Date().toISOString();
    if (status === 'rolled_back') r.rolled_back_at = new Date().toISOString();
    return r;
  }

  publish(releaseId: string): Release | null {
    const r = this.getById(releaseId);
    if (!r || !r.approved_by) return null;
    // Check pre-checks
    const failed = r.pre_checks.filter(c => c.status === 'failed');
    if (failed.length > 0) return null;
    return this.transition(releaseId, 'published');
  }

  getById(id: string): Release | null {
    return this.releases.find(r => r.id === id) ?? null;
  }

  getCurrent(): Release | null {
    return [...this.releases].reverse().find(r => r.status === 'published') ?? null;
  }

  list(): Release[] {
    return [...this.releases];
  }

  listByStatus(status: ReleaseStatus): Release[] {
    return this.releases.filter(r => r.status === status);
  }
}
