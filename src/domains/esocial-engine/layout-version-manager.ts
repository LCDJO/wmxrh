/**
 * eSocial Layout Version Manager
 *
 * Manages layout version migrations (S-1.0 → S-1.1 → S-1.2).
 * Tracks compatibility, provides migration paths, and ensures
 * envelopes use the correct version for their event type.
 *
 * Pure logic — no I/O.
 */

import type { LayoutVersion, ESocialEnvelope, ESocialCategory } from './types';
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

const VERSION_REGISTRY: LayoutVersionInfo[] = [
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

// ════════════════════════════════════
// MIGRATION PATHS
// ════════════════════════════════════

interface MigrationRule {
  from: LayoutVersion;
  to: LayoutVersion;
  transform: (payload: Record<string, unknown>) => Record<string, unknown>;
  description: string;
}

const MIGRATION_RULES: MigrationRule[] = [
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
  /**
   * Get the current active layout version.
   */
  getCurrentVersion(): LayoutVersion {
    return CURRENT_LAYOUT_VERSION;
  },

  /**
   * Get info about a specific version.
   */
  getVersionInfo(version: LayoutVersion): LayoutVersionInfo | null {
    return VERSION_REGISTRY.find(v => v.version === version) ?? null;
  },

  /**
   * List all known versions.
   */
  listVersions(): LayoutVersionInfo[] {
    return [...VERSION_REGISTRY];
  },

  /**
   * Check if a version is still supported (not sunset).
   */
  isSupported(version: LayoutVersion): boolean {
    const info = this.getVersionInfo(version);
    if (!info) return false;
    if (!info.sunset_date) return true;
    return new Date(info.sunset_date) > new Date();
  },

  /**
   * Check if a version is deprecated but still functional.
   */
  isDeprecated(version: LayoutVersion): boolean {
    const info = this.getVersionInfo(version);
    if (!info || !info.deprecation_date) return false;
    return new Date(info.deprecation_date) <= new Date() && this.isSupported(version);
  },

  /**
   * Check if an event type is supported in a given version.
   */
  supportsEvent(version: LayoutVersion, eventType: string): boolean {
    const info = this.getVersionInfo(version);
    return info?.supported_events.includes(eventType) ?? false;
  },

  /**
   * Get the required version for an event type (minimum supported version).
   */
  getRequiredVersion(eventType: string): LayoutVersion {
    const registry = EVENT_TYPE_REGISTRY[eventType];
    return registry?.layout_version ?? CURRENT_LAYOUT_VERSION;
  },

  /**
   * Validate that an envelope uses a compatible layout version.
   */
  validateEnvelopeVersion(envelope: ESocialEnvelope): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggested_version: LayoutVersion | null;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.isSupported(envelope.layout_version)) {
      errors.push(`Versão ${envelope.layout_version} não é mais suportada`);
    } else if (this.isDeprecated(envelope.layout_version)) {
      warnings.push(`Versão ${envelope.layout_version} está depreciada — migrar para ${CURRENT_LAYOUT_VERSION}`);
    }

    if (!this.supportsEvent(envelope.layout_version, envelope.event_type)) {
      errors.push(`Evento ${envelope.event_type} não é suportado na versão ${envelope.layout_version}`);
    }

    if (!hasMapper(envelope.event_type)) {
      warnings.push(`Mapper não implementado para ${envelope.event_type} — usando payload direto`);
    }

    const needsUpgrade = envelope.layout_version !== CURRENT_LAYOUT_VERSION;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggested_version: needsUpgrade ? CURRENT_LAYOUT_VERSION : null,
    };
  },

  /**
   * Migrate an envelope's payload from one version to another.
   */
  migrateEnvelope(envelope: ESocialEnvelope, targetVersion: LayoutVersion): ESocialEnvelope {
    if (envelope.layout_version === targetVersion) return envelope;

    const path = this.getMigrationPath(envelope.layout_version, targetVersion);
    if (path.length === 0) {
      throw new Error(`Sem caminho de migração de ${envelope.layout_version} para ${targetVersion}`);
    }

    let payload = { ...envelope.payload };
    for (const rule of path) {
      payload = rule.transform(payload);
    }

    return {
      ...envelope,
      layout_version: targetVersion,
      payload,
    };
  },

  /**
   * Get the migration path between two versions.
   */
  getMigrationPath(from: LayoutVersion, to: LayoutVersion): MigrationRule[] {
    const path: MigrationRule[] = [];
    let current = from;

    while (current !== to) {
      const rule = MIGRATION_RULES.find(r => r.from === current);
      if (!rule) return []; // No path found
      path.push(rule);
      current = rule.to;
    }

    return path;
  },

  /**
   * Audit all envelopes for version compliance.
   */
  auditVersionCompliance(envelopes: ESocialEnvelope[]): {
    total: number;
    current_version: number;
    deprecated: number;
    unsupported: number;
    needs_migration: ESocialEnvelope[];
  } {
    const needsMigration: ESocialEnvelope[] = [];
    let current = 0, deprecated = 0, unsupported = 0;

    for (const env of envelopes) {
      if (env.layout_version === CURRENT_LAYOUT_VERSION) {
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
