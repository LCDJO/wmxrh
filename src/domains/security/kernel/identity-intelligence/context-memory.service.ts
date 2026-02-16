/**
 * ContextMemoryService — Manages recent context history.
 *
 * Responsibilities:
 *   - Record context visits with duration tracking
 *   - Persist/restore from localStorage
 *   - Provide MRU (Most Recently Used) list for quick switching
 *   - Track context entry time for duration calculation
 *
 * Part of the Identity Intelligence Layer decomposition.
 */

import { identityBoundary } from '../identity-boundary';
import type { RecentContext } from './types';

const MAX_RECENT_CONTEXTS = 10;
const RECENT_CONTEXTS_KEY = 'iil:recent_contexts';

export class ContextMemoryService {
  private _recentContexts: RecentContext[] = [];
  private _contextEnteredAt: number | null = null;

  constructor() {
    this._load();
  }

  /**
   * Get the recent context history (MRU order).
   */
  get recentContexts(): readonly RecentContext[] {
    return this._recentContexts;
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

    // Remove duplicate
    this._recentContexts = this._recentContexts.filter(
      c => c.tenantId !== entry.tenantId,
    );

    // Add to front (MRU)
    this._recentContexts.unshift(entry);

    // Trim
    if (this._recentContexts.length > MAX_RECENT_CONTEXTS) {
      this._recentContexts = this._recentContexts.slice(0, MAX_RECENT_CONTEXTS);
    }

    this._persist();
  }

  /**
   * Clear all history (e.g., on account switch).
   */
  clear(): void {
    this._recentContexts = [];
    this._contextEnteredAt = null;
    try { localStorage.removeItem(RECENT_CONTEXTS_KEY); } catch { /* ok */ }
  }

  // ── Persistence ──

  private _load(): void {
    try {
      const raw = localStorage.getItem(RECENT_CONTEXTS_KEY);
      if (raw) this._recentContexts = JSON.parse(raw);
    } catch { /* corrupted */ }
  }

  private _persist(): void {
    try {
      localStorage.setItem(RECENT_CONTEXTS_KEY, JSON.stringify(this._recentContexts));
    } catch { /* storage full */ }
  }
}
