/**
 * SecurityKernel — Access Graph Cache
 * 
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PER-USER IN-MEMORY CACHE WITH EVENT-DRIVEN INVALIDATION       ║
 * ║                                                                  ║
 * ║  AccessGraphCache {                                              ║
 * ║    user_id, tenant_id, graph, nodes[], edges[], last_updated    ║
 * ║  }                                                               ║
 * ║                                                                  ║
 * ║  Invalidation triggers:
 * ║    • ROLE_CHANGED    — user_roles insert/update/delete           ║
 * ║    • SCOPE_CHANGED   — tenant_memberships changed                ║
 * ║    • COMPANY_CHANGED — company created/removed                   ║
 * ║    • GROUP_CHANGED   — company_group modified                    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { AccessGraph } from './access-graph';
import type { GraphNode, GraphEdge } from './access-graph';

// ════════════════════════════════════
// CACHE ENTRY
// ════════════════════════════════════

export interface AccessGraphCacheEntry {
  user_id: string;
  tenant_id: string;
  graph: AccessGraph;
  nodes: GraphNode[];
  edges: GraphEdge[];
  last_updated: number;
  /** Cache version — increments on every rebuild */
  version: number;
}

// ════════════════════════════════════
// INVALIDATION REASONS
// ════════════════════════════════════

export type CacheInvalidationReason =
  | 'ROLE_CHANGED'
  | 'SCOPE_CHANGED'
  | 'COMPANY_CHANGED'
  | 'GROUP_CHANGED'
  | 'MANUAL'
  | 'TTL_EXPIRED';

export interface CacheInvalidationEvent {
  reason: CacheInvalidationReason;
  user_id: string;
  tenant_id: string;
  timestamp: number;
  /** Optional: the entity that triggered the invalidation */
  triggeredBy?: {
    entity: string;
    entityId: string;
    action: 'insert' | 'update' | 'delete';
  };
}

// ════════════════════════════════════
// CACHE CONFIG
// ════════════════════════════════════

interface CacheConfig {
  /** Max age in milliseconds before auto-invalidation (default: 5 min) */
  ttlMs: number;
  /** Max entries to keep in cache (LRU eviction) */
  maxEntries: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 50,
};

// ════════════════════════════════════
// CACHE LISTENERS
// ════════════════════════════════════

type CacheListener = (event: CacheInvalidationEvent) => void;

// ════════════════════════════════════
// ACCESS GRAPH CACHE
// ════════════════════════════════════

let cacheVersion = 0;

class AccessGraphCacheStore {
  /** Map<cacheKey, CacheEntry> where cacheKey = `${user_id}:${tenant_id}` */
  private store = new Map<string, AccessGraphCacheEntry>();
  private accessOrder: string[] = [];
  private config: CacheConfig;
  private listeners: CacheListener[] = [];
  private invalidationLog: CacheInvalidationEvent[] = [];

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── KEY ──

  private key(userId: string, tenantId: string): string {
    return `${userId}:${tenantId}`;
  }

  // ── GET ──

  get(userId: string, tenantId: string): AccessGraphCacheEntry | null {
    const k = this.key(userId, tenantId);
    const entry = this.store.get(k);
    if (!entry) return null;

    // TTL check
    if (Date.now() - entry.last_updated > this.config.ttlMs) {
      this.invalidate(userId, tenantId, 'TTL_EXPIRED');
      return null;
    }

    // Move to end of access order (LRU)
    this.touchAccessOrder(k);
    return entry;
  }

  // ── SET ──

  set(userId: string, tenantId: string, graph: AccessGraph): AccessGraphCacheEntry {
    const k = this.key(userId, tenantId);
    cacheVersion++;

    const nodes = Array.from(graph.getNodes().values());
    const edges = Array.from(graph.getEdges());

    const entry: AccessGraphCacheEntry = {
      user_id: userId,
      tenant_id: tenantId,
      graph,
      nodes,
      edges,
      last_updated: Date.now(),
      version: cacheVersion,
    };

    this.store.set(k, entry);
    this.touchAccessOrder(k);
    this.evictIfNeeded();

    return entry;
  }

  // ── INVALIDATE ──

  invalidate(userId: string, tenantId: string, reason: CacheInvalidationReason, triggeredBy?: CacheInvalidationEvent['triggeredBy']): void {
    const k = this.key(userId, tenantId);
    const existed = this.store.delete(k);
    this.accessOrder = this.accessOrder.filter(key => key !== k);

    if (existed) {
      const event: CacheInvalidationEvent = {
        reason,
        user_id: userId,
        tenant_id: tenantId,
        timestamp: Date.now(),
        triggeredBy,
      };
      this.invalidationLog.push(event);
      // Keep log bounded
      if (this.invalidationLog.length > 100) {
        this.invalidationLog = this.invalidationLog.slice(-50);
      }
      this.notifyListeners(event);
    }
  }

  /** Invalidate all entries for a tenant (e.g., company/group changed affects all users) */
  invalidateTenant(tenantId: string, reason: CacheInvalidationReason, triggeredBy?: CacheInvalidationEvent['triggeredBy']): void {
    const keysToRemove: string[] = [];
    for (const [k, entry] of this.store) {
      if (entry.tenant_id === tenantId) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      const entry = this.store.get(k)!;
      this.store.delete(k);
      this.accessOrder = this.accessOrder.filter(key => key !== k);

      const event: CacheInvalidationEvent = {
        reason,
        user_id: entry.user_id,
        tenant_id: entry.tenant_id,
        timestamp: Date.now(),
        triggeredBy,
      };
      this.invalidationLog.push(event);
      this.notifyListeners(event);
    }
  }

  /** Clear the entire cache */
  clear(): void {
    this.store.clear();
    this.accessOrder = [];
  }

  // ── HAS ──

  has(userId: string, tenantId: string): boolean {
    const k = this.key(userId, tenantId);
    const entry = this.store.get(k);
    if (!entry) return false;
    if (Date.now() - entry.last_updated > this.config.ttlMs) {
      this.invalidate(userId, tenantId, 'TTL_EXPIRED');
      return false;
    }
    return true;
  }

  // ── LISTENERS ──

  onInvalidation(listener: CacheListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // ── STATS ──

  getStats(): {
    size: number;
    maxEntries: number;
    ttlMs: number;
    totalInvalidations: number;
    recentInvalidations: CacheInvalidationEvent[];
  } {
    return {
      size: this.store.size,
      maxEntries: this.config.maxEntries,
      ttlMs: this.config.ttlMs,
      totalInvalidations: this.invalidationLog.length,
      recentInvalidations: this.invalidationLog.slice(-10),
    };
  }

  // ── INTERNALS ──

  private touchAccessOrder(key: string): void {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }

  private evictIfNeeded(): void {
    while (this.store.size > this.config.maxEntries && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift()!;
      this.store.delete(oldest);
    }
  }

  private notifyListeners(event: CacheInvalidationEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors
      }
    }
  }
}

// ════════════════════════════════════
// SINGLETON
// ════════════════════════════════════

export const accessGraphCache = new AccessGraphCacheStore();
