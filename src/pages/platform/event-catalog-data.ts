/**
 * Domain Event Catalog — AUTO-DISCOVERED via import.meta.glob
 *
 * Each domain event file exports a `__DOMAIN_CATALOG` object (or array)
 * with { domain, color, events: [{ name, description }] }.
 *
 * The "Atualizar" button on PlatformEvents calls `buildCatalog()` which
 * re-scans all discovered modules automatically — zero manual maintenance.
 */

// ── Types ──────────────────────────────────────────────────────

export interface EventCatalogEntry {
  domain: string;
  domainColor: string;
  eventName: string;
  description: string;
}

interface DomainRegistry {
  domain: string;
  color: string;
  events: { name: string; description: string }[];
}

// ── Auto-discovery via Vite glob ───────────────────────────────
// Eagerly imports every file matching *event* patterns in src/domains/
// and collects any __DOMAIN_CATALOG exports.

const eventModules = import.meta.glob<{ __DOMAIN_CATALOG?: DomainRegistry | DomainRegistry[] }>(
  [
    '../../domains/**/*event*.ts',
    '../../domains/**/*events*.ts',
    '../../modules/**/*event*.ts',
  ],
  { eager: true },
);

function collectRegistries(): DomainRegistry[] {
  const registries: DomainRegistry[] = [];
  for (const mod of Object.values(eventModules)) {
    if (!mod.__DOMAIN_CATALOG) continue;
    if (Array.isArray(mod.__DOMAIN_CATALOG)) {
      registries.push(...mod.__DOMAIN_CATALOG);
    } else {
      registries.push(mod.__DOMAIN_CATALOG);
    }
  }
  return registries;
}

// ── Builder ────────────────────────────────────────────────────

let _cache: EventCatalogEntry[] | null = null;
let _domains: string[] | null = null;

/**
 * Build (or rebuild) the flat event catalog from all auto-discovered
 * domain registries. Called on first access and whenever the user
 * clicks "Atualizar".
 */
export function buildCatalog(): EventCatalogEntry[] {
  const registries = collectRegistries();
  const entries: EventCatalogEntry[] = [];
  for (const reg of registries) {
    for (const ev of reg.events) {
      entries.push({
        domain: reg.domain,
        domainColor: reg.color,
        eventName: ev.name,
        description: ev.description,
      });
    }
  }
  _cache = entries;
  _domains = [...new Set(entries.map(e => e.domain))];
  return entries;
}

/** Get the current catalog (builds on first call). */
export function getEventCatalog(): EventCatalogEntry[] {
  if (!_cache) buildCatalog();
  return _cache!;
}

/** Get unique domain names. */
export function getAllDomains(): string[] {
  if (!_domains) buildCatalog();
  return _domains!;
}

// Legacy exports for backward compat
export const EVENT_CATALOG = getEventCatalog();
export const ALL_DOMAINS = getAllDomains();
