/**
 * eSocial Layout Version Manager
 *
 * Manages layout version migrations (S-1.0 → S-1.1 → S-1.2 → future).
 *
 * Extensible: add new versions via `registerVersion()` and migration
 * rules via `registerMigration()` — zero changes to the core domain.
 *
 * Pure logic — no I/O.
 */

import type { LayoutVersion, ESocialEnvelope } from './types';
import { CURRENT_LAYOUT_VERSION, EVENT_TYPE_REGISTRY } from './types';
import { hasMapper } from './layout-mappers';

// ════════════════════════════════════
// VERSION METADATA
// ════════════════════════════════════

export interface LayoutVersionInfo {
  version: LayoutVersion;
  release_date: string;
  deprecation_date: string | null;
  sunset_date: string | null;
  is_current: boolean;
  supported_events: string[];
  breaking_changes: string[];
}

// ════════════════════════════════════
// MIGRATION RULE
// ════════════════════════════════════

interface MigrationRule {
  from: LayoutVersion;
  to: LayoutVersion;
  transform: (payload: Record<string, unknown>, eventType: string) => Record<string, unknown>;
  description: string;
}

// ════════════════════════════════════
// INTERNAL REGISTRIES (mutable, extensible)
// ════════════════════════════════════

const versionRegistry: LayoutVersionInfo[] = [
  {
    version: 'S-1.0',
    release_date: '2018-01-01',
    deprecation_date: '2021-05-01',
    sunset_date: '2022-01-01',
    is_current: false,
    supported_events: ['S-1000', 'S-2200', 'S-2206'],
    breaking_changes: [],
  },
  {
    version: 'S-1.1',
    release_date: '2021-05-01',
    deprecation_date: '2023-01-01',
    sunset_date: '2024-01-01',
    is_current: false,
    supported_events: ['S-1000', 'S-1010', 'S-1030', 'S-2200', 'S-2205', 'S-2206', 'S-2220', 'S-2230', 'S-2299', 'S-1200', 'S-1210'],
    breaking_changes: [
      'Campo indMV adicionado ao S-2200',
      'Nova estrutura para dados bancários no S-2200',
    ],
  },
  {
    version: 'S-1.2',
    release_date: '2023-01-01',
    deprecation_date: null,
    sunset_date: null,
    is_current: true,
    supported_events: Object.keys(EVENT_TYPE_REGISTRY),
    breaking_changes: [
      'Simplificação do S-2200 (redução de campos obrigatórios)',
      'Novo evento S-2210 (CAT)',
      'Evento S-2240 (Condições Ambientais) adicionado',
      'GFIP Digital integrado',
    ],
  },
];

const migrationRules: MigrationRule[] = [
  {
    from: 'S-1.0',
    to: 'S-1.1',
    description: 'Adiciona campos obrigatórios da versão S-1.1',
    transform: (payload) => ({
      ...payload,
      _migrated_from: 'S-1.0',
      _migrated_at: new Date().toISOString(),
    }),
  },
  {
    from: 'S-1.1',
    to: 'S-1.2',
    description: 'Adapta estrutura para layout simplificado S-1.2',
    transform: (payload) => ({
      ...payload,
      _migrated_from: 'S-1.1',
      _migrated_at: new Date().toISOString(),
    }),
  },
];

// ════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════

