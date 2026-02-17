/**
 * ChangeLogger — Immutable audit log for all platform/module changes.
 */
import type { ChangeLogEntry, ChangeCategory } from './types';
import { versionId } from './version-utils';

export class ChangeLogger {
  private entries: ChangeLogEntry[] = [];

  log(opts: {
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
    this.entries.push(entry);
    return entry;
  }

  getAll(): ChangeLogEntry[] {
    return [...this.entries];
  }

  getByScope(scope: 'platform' | 'module', scopeKey?: string): ChangeLogEntry[] {
    return this.entries.filter(e => e.scope === scope && (!scopeKey || e.scope_key === scopeKey));
  }

  getByVersion(versionId: string): ChangeLogEntry[] {
    return this.entries.filter(e => e.linked_version_id === versionId);
  }

  getByRelease(releaseId: string): ChangeLogEntry[] {
    return this.entries.filter(e => e.linked_release_id === releaseId);
  }

  getByCategory(category: ChangeCategory): ChangeLogEntry[] {
    return this.entries.filter(e => e.category === category);
  }

  search(query: string): ChangeLogEntry[] {
    const q = query.toLowerCase();
    return this.entries.filter(
      e => e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.tags.some(t => t.toLowerCase().includes(q)),
    );
  }
}
