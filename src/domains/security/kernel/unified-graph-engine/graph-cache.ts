/**
 * UGE Graph Cache — Performance Layer
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Three performance optimizations:                                ║
 * ║                                                                  ║
 * ║  1. Tenant-Scoped Snapshots  → filtered graph per tenant_id     ║
 * ║  2. Incremental Updates      → patch existing snapshot instead   ║
 * ║     of full recomposition when only one domain changed          ║
 * ║  3. Session Cache            → keyed by session + domains,      ║
 * ║     auto-evicts on TTL or identity change                       ║
 * ║                                                                  ║
 * ║  SECURITY: All cached data is READ-ONLY and immutable.          ║
 * ║  Cache never stores or exposes mutable references.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type {
  GraphDomain,
  UnifiedGraphSnapshot,
  UnifiedNode,
  UnifiedEdge,
} from './types';
import { emitUGEEvent } from './uge-events';

// ════════════════════════════════════
// CACHE ENTRY
// ════════════════════════════════════

interface CacheEntry {
  snapshot: UnifiedGraphSnapshot;
  createdAt: number;
  /** Domain versions at the time of caching */
  domainVersions: Map<GraphDomain, number>;
  /** Number of cache hits */
  hits: number;
}

// ════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════

export interface GraphCacheConfig {
  /** Max age of a cached snapshot in milliseconds (default: 30s) */
  ttlMs: number;
  /** Max number of entries in the cache (default: 20) */
  maxEntries: number;
  /** Max number of tenant snapshots cached (default: 10) */
  maxTenantSnapshots: number;
}

const DEFAULT_CONFIG: GraphCacheConfig = {
  ttlMs: 30_000,
  maxEntries: 20,
  maxTenantSnapshots: 10,
};

// ════════════════════════════════════
// DOMAIN VERSION TRACKER
// ════════════════════════════════════

const domainVersions = new Map<GraphDomain, number>();

/** Bump version when a domain's data changes. Called by providers. */
export function invalidateDomain(domain: GraphDomain): void {
  domainVersions.set(domain, (domainVersions.get(domain) ?? 0) + 1);
}

/** Get current version for a domain */
export function getDomainVersion(domain: GraphDomain): number {
  return domainVersions.get(domain) ?? 0;
}

// ════════════════════════════════════
// GRAPH CACHE
// ════════════════════════════════════

class GraphCache {
  private config: GraphCacheConfig;

  /** Session-scoped cache: key = `${sessionId}:${sortedDomains}` */
  private sessionCache = new Map<string, CacheEntry>();

  /** Tenant-scoped snapshots: key = tenantId */
  private tenantCache = new Map<string, CacheEntry>();

