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
import { emitNavigationEvent } from './navigation-event-emitter';
import { NAVIGATION_GOVERNANCE_EVENTS } from './navigation-governance-events';

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

  // Emit NavigationVersionCreated event
  emitNavigationEvent(NAVIGATION_GOVERNANCE_EVENTS.NavigationVersionCreated, {
    version_id: version.id,
    version_number: version.version,
    snapshot_hash: `sha_${Date.now()}`,
    created_by: createdBy,
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
  new_version: number;
  diff: NavigationDiff | null;
  restored_snapshot: MenuHierarchy | null;
  summary: string[];
}

/**
 * Rollback to a previous navigation version.
 *
 * ⚠️ SAFE: Only affects navigation tree structure.
 * Does NOT touch operational data (employees, billing, etc.).
 *
 * Creates a NEW version entry with the restored snapshot,
 * preserving full history for auditability.
 */
export function rollbackToVersion(
  targetVersion: number,
  executedBy: string,
  context: 'saas' | 'tenant' = 'tenant',
): RollbackResult {
  const target = getVersion(targetVersion);
  const latest = getLatestVersion();

  if (!target) {
    return {
      success: false,
      rolled_back_to: targetVersion,
      new_version: currentVersion,
      diff: null,
      restored_snapshot: null,
      summary: [`Versão ${targetVersion} não encontrada`],
    };
  }

  const diff = latest
    ? computeNavigationDiff(latest.snapshot, target.snapshot, latest.version, targetVersion)
    : null;

  // Create a new version entry with the restored snapshot (append-only)
  const newVersion = createNavigationVersion(
    target.snapshot,
    executedBy,
    `Rollback to v${targetVersion}`,
    context,
  );

  // Persist rollback event to DB audit
  supabase.from('navigation_versions').insert({
    version_number: newVersion.version,
    context,
    tree_snapshot: target.snapshot as any,
    description: `Rollback from v${latest?.version ?? '?'} to v${targetVersion}`,
    created_by: executedBy,
  } as any).then(({ error }) => {
    if (error) console.warn('[NavigationRollback] Failed to persist rollback:', error.message);
  });

  const summary = [
    `Rollback executado: v${latest?.version ?? '?'} → v${targetVersion}`,
    `Nova versão criada: v${newVersion.version}`,
    ...(diff?.summary ?? []),
  ];

  // Emit NavigationRollbackExecuted event
  emitNavigationEvent(NAVIGATION_GOVERNANCE_EVENTS.NavigationRollbackExecuted, {
    rollback_id: newVersion.id,
    from_version: latest?.version ?? 0,
    to_version: targetVersion,
    rolled_back_by: executedBy,
    reason: `Rollback to v${targetVersion}`,
  });

  return {
    success: true,
    rolled_back_to: targetVersion,
    new_version: newVersion.version,
    diff,
    restored_snapshot: target.snapshot,
    summary,
  };
}

/**
 * Load version history from database for a given context.
 */
export async function loadVersionsFromDB(context: 'saas' | 'tenant'): Promise<NavigationVersion[]> {
  const { data, error } = await supabase
    .from('navigation_versions')
    .select('*')
    .eq('context', context)
    .order('version_number', { ascending: false })
    .limit(MAX_VERSIONS) as any;

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    version: row.version_number,
    snapshot: row.tree_snapshot as MenuHierarchy,
    created_at: new Date(row.created_at).getTime(),
    created_by: row.created_by ?? 'system',
    description: row.description,
  }));
}
