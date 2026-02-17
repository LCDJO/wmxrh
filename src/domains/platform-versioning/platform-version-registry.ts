/**
 * PlatformVersionRegistry — Tracks the platform's own version history.
 */
import type { PlatformVersion, SemanticVersion, ReleaseStatus, PlatformReleaseType } from './types';
import { formatVersion, versionId } from './version-utils';

export class PlatformVersionRegistry {
  private versions: PlatformVersion[] = [];

  register(
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
  ): PlatformVersion {
    const pv: PlatformVersion = {
      id: versionId(),
      version,
      version_tag: `v${formatVersion(version)}`,
      title: opts.title,
      description: opts.description,
      release_type: opts.release_type,
      modules_included: opts.modules_included ?? [],
      status: 'draft',
      release_id: opts.release_id,
      changelog_entries: opts.changelog_entries ?? [],
      released_by: releasedBy,
      released_at: null,
      created_at: new Date().toISOString(),
    };
    this.versions.push(pv);
    return pv;
  }

  publish(vId: string): PlatformVersion | null {
    const v = this.versions.find(x => x.id === vId);
    if (!v || v.status === 'final') return null;
    v.status = 'final';
    v.released_at = new Date().toISOString();
    return v;
  }

  transition(vId: string, status: ReleaseStatus): PlatformVersion | null {
    const v = this.versions.find(x => x.id === vId);
    if (!v) return null;
    v.status = status;
    return v;
  }

  getCurrent(): PlatformVersion | null {
    return [...this.versions].reverse().find(v => v.status === 'final') ?? null;
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
