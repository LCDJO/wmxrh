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
 * customer_support starts at v1.1.0; all others at v1.0.0.
 */
export const MODULE_CATALOG: ModuleCatalogEntry[] = PLATFORM_MODULES.map((mod) => ({
  module_id: mod.key,
  name: mod.label,
  description: mod.description,
  category: mod.category,
  initial_version: mod.key === 'customer_support'
    ? { major: 1, minor: 1, patch: 0 }
    : { major: 1, minor: 0, patch: 0 },
  changelog_summary: mod.key === 'customer_support'
    ? 'v1.1.0 — Chat ao vivo estilo WhatsApp, página dedicada /support/chat.'
    : `Versão inicial — ${mod.description}.`,
}));
