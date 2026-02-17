/**
 * ReleaseManager — Groups platform + module versions into auditable releases.
 *
 * Lifecycle: draft → candidate → final
 */
import type { Release, ReleaseStatus, DependencySnapshot, PreReleaseCheck } from './types';
import { versionId } from './version-utils';

export class ReleaseManager {
  private releases: Release[] = [];

  /** Create a Release Draft */
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
      platform_version_id: opts.platform_version_id ?? null,
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

  /** Add a module version to a draft release */
  addModuleVersion(releaseId: string, moduleVersionId: string): void {
    const r = this.getById(releaseId);
    if (r && !r.module_versions.includes(moduleVersionId)) {
      r.module_versions.push(moduleVersionId);
    }
  }

  /** Set or update the platform version for this release */
  setPlatformVersion(releaseId: string, platformVersionId: string): void {
    const r = this.getById(releaseId);
    if (r) r.platform_version_id = platformVersionId;
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

  /** Promote draft → candidate */
  promoteToCandidate(releaseId: string, promotedBy: string): Release | null {
    const r = this.getById(releaseId);
    if (!r || r.status !== 'draft') return null;
    r.status = 'candidate';
    r.promoted_to_candidate_by = promotedBy;
    r.promoted_to_candidate_at = new Date().toISOString();
    return r;
  }

  /** Finalize candidate → final */
  finalize(releaseId: string, finalizedBy: string): Release | null {
    const r = this.getById(releaseId);
    if (!r || r.status !== 'candidate') return null;
    // Block if any pre-check failed
    const failed = r.pre_checks.filter(c => c.status === 'failed');
    if (failed.length > 0) return null;
    r.status = 'final';
    r.finalized_by = finalizedBy;
    r.finalized_at = new Date().toISOString();
    return r;
  }

  transition(releaseId: string, status: ReleaseStatus): Release | null {
    const r = this.getById(releaseId);
    if (!r) return null;
    r.status = status;
    if (status === 'rolled_back') r.rolled_back_at = new Date().toISOString();
    return r;
  }

  getById(id: string): Release | null {
    return this.releases.find(r => r.id === id) ?? null;
  }

  getCurrent(): Release | null {
    return [...this.releases].reverse().find(r => r.status === 'final') ?? null;
  }

  list(): Release[] {
    return [...this.releases];
  }

  listByStatus(status: ReleaseStatus): Release[] {
    return this.releases.filter(r => r.status === status);
  }
}
