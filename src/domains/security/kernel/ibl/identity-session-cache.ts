/**
 * IBL — IdentitySessionCache
 * 
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  In-memory cache that stores:                                ║
 * ║                                                              ║
 * ║    session_id      → sessionFingerprint (last 8 of JWT)      ║
 * ║    user_id         → auth.users.id                           ║
 * ║    access_graph_hash → hash of AccessGraph version+scopes    ║
 * ║    last_context    → last OperationalContext snapshot         ║
 * ║                                                              ║
 * ║  Used to:                                                    ║
 * ║    • Detect stale sessions (fingerprint mismatch)            ║
 * ║    • Skip redundant AccessGraph rebuilds (hash match)        ║
 * ║    • Restore last context on page reload                     ║
 * ║    • Audit context history                                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type { OperationalContext, AccessGraphSnapshot } from '../identity-boundary.types';

// ════════════════════════════════════
// CACHE ENTRY
// ════════════════════════════════════

export interface IdentitySessionCacheEntry {
  /** Session fingerprint (last 8 chars of access_token) */
  session_id: string;
  /** User ID from auth */
  user_id: string;
  /** Hash of the AccessGraph state for change detection */
  access_graph_hash: string;
  /** Last known OperationalContext */
  last_context: OperationalContextSnapshot | null;
  /** When this entry was created */
  cached_at: number;
  /** When this entry was last updated */
  updated_at: number;
}

export interface OperationalContextSnapshot {
  activeTenantId: string;
  activeTenantName: string;
  scopeLevel: string;
  activeGroupId: string | null;
  activeCompanyId: string | null;
  activatedAt: number;
}

// ════════════════════════════════════
// HASH UTILITY
// ════════════════════════════════════

/**
 * Compute a deterministic hash string from an AccessGraphSnapshot.
 * Used to detect when the graph has changed and needs rebuilding.
 */
export function computeAccessGraphHash(snapshot: AccessGraphSnapshot | null): string {
  if (!snapshot) return 'no-graph';

  const parts = [
    `v${snapshot.version}`,
    `t${snapshot.builtAt}`,
    snapshot.hasTenantScope ? 'T' : 'S',
    `g${snapshot.reachableGroupIds.slice().sort().join(',')}`,
    `c${snapshot.reachableCompanyIds.slice().sort().join(',')}`,
  ];
  return parts.join('|');
}

/**
 * Extract a lightweight snapshot from an OperationalContext.
 */
function snapshotContext(ctx: OperationalContext | null): OperationalContextSnapshot | null {
  if (!ctx) return null;
  return {
    activeTenantId: ctx.activeTenantId,
    activeTenantName: ctx.activeTenantName,
    scopeLevel: ctx.scopeLevel,
    activeGroupId: ctx.activeGroupId,
    activeCompanyId: ctx.activeCompanyId,
    activatedAt: ctx.activatedAt,
  };
}

// ════════════════════════════════════
// CACHE STORE
// ════════════════════════════════════

const STORAGE_KEY = 'ibl_session_cache';
const MAX_HISTORY = 10;

class IdentitySessionCacheStore {
  private _entry: IdentitySessionCacheEntry | null = null;
  private _contextHistory: OperationalContextSnapshot[] = [];

  // ── SET / UPDATE ──

  /**
   * Cache a new identity session. Called on establish().
   */
  set(
    userId: string,
    sessionId: string,
    graphSnapshot: AccessGraphSnapshot | null,
    context: OperationalContext | null,
  ): IdentitySessionCacheEntry {
    const now = Date.now();
    this._entry = {
      session_id: sessionId,
      user_id: userId,
      access_graph_hash: computeAccessGraphHash(graphSnapshot),
      last_context: snapshotContext(context),
      cached_at: now,
      updated_at: now,
    };
    this._persist();
    return this._entry;
  }

  /**
   * Update context after a context switch. Does NOT change session_id or user_id.
   */
  updateContext(context: OperationalContext | null): void {
    if (!this._entry) return;

    // Push previous context to history
    if (this._entry.last_context) {
      this._contextHistory.push(this._entry.last_context);
      if (this._contextHistory.length > MAX_HISTORY) {
        this._contextHistory.shift();
      }
    }

    this._entry = {
      ...this._entry,
      last_context: snapshotContext(context),
      updated_at: Date.now(),
    };
    this._persist();
  }

  /**
   * Update the access_graph_hash after a graph rebuild.
   */
  updateGraphHash(graphSnapshot: AccessGraphSnapshot | null): void {
    if (!this._entry) return;
    this._entry = {
      ...this._entry,
      access_graph_hash: computeAccessGraphHash(graphSnapshot),
      updated_at: Date.now(),
    };
    this._persist();
  }

  // ── GET ──

  get(): IdentitySessionCacheEntry | null {
    return this._entry;
  }

  /**
   * Check if the cached session matches the current session fingerprint.
   * Returns false if stale (different session) or no cache exists.
   */
  isSessionValid(sessionId: string): boolean {
    return this._entry?.session_id === sessionId;
  }

  /**
   * Check if the AccessGraph hash has changed since last cache.
   * Returns true if graph needs rebuilding.
   */
  isGraphStale(currentSnapshot: AccessGraphSnapshot | null): boolean {
    if (!this._entry) return true;
    return this._entry.access_graph_hash !== computeAccessGraphHash(currentSnapshot);
  }

  /**
   * Get the last cached OperationalContext (for session restore).
   */
  getLastContext(): OperationalContextSnapshot | null {
    return this._entry?.last_context ?? null;
  }

  /**
   * Get context switch history (newest first).
   */
  getContextHistory(): ReadonlyArray<OperationalContextSnapshot> {
    return [...this._contextHistory].reverse();
  }

  // ── CLEAR ──

  clear(): void {
    this._entry = null;
    this._contextHistory = [];
    this._clearStorage();
  }

  // ── RESTORE ──

  /**
   * Attempt to restore cache from sessionStorage.
   * Returns the entry if found and still valid, null otherwise.
   */
  restore(currentUserId: string): IdentitySessionCacheEntry | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as {
        entry: IdentitySessionCacheEntry;
        history: OperationalContextSnapshot[];
      };

      // Only restore if same user
      if (parsed.entry.user_id !== currentUserId) {
        this._clearStorage();
        return null;
      }

      this._entry = parsed.entry;
      this._contextHistory = parsed.history ?? [];
      return this._entry;
    } catch {
      this._clearStorage();
      return null;
    }
  }

  // ── STATS ──

  getStats(): {
    hasCachedSession: boolean;
    userId: string | null;
    sessionId: string | null;
    graphHash: string | null;
    hasLastContext: boolean;
    contextHistoryCount: number;
    cachedAt: number | null;
    updatedAt: number | null;
  } {
    return {
      hasCachedSession: this._entry !== null,
      userId: this._entry?.user_id ?? null,
      sessionId: this._entry?.session_id ?? null,
      graphHash: this._entry?.access_graph_hash ?? null,
      hasLastContext: this._entry?.last_context !== null,
      contextHistoryCount: this._contextHistory.length,
      cachedAt: this._entry?.cached_at ?? null,
      updatedAt: this._entry?.updated_at ?? null,
    };
  }

  // ── PERSISTENCE ──

  private _persist(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        entry: this._entry,
        history: this._contextHistory,
      }));
    } catch {
      // sessionStorage full or unavailable — silent fail
    }
  }

  private _clearStorage(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // silent
    }
  }
}

// ════════════════════════════════════
// SINGLETON
// ════════════════════════════════════

export const identitySessionCache = new IdentitySessionCacheStore();
