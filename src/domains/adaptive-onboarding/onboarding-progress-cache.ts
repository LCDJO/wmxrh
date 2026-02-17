/**
 * OnboardingProgressCache — localStorage-backed incremental cache.
 *
 * Avoids recalculating onboarding state on every login by persisting
 * a compact snapshot of progress. The cache is invalidated when:
 *   - A step is completed or skipped (write-through)
 *   - The flow version changes (schema migration)
 *   - TTL expires (default: 24h)
 *
 * PERFORMANCE CONTRACT:
 *   - getProgress(): O(1) from cache, no recompute
 *   - markStep*(): O(1) write-through + persist
 *   - resolveFlow(): Only on cache miss or invalidation
 */

import type { OnboardingProgress, OnboardingFlow } from './types';

// ── Cache key ───────────────────────────────────────────────────

const CACHE_PREFIX = 'onboarding_progress_';
const CACHE_VERSION = 1;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedProgressSnapshot {
  version: number;
  tenant_id: string;
  completed_steps: string[];
  skipped_steps: string[];
  current_step_id: string | null;
  completion_pct: number;
  current_phase: string;
  flow_step_count: number;
  last_activity_at: number;
  cached_at: number;
  ttl_ms: number;
}

// ── Cache operations ────────────────────────────────────────────

function cacheKey(tenantId: string): string {
  return `${CACHE_PREFIX}v${CACHE_VERSION}_${tenantId}`;
}

function isStorageAvailable(): boolean {
  try {
    const test = '__onboarding_test__';
    localStorage.setItem(test, '1');
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function saveProgressToCache(progress: OnboardingProgress, ttlMs = DEFAULT_TTL_MS): void {
  if (!isStorageAvailable()) return;

  const snapshot: CachedProgressSnapshot = {
    version: CACHE_VERSION,
    tenant_id: progress.tenant_id,
    completed_steps: progress.completed_steps,
    skipped_steps: progress.skipped_steps,
    current_step_id: progress.current_step_id,
    completion_pct: progress.flow.completion_pct,
    current_phase: progress.flow.current_phase,
    flow_step_count: progress.flow.steps.length,
    last_activity_at: progress.last_activity_at,
    cached_at: Date.now(),
    ttl_ms: ttlMs,
  };

  try {
    localStorage.setItem(cacheKey(progress.tenant_id), JSON.stringify(snapshot));
  } catch {
    // Storage full — silently fail, will recompute
  }
}

export function loadProgressFromCache(tenantId: string): CachedProgressSnapshot | null {
  if (!isStorageAvailable()) return null;

  try {
    const raw = localStorage.getItem(cacheKey(tenantId));
    if (!raw) return null;

    const snapshot: CachedProgressSnapshot = JSON.parse(raw);

    // Version mismatch → invalidate
    if (snapshot.version !== CACHE_VERSION) {
      invalidateCache(tenantId);
      return null;
    }

    // TTL expired → invalidate
    if (Date.now() - snapshot.cached_at > snapshot.ttl_ms) {
      invalidateCache(tenantId);
      return null;
    }

    return snapshot;
  } catch {
    invalidateCache(tenantId);
    return null;
  }
}

export function invalidateCache(tenantId: string): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.removeItem(cacheKey(tenantId));
  } catch {
    // ignore
  }
}

/**
 * Check if cache is still valid for a given flow.
 * Invalidates if the flow structure changed (e.g. new steps added).
 */
export function isCacheValidForFlow(tenantId: string, flow: OnboardingFlow): boolean {
  const snapshot = loadProgressFromCache(tenantId);
  if (!snapshot) return false;
  return snapshot.flow_step_count === flow.steps.length;
}

/**
 * Hydrate an OnboardingProgress from cache + flow.
 * Merges cached step statuses back into the flow object.
 */
export function hydrateProgressFromCache(
  snapshot: CachedProgressSnapshot,
  flow: OnboardingFlow,
): OnboardingProgress {
  // Restore step statuses
  for (const step of flow.steps) {
    if (snapshot.completed_steps.includes(step.id)) {
      step.status = 'completed';
    } else if (snapshot.skipped_steps.includes(step.id)) {
      step.status = 'skipped';
    } else if (step.id === snapshot.current_step_id) {
      step.status = 'active';
    } else {
      step.status = 'pending';
    }
  }

  flow.completion_pct = snapshot.completion_pct;
  flow.current_phase = snapshot.current_phase as OnboardingFlow['current_phase'];

  if (snapshot.completion_pct >= 100) {
    flow.completed_at = snapshot.last_activity_at;
  }

  return {
    tenant_id: snapshot.tenant_id,
    flow,
    completed_steps: [...snapshot.completed_steps],
    skipped_steps: [...snapshot.skipped_steps],
    current_step_id: snapshot.current_step_id,
    last_activity_at: snapshot.last_activity_at,
  };
}

/**
 * Quick check: is onboarding already complete for this tenant?
 * O(1) from cache — avoids full flow resolution.
 */
export function isOnboardingCompleteFromCache(tenantId: string): boolean | null {
  const snapshot = loadProgressFromCache(tenantId);
  if (!snapshot) return null; // cache miss — caller must resolve
  return snapshot.completion_pct >= 100;
}
