/**
 * ModuleCatalog — Derived from the unified PLATFORM_MODULES registry.
 * Used by the versioning engine to seed and track module versions.
 */
import { PLATFORM_MODULES } from '@/domains/platform/platform-modules';

export interface ModuleCatalogEntry {
  module_id: string;
  name: string;
  description: string;
  category: 'platform' | 'domain';
  initial_version: { major: number; minor: number; patch: number };
  changelog_summary: string;
}

/**
 * Build the catalog from the unified module list.
 * support_module starts at v2.0.0 (refactor para módulo versionado); all others at v1.0.0.
 */
export const MODULE_CATALOG: ModuleCatalogEntry[] = PLATFORM_MODULES.map((mod) => ({
  module_id: mod.key,
  name: mod.label,
  description: mod.description,
  category: mod.category,
  initial_version: mod.key === 'support_module'
    ? { major: 2, minor: 0, patch: 0 }
    : { major: 1, minor: 0, patch: 0 },
  changelog_summary: mod.key === 'support_module'
    ? 'v2.0.0 — Refactor: módulo versionado com duas camadas (Tenant App + Platform Console), LiveSupportEngine, ConversationAnalytics.'
    : `Versão inicial — ${mod.description}.`,
}));
