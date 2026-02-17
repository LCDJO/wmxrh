/**
 * ChangeLogger — Immutable audit log for all platform/module changes.
 *
 * Supports both the new PlatformChangeLog (primary) and legacy ChangeLogEntry.
 */
import type { PlatformChangeLog, ChangeType, ChangeLogEntry, ChangeCategory } from './types';
import { versionId } from './version-utils';

export class ChangeLogger {
  private logs: PlatformChangeLog[] = [];
  private legacyEntries: ChangeLogEntry[] = [];

  // ── Primary API (PlatformChangeLog) ──

  log(opts: {
    module_id?: string;
    entity_type: string;
    entity_id: string;
    change_type: ChangeType;
    version_tag: string;
    payload_diff: Record<string, unknown>;
    changed_by: string;
  }): PlatformChangeLog {
    const entry: PlatformChangeLog = {
      id: versionId(),
      module_id: opts.module_id,
      entity_type: opts.entity_type,
      entity_id: opts.entity_id,
      change_type: opts.change_type,
      version_tag: opts.version_tag,
      payload_diff: opts.payload_diff,
      changed_by: opts.changed_by,
      changed_at: new Date().toISOString(),
    };
    this.logs.push(entry);
    return entry;
  }

  getAll(): PlatformChangeLog[] {
    return [...this.logs];
  }

  getByModule(moduleId: string): PlatformChangeLog[] {
    return this.logs.filter(e => e.module_id === moduleId);
  }

  getByEntity(entityType: string, entityId?: string): PlatformChangeLog[] {
    return this.logs.filter(e => e.entity_type === entityType && (!entityId || e.entity_id === entityId));
  }

  getByChangeType(changeType: ChangeType): PlatformChangeLog[] {
    return this.logs.filter(e => e.change_type === changeType);
  }

  getByVersionTag(versionTag: string): PlatformChangeLog[] {
    return this.logs.filter(e => e.version_tag === versionTag);
  }

  getPlatformLevel(): PlatformChangeLog[] {
    return this.logs.filter(e => !e.module_id);
  }

  search(query: string): PlatformChangeLog[] {
    const q = query.toLowerCase();
    return this.logs.filter(
      e => e.entity_type.toLowerCase().includes(q) ||
           e.entity_id.toLowerCase().includes(q) ||
           e.change_type.toLowerCase().includes(q) ||
           (e.module_id?.toLowerCase().includes(q) ?? false),
    );
  }

  // ── Legacy API (ChangeLogEntry) — kept for ChangelogRenderer compatibility ──

  logLegacy(opts: {
    category: ChangeCategory;
    scope: 'platform' | 'module';
    scope_key?: string;
    title: string;
    description: string;
    author: string;
    linked_version_id?: string;
    linked_release_id?: string;
    tags?: string[];
  }): ChangeLogEntry {
    const entry: ChangeLogEntry = {
      id: versionId(),
      category: opts.category,
      scope: opts.scope,
      scope_key: opts.scope_key,
      title: opts.title,
      description: opts.description,
      author: opts.author,
      linked_version_id: opts.linked_version_id,
      linked_release_id: opts.linked_release_id,
      tags: opts.tags ?? [],
      created_at: new Date().toISOString(),
    };
    this.legacyEntries.push(entry);
    return entry;
  }

  getLegacyAll(): ChangeLogEntry[] {
    return [...this.legacyEntries];
  }

  getByVersion(versionId: string): ChangeLogEntry[] {
    return this.legacyEntries.filter(e => e.linked_version_id === versionId);
  }

  getByRelease(releaseId: string): ChangeLogEntry[] {
    return this.legacyEntries.filter(e => e.linked_release_id === releaseId);
  }

  getByCategory(category: ChangeCategory): ChangeLogEntry[] {
    return this.legacyEntries.filter(e => e.category === category);
  }

  getByScope(scope: 'platform' | 'module', scopeKey?: string): ChangeLogEntry[] {
    return this.legacyEntries.filter(e => e.scope === scope && (!scopeKey || e.scope_key === scopeKey));
  }
}
