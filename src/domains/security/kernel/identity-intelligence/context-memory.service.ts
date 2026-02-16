/**
 * ContextMemoryService — Manages recent context history.
 *
 * Responsibilities:
 *   - Record context visits with full depth (Tenant / Group / Company)
 *   - Persist/restore from localStorage (per-user key)
 *   - Provide MRU (Most Recently Used) list for quick switching
 *   - Track context entry time for duration calculation
 *   - Restore last valid context on re-login
 *
 * Part of the Identity Intelligence Layer decomposition.
 */

import { identityBoundary } from '../identity-boundary';
import type { RecentContext } from './types';

const MAX_RECENT_CONTEXTS = 10;
const RECENT_CONTEXTS_KEY = 'iil:recent_contexts';
const LAST_CONTEXT_KEY = 'iil:last_context';

/**
 * Build a unique key for deduplication:
 * tenant + group + company combination.
 */
function contextKey(c: RecentContext): string {
  return `${c.tenantId}|${c.groupId ?? ''}|${c.companyId ?? ''}`;
}

export class ContextMemoryService {
  private _recentContexts: RecentContext[] = [];
  private _contextEnteredAt: number | null = null;
  private _userId: string | null = null;

  constructor() {
    this._load();
  }

  // ══════════════════════════════════
  // GETTERS
  // ══════════════════════════════════

  get recentContexts(): readonly RecentContext[] {
    return this._recentContexts;
  }

  // ══════════════════════════════════
  // CONTEXT TRACKING
  // ══════════════════════════════════

  /**
   * Bind to a specific user (call on login). Reloads persisted data for that user.
   */
  bindUser(userId: string): void {
    this._userId = userId;
    this._load();
  }

  /**
   * Mark that the user entered a new context.
   */
  markContextEntry(): void {
    this._contextEnteredAt = Date.now();
  }

  /**
   * Clear context entry time (e.g., on logout).
   */
  clearEntry(): void {
    this._contextEnteredAt = null;
  }

  /**
   * Record the current operational context into history
   * before switching away. Calculates visit duration.
   * Also persists as the "last context" for auto-restore.
   */
  recordCurrentContext(): void {
    const context = identityBoundary.operationalContext;
    if (!context) return;

    const durationMs = this._contextEnteredAt ? Date.now() - this._contextEnteredAt : 0;

    const entry: RecentContext = {
      tenantId: context.activeTenantId,
      tenantName: context.activeTenantName,
      role: context.membershipRole,
      scopeLevel: context.scopeLevel,
      groupId: context.activeGroupId,
      companyId: context.activeCompanyId,
      visitedAt: this._contextEnteredAt ?? Date.now(),
      durationMs,
    };

    // Remove duplicate by full context key (tenant + group + company)
    const key = contextKey(entry);
    this._recentContexts = this._recentContexts.filter(
      c => contextKey(c) !== key,
    );

    // Add to front (MRU)
    this._recentContexts.unshift(entry);

    // Trim
    if (this._recentContexts.length > MAX_RECENT_CONTEXTS) {
      this._recentContexts = this._recentContexts.slice(0, MAX_RECENT_CONTEXTS);
    }

    this._persist();
    this._persistLastContext(entry);
  }

  // ══════════════════════════════════
  // RESTORE
  // ══════════════════════════════════

  /**
   * Get the last valid context for auto-restore on re-login.
   * Validates that the user still has access to that tenant.
   */
  getLastValidContext(): RecentContext | null {
    try {
      const raw = localStorage.getItem(this._storageKey(LAST_CONTEXT_KEY));
      if (!raw) return null;

      const ctx: RecentContext = JSON.parse(raw);
      if (!ctx.tenantId) return null;

      // Validate membership still exists
      if (identityBoundary.identity) {
        const hasAccess = identityBoundary.canSwitchToTenant(ctx.tenantId);
        if (!hasAccess) return null;
      }

      return ctx;
    } catch {
      return null;
    }
  }

  /**
   * Try to restore the last context. Returns the context if successful, null otherwise.
   * This should be called after IBL is established.
   */
  restoreLastContext(): RecentContext | null {
    const last = this.getLastValidContext();
    if (!last) return null;

    // The caller (orchestrator) will handle the actual workspace switch
    // We just return the context to restore
    return last;
  }

  // ══════════════════════════════════
  // CLEAR
  // ══════════════════════════════════

  /**
   * Clear all history (e.g., on account switch).
   */
  clear(): void {
    this._recentContexts = [];
    this._contextEnteredAt = null;
    try {
      localStorage.removeItem(this._storageKey(RECENT_CONTEXTS_KEY));
      localStorage.removeItem(this._storageKey(LAST_CONTEXT_KEY));
    } catch { /* ok */ }
  }

  // ══════════════════════════════════
  // PERSISTENCE (per-user)
  // ══════════════════════════════════

  private _storageKey(base: string): string {
    return this._userId ? `${base}:${this._userId}` : base;
  }

  private _load(): void {
    try {
      const raw = localStorage.getItem(this._storageKey(RECENT_CONTEXTS_KEY));
      if (raw) this._recentContexts = JSON.parse(raw);
    } catch { /* corrupted */ }
  }

  private _persist(): void {
    try {
      localStorage.setItem(this._storageKey(RECENT_CONTEXTS_KEY), JSON.stringify(this._recentContexts));
    } catch { /* storage full */ }
  }

  private _persistLastContext(ctx: RecentContext): void {
    try {
      localStorage.setItem(this._storageKey(LAST_CONTEXT_KEY), JSON.stringify(ctx));
    } catch { /* storage full */ }
  }
}
