/**
 * ChangelogRenderer — Generates human-readable changelogs from entries.
 */
import type { ChangeLogEntry, ChangeCategory, Release } from './types';
import type { ChangeLogger } from './change-logger';
import type { ReleaseManager } from './release-manager';

const CATEGORY_LABELS: Record<ChangeCategory, string> = {
  feature: '🚀 Novas Funcionalidades',
  fix: '🐛 Correções',
  improvement: '✨ Melhorias',
  breaking: '💥 Breaking Changes',
  deprecation: '⚠️ Depreciações',
  security: '🔒 Segurança',
  performance: '⚡ Performance',
  docs: '📝 Documentação',
};

const CATEGORY_ORDER: ChangeCategory[] = ['breaking', 'security', 'feature', 'improvement', 'fix', 'performance', 'deprecation', 'docs'];

export class ChangelogRenderer {
  constructor(
    private changeLogger: ChangeLogger,
    private releaseManager: ReleaseManager,
  ) {}

  async renderRelease(releaseId: string): Promise<string> {
    const release = await this.releaseManager.getById(releaseId);
    if (!release) return '';
    const entries = await this.changeLogger.getByRelease(releaseId);
    const date = release.finalized_at ?? release.created_at;
    return this.renderMarkdown(release.name, date, entries);
  }

  async renderVersion(versionId: string): Promise<string> {
    const entries = await this.changeLogger.getByVersion(versionId);
    return this.renderMarkdown(`Version ${versionId}`, new Date().toISOString(), entries);
  }

  async renderFull(limit?: number): Promise<string> {
    const releases = (await this.releaseManager.list())
      .filter(r => r.status === 'final')
      .reverse()
      .slice(0, limit);
    const parts: string[] = [];
    for (const r of releases) {
      parts.push(await this.renderRelease(r.id));
    }
    return parts.join('\n\n---\n\n');
  }

  async renderModule(moduleKey: string): Promise<string> {
    const entries = await this.changeLogger.getByScope('module', moduleKey);
    return this.renderMarkdown(`Módulo: ${moduleKey}`, new Date().toISOString(), entries);
  }

  private renderMarkdown(title: string, date: string, entries: ChangeLogEntry[]): string {
    const grouped = this.groupByCategory(entries);
    const lines: string[] = [];
    lines.push(`## ${title}`);
    lines.push(`_${new Date(date).toLocaleDateString('pt-BR')}_\n`);
    for (const cat of CATEGORY_ORDER) {
      const group = grouped.get(cat);
      if (!group?.length) continue;
      lines.push(`### ${CATEGORY_LABELS[cat]}\n`);
      for (const entry of group) {
        const scope = entry.scope_key ? `**[${entry.scope_key}]** ` : '';
        lines.push(`- ${scope}${entry.title}`);
        if (entry.description) lines.push(`  ${entry.description}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  private groupByCategory(entries: ChangeLogEntry[]): Map<ChangeCategory, ChangeLogEntry[]> {
    const map = new Map<ChangeCategory, ChangeLogEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return map;
  }

  async toStructured(releaseId: string): Promise<Array<{ category: ChangeCategory; label: string; entries: ChangeLogEntry[] }>> {
    const entries = await this.changeLogger.getByRelease(releaseId);
    const grouped = this.groupByCategory(entries);
    return CATEGORY_ORDER
      .filter(cat => grouped.has(cat))
      .map(cat => ({ category: cat, label: CATEGORY_LABELS[cat], entries: grouped.get(cat)! }));
  }
}
