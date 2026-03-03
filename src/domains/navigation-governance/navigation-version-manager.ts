/**
 * NavigationVersionManager + DiffAnalyzer + RollbackService
 *
 * Manages versioned snapshots of the navigation tree,
 * computes diffs between versions, and supports rollback.
 * Persists to `navigation_versions` table in the database.
 */

import { supabase } from '@/integrations/supabase/client';

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

export interface DiffChange {
  key: string;
  label: string;
  type: 'added' | 'removed' | 'moved';
  from_group?: string;
  to_group?: string;
  description: string;
}

export interface NavigationDiff {
  added: string[];
  removed: string[];
  moved: string[];
  changes: DiffChange[];
  summary: string[];
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
  context: 'saas' | 'tenant' = 'tenant',
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

  // Persist to database (fire-and-forget)
  supabase.from('navigation_versions').insert({
    version_number: currentVersion,
    context,
    tree_snapshot: snapshot as any,
    description,
    created_by: createdBy,
  } as any).then(({ error }) => {
    if (error) console.warn('[NavigationVersionManager] Failed to persist version:', error.message);
  });

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

/** Extract module key → { domain, label, parentGroup } */
function extractNodeInfo(tree: MenuNode[]): Map<string, { domain: string; label: string; parentGroup: string }> {
  const map = new Map<string, { domain: string; label: string; parentGroup: string }>();
  for (const group of tree) {
    const groupLabel = group.label;
    // Direct module on group
    if (group.moduleKey) {
      map.set(group.moduleKey, { domain: group.domain, label: group.label, parentGroup: groupLabel });
    }
    // Children
    for (const child of flattenHierarchy(group.children)) {
      if (child.moduleKey) {
        map.set(child.moduleKey, { domain: child.domain, label: child.label, parentGroup: groupLabel });
      }
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
    ...extractNodeInfo(from.platform),
    ...extractNodeInfo(from.tenant),
  ]);
  const allTo = new Map([
    ...extractNodeInfo(to.platform),
    ...extractNodeInfo(to.tenant),
  ]);

  const added: string[] = [];
  const removed: string[] = [];
  const moved: string[] = [];
  const changes: DiffChange[] = [];

  for (const [key, info] of allTo) {
    const prev = allFrom.get(key);
    if (!prev) {
      added.push(key);
      changes.push({
        key,
        label: info.label,
        type: 'added',
        to_group: info.parentGroup,
        description: `"${info.label}" adicionado em "${info.parentGroup}"`,
      });
    } else if (prev.parentGroup !== info.parentGroup) {
      moved.push(key);
      changes.push({
        key,
        label: info.label,
        type: 'moved',
        from_group: prev.parentGroup,
        to_group: info.parentGroup,
        description: `"${info.label}" movido de "${prev.parentGroup}" para "${info.parentGroup}"`,
      });
    }
  }

  for (const [key, info] of allFrom) {
    if (!allTo.has(key)) {
      removed.push(key);
      changes.push({
        key,
        label: info.label,
        type: 'removed',
        from_group: info.parentGroup,
        description: `"${info.label}" removido de "${info.parentGroup}"`,
      });
    }
  }

  const summary = changes.map(c => c.description);

  return {
    added,
    removed,
    moved,
    changes,
    summary,
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
