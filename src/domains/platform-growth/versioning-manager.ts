/**
 * VersioningManager — Tracks page versions for rollback and audit.
 *
 * Responsibilities:
 *  1. Snapshot page state before each publish
 *  2. Enable rollback to any previous version
 *  3. Diff two versions
 *  4. Enforce maximum version retention
 */
import type { LandingPage, FABBlock } from './types';

export interface PageVersion {
  id: string;
  pageId: string;
  version: number;
  snapshot: PageSnapshot;
  createdAt: string;
  createdBy: string;
  changeNotes: string;
}

export interface PageSnapshot {
  name: string;
  slug: string;
  blocks: FABBlock[];
  status: 'draft' | 'published';
}

export interface VersionDiff {
  field: string;
  before: unknown;
  after: unknown;
}

const MAX_VERSIONS = 50;

export class VersioningManager {
  private versions: Map<string, PageVersion[]> = new Map();

  /** Create a snapshot before publishing */
  snapshot(page: LandingPage, createdBy: string, changeNotes = ''): PageVersion {
    const pageVersions = this.versions.get(page.id) ?? [];

    const version: PageVersion = {
      id: `v-${Date.now()}`,
      pageId: page.id,
      version: pageVersions.length + 1,
      snapshot: {
        name: page.name,
        slug: page.slug,
        blocks: structuredClone(page.blocks),
        status: page.status,
      },
      createdAt: new Date().toISOString(),
      createdBy,
      changeNotes,
    };

    pageVersions.push(version);

    // Enforce retention limit
    if (pageVersions.length > MAX_VERSIONS) {
      pageVersions.splice(0, pageVersions.length - MAX_VERSIONS);
    }

    this.versions.set(page.id, pageVersions);
    return version;
  }

  /** Get all versions for a page */
  getVersions(pageId: string): PageVersion[] {
    return this.versions.get(pageId) ?? [];
  }

  /** Get a specific version */
  getVersion(pageId: string, versionNumber: number): PageVersion | null {
    const versions = this.versions.get(pageId) ?? [];
    return versions.find(v => v.version === versionNumber) ?? null;
  }

  /** Get the latest version */
  getLatest(pageId: string): PageVersion | null {
    const versions = this.versions.get(pageId) ?? [];
    return versions[versions.length - 1] ?? null;
  }

  /** Diff two versions */
  diff(pageId: string, versionA: number, versionB: number): VersionDiff[] {
    const a = this.getVersion(pageId, versionA);
    const b = this.getVersion(pageId, versionB);
    if (!a || !b) return [];

    const diffs: VersionDiff[] = [];

    if (a.snapshot.name !== b.snapshot.name) {
      diffs.push({ field: 'name', before: a.snapshot.name, after: b.snapshot.name });
    }
    if (a.snapshot.slug !== b.snapshot.slug) {
      diffs.push({ field: 'slug', before: a.snapshot.slug, after: b.snapshot.slug });
    }
    if (a.snapshot.status !== b.snapshot.status) {
      diffs.push({ field: 'status', before: a.snapshot.status, after: b.snapshot.status });
    }
    if (a.snapshot.blocks.length !== b.snapshot.blocks.length) {
      diffs.push({ field: 'blocks.count', before: a.snapshot.blocks.length, after: b.snapshot.blocks.length });
    }

    // Block-level diffs
    const maxBlocks = Math.max(a.snapshot.blocks.length, b.snapshot.blocks.length);
    for (let i = 0; i < maxBlocks; i++) {
      const blockA = a.snapshot.blocks[i];
      const blockB = b.snapshot.blocks[i];

      if (!blockA) {
        diffs.push({ field: `blocks[${i}]`, before: null, after: blockB?.type });
      } else if (!blockB) {
        diffs.push({ field: `blocks[${i}]`, before: blockA.type, after: null });
      } else if (JSON.stringify(blockA) !== JSON.stringify(blockB)) {
        diffs.push({ field: `blocks[${i}].content`, before: blockA.type, after: blockB.type });
      }
    }

    return diffs;
  }

  /** Prepare rollback data (returns snapshot to restore) */
  getRollbackSnapshot(pageId: string, toVersion: number): PageSnapshot | null {
    const version = this.getVersion(pageId, toVersion);
    return version ? structuredClone(version.snapshot) : null;
  }

  /**
   * Get an isolated preview of a specific version.
   * Returns a full LandingPage-like object suitable for rendering in preview mode,
   * without modifying the live page.
   */
  getPreviewSnapshot(pageId: string, versionNumber: number): (PageSnapshot & { versionNumber: number; previewMode: true }) | null {
    const version = this.getVersion(pageId, versionNumber);
    if (!version) return null;
    const snapshot = structuredClone(version.snapshot);
    return {
      ...snapshot,
      versionNumber: version.version,
      previewMode: true as const,
    };
  }

  /** Total version count */
  getVersionCount(pageId: string): number {
    return (this.versions.get(pageId) ?? []).length;
  }

  /** Delete all versions for a page */
  clearVersions(pageId: string): void {
    this.versions.delete(pageId);
  }
}

export const versioningManager = new VersioningManager();
