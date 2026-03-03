/**
 * NavigationVersionManager + DiffAnalyzer + RollbackService
 *
 * Manages versioned snapshots of the navigation tree,
 * computes diffs between versions, and supports rollback.
 */

import type { MenuHierarchy, MenuNode } from './menu-hierarchy-builder';
import { flattenHierarchy } from './menu-hierarchy-builder';

// ── Types ────────────────────────────────────────────────────

export interface NavigationVersion {
  id: string;
  version: number;
  snapshot: MenuHierarchy;
  created_at: number;
  created_by: string;
  description?: string;
}

export interface NavigationDiff {
  added: string[];
  removed: string[];
  moved: string[];        // modules that changed domain group
  version_from: number;
  version_to: number;
  computed_at: number;
}

// ── Version Manager ──────────────────────────────────────────

const MAX_VERSIONS = 20;
const versions: NavigationVersion[] = [];
let currentVersion = 0;

function generateId(): string {
  return `nav_v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createNavigationVersion(
  snapshot: MenuHierarchy,
  createdBy: string,
  description?: string,
): NavigationVersion {
  currentVersion++;
  const version: NavigationVersion = {
    id: generateId(),
    version: currentVersion,
    snapshot,
    created_at: Date.now(),
    created_by: createdBy,
    description,
  };

  versions.push(version);

  // Evict oldest if over limit
  if (versions.length > MAX_VERSIONS) {
    versions.splice(0, versions.length - MAX_VERSIONS);
  }

  return version;
}

export function getLatestVersion(): NavigationVersion | undefined {
  return versions[versions.length - 1];
}

export function getVersion(versionNumber: number): NavigationVersion | undefined {
  return versions.find(v => v.version === versionNumber);
}

export function listVersions(): NavigationVersion[] {
  return [...versions];
}

// ── Diff Analyzer ────────────────────────────────────────────

function extractIds(tree: MenuNode[]): Map<string, string> {
  const map = new Map<string, string>(); // id → domain
  for (const node of flattenHierarchy(tree)) {
    if (node.moduleKey) {
      map.set(node.moduleKey, node.domain);
    }
  }
  return map;
}

export function computeNavigationDiff(
  from: MenuHierarchy,
  to: MenuHierarchy,
  fromVersion: number,
  toVersion: number,
): NavigationDiff {
  const allFrom = new Map([
    ...extractIds(from.platform),
    ...extractIds(from.tenant),
  ]);
  const allTo = new Map([
    ...extractIds(to.platform),
    ...extractIds(to.tenant),
  ]);

  const added: string[] = [];
  const removed: string[] = [];
  const moved: string[] = [];

  for (const [key, domain] of allTo) {
    if (!allFrom.has(key)) {
      added.push(key);
    } else if (allFrom.get(key) !== domain) {
      moved.push(key);
    }
  }

  for (const key of allFrom.keys()) {
    if (!allTo.has(key)) {
      removed.push(key);
    }
  }

  return {
    added,
    removed,
    moved,
    version_from: fromVersion,
    version_to: toVersion,
    computed_at: Date.now(),
  };
}

/**
 * Compute diff between two version numbers.
 */
export function diffVersions(fromVersion: number, toVersion: number): NavigationDiff | null {
  const from = getVersion(fromVersion);
  const to = getVersion(toVersion);
  if (!from || !to) return null;
  return computeNavigationDiff(from.snapshot, to.snapshot, fromVersion, toVersion);
}

// ── Rollback Service ─────────────────────────────────────────

export interface RollbackResult {
  success: boolean;
  rolled_back_to: number;
  diff: NavigationDiff | null;
  restored_snapshot: MenuHierarchy | null;
}

/**
 * Rollback to a previous navigation version.
 * Creates a new version entry with the restored snapshot.
 */
export function rollbackToVersion(
  targetVersion: number,
  executedBy: string,
): RollbackResult {
  const target = getVersion(targetVersion);
  const latest = getLatestVersion();

  if (!target) {
    return { success: false, rolled_back_to: targetVersion, diff: null, restored_snapshot: null };
  }

  const diff = latest
    ? computeNavigationDiff(latest.snapshot, target.snapshot, latest.version, targetVersion)
    : null;

  // Create a new version entry with the restored snapshot
  createNavigationVersion(
    target.snapshot,
    executedBy,
    `Rollback to v${targetVersion}`,
  );

  return {
    success: true,
    rolled_back_to: targetVersion,
    diff,
    restored_snapshot: target.snapshot,
  };
}