  constructor(config?: Partial<GraphCacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Session Cache ───────────────────────────────────

  /**
   * Get a cached snapshot for a session + domain combination.
   * Returns null if cache miss or stale.
   */
  getSessionSnapshot(
    sessionId: string,
    domains?: GraphDomain[],
  ): UnifiedGraphSnapshot | null {
    const key = this.buildSessionKey(sessionId, domains);
    const entry = this.sessionCache.get(key);
    if (!entry) return null;

    // TTL check
    if (Date.now() - entry.createdAt > this.config.ttlMs) {
      this.sessionCache.delete(key);
      return null;
    }

    // Version check — any domain changed → stale
    if (this.isStale(entry)) {
      this.sessionCache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.snapshot;
  }

  /**
   * Store a snapshot in the session cache.
   */
  setSessionSnapshot(
    sessionId: string,
    snapshot: UnifiedGraphSnapshot,
    domains?: GraphDomain[],
  ): void {
    const key = this.buildSessionKey(sessionId, domains);

    // Evict if over capacity
    if (this.sessionCache.size >= this.config.maxEntries) {
      this.evictLRU(this.sessionCache);
    }

    this.sessionCache.set(key, {
      snapshot,
      createdAt: Date.now(),
      domainVersions: this.currentDomainVersions(snapshot.domains),
      hits: 0,
    });
  }

  /** Invalidate all entries for a session (e.g. on identity change) */
  invalidateSession(sessionId: string): void {
    const prefix = `${sessionId}:`;
    for (const key of this.sessionCache.keys()) {
      if (key.startsWith(prefix)) {
        this.sessionCache.delete(key);
      }
    }
  }

  // ── Tenant Snapshot Cache ──────────────────────────

  /**
   * Get a cached tenant-scoped snapshot.
   * Tenant snapshots are filtered views of the full graph.
   */
  getTenantSnapshot(tenantId: string): UnifiedGraphSnapshot | null {
    const entry = this.tenantCache.get(tenantId);
    if (!entry) return null;

    if (Date.now() - entry.createdAt > this.config.ttlMs) {
      this.tenantCache.delete(tenantId);
      return null;
    }

    if (this.isStale(entry)) {
      this.tenantCache.delete(tenantId);
      return null;
    }

    entry.hits++;
    return entry.snapshot;
  }

  /**
   * Store a tenant-scoped snapshot.
   */
  setTenantSnapshot(tenantId: string, snapshot: UnifiedGraphSnapshot): void {
    if (this.tenantCache.size >= this.config.maxTenantSnapshots) {
      this.evictLRU(this.tenantCache);
    }

    this.tenantCache.set(tenantId, {
      snapshot,
      createdAt: Date.now(),
      domainVersions: this.currentDomainVersions(snapshot.domains),
      hits: 0,
    });
  }

  /** Invalidate a specific tenant's cached snapshot */
  invalidateTenant(tenantId: string): void {
    this.tenantCache.delete(tenantId);
  }

  // ── Incremental Update ────────────────────────────

  /**
   * Check if only specific domains have changed since a snapshot was cached.
   * Returns the list of stale domains, or empty if snapshot is fresh.
   */
  getStaleDomains(snapshot: UnifiedGraphSnapshot): GraphDomain[] {
    const stale: GraphDomain[] = [];
    for (const domain of snapshot.domains) {
      const cachedVersion = domainVersions.get(domain) ?? 0;
      // The snapshot doesn't track per-domain versions, so we compare
      // against the global domain version tracker
      if (cachedVersion > (snapshot.version ?? 0)) {
        stale.push(domain);
      }
    }
    return stale;
  }

  /**
   * Merge incremental updates from specific domains into an existing snapshot.
   * Only re-fetches data from the changed domains.
   */
  applyIncrementalUpdate(
    base: UnifiedGraphSnapshot,
    staleDomains: GraphDomain[],
    freshData: Map<GraphDomain, { nodes: UnifiedNode[]; edges: UnifiedEdge[] }>,
  ): UnifiedGraphSnapshot {
    const t0 = performance.now();

    // Start with nodes/edges from unchanged domains
    const nodes = new Map<string, UnifiedNode>();
    const edges: UnifiedEdge[] = [];
    const staleDomainSet = new Set(staleDomains);

    // Keep nodes/edges from fresh domains
    for (const [uid, node] of base.nodes) {
      if (!staleDomainSet.has(node.domain)) {
        nodes.set(uid, node);
      }
    }
    for (const edge of base.edges) {
      if (!staleDomainSet.has(edge.domain)) {
        edges.push(edge);
      }
    }

    // Add fresh data
    for (const [, data] of freshData) {
      for (const n of data.nodes) {
        if (!nodes.has(n.uid)) nodes.set(n.uid, n);
      }
      edges.push(...data.edges);
    }

    // Deduplicate edges
    const edgeSet = new Set<string>();
    const dedupedEdges = edges.filter(e => {
      const key = `${e.from}|${e.to}|${e.relation}`;
      if (edgeSet.has(key)) return false;
      edgeSet.add(key);
      return true;
    });

    const compositionTimeMs = performance.now() - t0;

    const updated: UnifiedGraphSnapshot = {
      nodes,
      edges: dedupedEdges,
      domains: base.domains,
      builtAt: Date.now(),
      version: base.version + 1,
    };

    emitUGEEvent({
      type: 'GraphComposed',
      timestamp: Date.now(),
      version: updated.version,
      domains: updated.domains,
      nodeCount: nodes.size,
      edgeCount: dedupedEdges.length,
      compositionTimeMs: Math.round(compositionTimeMs * 100) / 100,
    });

    return Object.freeze(updated);
  }

  // ── Global ────────────────────────────────────────

  /** Clear all caches */
  clear(): void {
    this.sessionCache.clear();
    this.tenantCache.clear();
  }

  /** Get cache statistics */
  stats() {
    return {
      sessionEntries: this.sessionCache.size,
      tenantEntries: this.tenantCache.size,
      domainVersions: Object.fromEntries(domainVersions),
      config: { ...this.config },
    };
  }

  // ── Private ───────────────────────────────────────

  private buildSessionKey(sessionId: string, domains?: GraphDomain[]): string {
    const sorted = domains ? [...domains].sort().join(',') : '*';
    return `${sessionId}:${sorted}`;
  }

  private currentDomainVersions(domains: readonly GraphDomain[]): Map<GraphDomain, number> {
    const map = new Map<GraphDomain, number>();
    for (const d of domains) {
      map.set(d, domainVersions.get(d) ?? 0);
    }
    return map;
  }

  private isStale(entry: CacheEntry): boolean {
    for (const [domain, version] of entry.domainVersions) {
      if ((domainVersions.get(domain) ?? 0) > version) return true;
    }
    return false;
  }

  private evictLRU(cache: Map<string, CacheEntry>): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of cache) {
      // Weighted: fewer hits + older = evict first
      const score = entry.createdAt - entry.hits * 1000;
      if (score < oldestTime) {
        oldestTime = score;
        oldestKey = key;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }
}

// ════════════════════════════════════
// SINGLETON
// ════════════════════════════════════

export const graphCache = new GraphCache();

// ════════════════════════════════════
// TENANT SNAPSHOT HELPER
// ════════════════════════════════════

/**
 * Extract a tenant-scoped view from a full snapshot.
 * Filters nodes/edges to only those belonging to or referencing the tenant.
 */
export function extractTenantSnapshot(
  full: UnifiedGraphSnapshot,
  tenantId: string,
): UnifiedGraphSnapshot {
  // Cached?
  const cached = graphCache.getTenantSnapshot(tenantId);
  if (cached) return cached;

  const tenantNodeUid = `tenant_access:${tenantId}`;
  const relevantUids = new Set<string>();

  // 1. Find the tenant node itself
  for (const [uid, node] of full.nodes) {
    if (node.type === 'tenant' && node.originalId === tenantId) {
      relevantUids.add(uid);
    }
    // Nodes that belong to this tenant (via meta)
    if (node.meta?.tenantId === tenantId) {
      relevantUids.add(uid);
    }
  }

  // 2. Find edges connected to tenant nodes → expand reachable set
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const edge of full.edges) {
      if (relevantUids.has(edge.from) && !relevantUids.has(edge.to)) {
        const target = full.nodes.get(edge.to);
        // Only include same-tenant or cross-domain identity links
        if (target && (target.meta?.tenantId === tenantId || edge.relation === 'IDENTITY_LINK' || target.type === 'permission')) {
          relevantUids.add(edge.to);
          expanded = true;
        }
      }
      if (relevantUids.has(edge.to) && !relevantUids.has(edge.from)) {
        const source = full.nodes.get(edge.from);
        if (source && (source.meta?.tenantId === tenantId || edge.relation === 'IDENTITY_LINK')) {
          relevantUids.add(edge.from);
          expanded = true;
        }
      }
    }
  }

  // 3. Build filtered snapshot
  const nodes = new Map<string, UnifiedNode>();
  for (const uid of relevantUids) {
    const node = full.nodes.get(uid);
    if (node) nodes.set(uid, node);
  }

  const edges = full.edges.filter(
    e => relevantUids.has(e.from) && relevantUids.has(e.to),
  );

  const snapshot = Object.freeze({
    nodes,
    edges,
    domains: full.domains,
    builtAt: Date.now(),
    version: full.version,
  }) as UnifiedGraphSnapshot;

  graphCache.setTenantSnapshot(tenantId, snapshot);
  return snapshot;
}