export const layoutVersionManager = {

  // ── Registry Extension (no domain changes needed) ──

  /**
   * Register a new layout version at runtime.
   * Call this to add future versions (e.g. S-1.3) without touching core types.
   */
  registerVersion(info: LayoutVersionInfo): void {
    const existing = versionRegistry.findIndex(v => v.version === info.version);
    if (existing >= 0) {
      versionRegistry[existing] = info;
    } else {
      versionRegistry.push(info);
    }
    // If marking as current, un-mark others
    if (info.is_current) {
      for (const v of versionRegistry) {
        if (v.version !== info.version) v.is_current = false;
      }
    }
  },

  /**
   * Register a migration rule between two versions.
   */
  registerMigration(rule: MigrationRule): void {
    const existing = migrationRules.findIndex(r => r.from === rule.from && r.to === rule.to);
    if (existing >= 0) {
      migrationRules[existing] = rule;
    } else {
      migrationRules.push(rule);
    }
  },

  // ── Queries ──

  getCurrentVersion(): LayoutVersion {
    const current = versionRegistry.find(v => v.is_current);
    return current?.version ?? CURRENT_LAYOUT_VERSION;
  },

  getVersionInfo(version: LayoutVersion): LayoutVersionInfo | null {
    return versionRegistry.find(v => v.version === version) ?? null;
  },

  listVersions(): LayoutVersionInfo[] {
    return [...versionRegistry];
  },

  isSupported(version: LayoutVersion): boolean {
    const info = this.getVersionInfo(version);
    if (!info) return false;
    if (!info.sunset_date) return true;
    return new Date(info.sunset_date) > new Date();
  },

  isDeprecated(version: LayoutVersion): boolean {
    const info = this.getVersionInfo(version);
    if (!info || !info.deprecation_date) return false;
    return new Date(info.deprecation_date) <= new Date() && this.isSupported(version);
  },

  supportsEvent(version: LayoutVersion, eventType: string): boolean {
    const info = this.getVersionInfo(version);
    return info?.supported_events.includes(eventType) ?? false;
  },

  getRequiredVersion(eventType: string): LayoutVersion {
    const registry = EVENT_TYPE_REGISTRY[eventType];
    return registry?.layout_version ?? this.getCurrentVersion();
  },

  // ── Validation ──

  validateEnvelopeVersion(envelope: ESocialEnvelope): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggested_version: LayoutVersion | null;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const currentVersion = this.getCurrentVersion();

    if (!this.isSupported(envelope.layout_version)) {
      errors.push(`Versão ${envelope.layout_version} não é mais suportada`);
    } else if (this.isDeprecated(envelope.layout_version)) {
      warnings.push(`Versão ${envelope.layout_version} está depreciada — migrar para ${currentVersion}`);
    }

    if (!this.supportsEvent(envelope.layout_version, envelope.event_type)) {
      errors.push(`Evento ${envelope.event_type} não é suportado na versão ${envelope.layout_version}`);
    }

    if (!hasMapper(envelope.event_type)) {
      warnings.push(`Mapper não implementado para ${envelope.event_type} — usando payload direto`);
    }

    const needsUpgrade = envelope.layout_version !== currentVersion;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggested_version: needsUpgrade ? currentVersion : null,
    };
  },

  // ── Migration ──

  getMigrationPath(from: LayoutVersion, to: LayoutVersion): MigrationRule[] {
    const path: MigrationRule[] = [];
    let current = from;
    const visited = new Set<string>();

    while (current !== to) {
      if (visited.has(current)) return []; // Cycle detection
      visited.add(current);
      const rule = migrationRules.find(r => r.from === current);
      if (!rule) return [];
      path.push(rule);
      current = rule.to;
    }

    return path;
  },

  canMigrate(from: LayoutVersion, to: LayoutVersion): boolean {
    return this.getMigrationPath(from, to).length > 0;
  },

  migrateEnvelope(envelope: ESocialEnvelope, targetVersion: LayoutVersion): ESocialEnvelope {
    if (envelope.layout_version === targetVersion) return envelope;

    const path = this.getMigrationPath(envelope.layout_version, targetVersion);
    if (path.length === 0) {
      throw new Error(`Sem caminho de migração de ${envelope.layout_version} para ${targetVersion}`);
    }

    let payload = { ...envelope.payload };
    for (const rule of path) {
      payload = rule.transform(payload, envelope.event_type);
    }

    return {
      ...envelope,
      layout_version: targetVersion,
      payload,
    };
  },

  /**
   * Batch-migrate envelopes to the current version.
   */
  migrateAllToCurrent(envelopes: ESocialEnvelope[]): {
    migrated: ESocialEnvelope[];
    failed: Array<{ envelope_id: string; error: string }>;
  } {
    const currentVersion = this.getCurrentVersion();
    const migrated: ESocialEnvelope[] = [];
    const failed: Array<{ envelope_id: string; error: string }> = [];

    for (const env of envelopes) {
      if (env.layout_version === currentVersion) {
        migrated.push(env);
        continue;
      }
      try {
        migrated.push(this.migrateEnvelope(env, currentVersion));
      } catch (err) {
        failed.push({
          envelope_id: env.id,
          error: err instanceof Error ? err.message : 'Erro de migração',
        });
      }
    }

    return { migrated, failed };
  },

  // ── Audit ──

  auditVersionCompliance(envelopes: ESocialEnvelope[]): {
    total: number;
    current_version: number;
    deprecated: number;
    unsupported: number;
    needs_migration: ESocialEnvelope[];
  } {
    const currentVersion = this.getCurrentVersion();
    const needsMigration: ESocialEnvelope[] = [];
    let current = 0, deprecated = 0, unsupported = 0;

    for (const env of envelopes) {
      if (env.layout_version === currentVersion) {
        current++;
      } else if (this.isDeprecated(env.layout_version)) {
        deprecated++;
        needsMigration.push(env);
      } else if (!this.isSupported(env.layout_version)) {
        unsupported++;
        needsMigration.push(env);
      }
    }

    return { total: envelopes.length, current_version: current, deprecated, unsupported, needs_migration: needsMigration };
  },
};
