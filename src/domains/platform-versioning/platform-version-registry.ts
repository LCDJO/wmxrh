/**
 * PlatformVersionRegistry — Tracks the platform's own version history.
 */
import type { PlatformVersion, SemanticVersion, ReleaseStatus } from './types';
import { formatVersion, versionId } from './version-utils';

export class PlatformVersionRegistry {
  private versions: PlatformVersion[] = [];

  register(
    version: SemanticVersion,
    createdBy: string,
    opts?: { codename?: string; release_id?: string; changelog_entries?: string[] },
  ): PlatformVersion {
    const pv: PlatformVersion = {
      id: versionId(),
      version,
      label: `v${formatVersion(version)}${opts?.codename ? ` — ${opts.codename}` : ''}`,
      codename: opts?.codename,
      status: 'draft',
      release_id: opts?.release_id,
      changelog_entries: opts?.changelog_entries ?? [],
      created_at: new Date().toISOString(),
      created_by: createdBy,
    };
    this.versions.push(pv);
    return pv;
  }

  publish(versionId: string): PlatformVersion | null {
    const v = this.versions.find(x => x.id === versionId);
    if (!v || v.status === 'published') return null;
    v.status = 'published';
    v.published_at = new Date().toISOString();
    return v;
  }

  transition(versionId: string, status: ReleaseStatus): PlatformVersion | null {
    const v = this.versions.find(x => x.id === versionId);
    if (!v) return null;
    v.status = status;
    return v;
  }

  getCurrent(): PlatformVersion | null {
    return [...this.versions].reverse().find(v => v.status === 'published') ?? null;
  }

  getById(id: string): PlatformVersion | null {
    return this.versions.find(v => v.id === id) ?? null;
  }

  list(): PlatformVersion[] {
    return [...this.versions];
  }

  history(limit = 20): PlatformVersion[] {
    return [...this.versions].reverse().slice(0, limit);
  }
}
