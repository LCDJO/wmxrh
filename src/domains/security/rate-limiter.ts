/**
 * Security Middleware - Client-Side Rate Limiter
 * 
 * Prevents abuse by throttling mutations per action key.
 * This is a first line of defense — backend RLS provides the real protection.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 30;

interface RateLimitConfig {
  windowMs?: number;
  maxRequests?: number;
}

/**
 * Check if an action is rate-limited.
 * Returns { allowed: boolean, retryAfterMs?: number }
 */
export function checkRateLimit(
  actionKey: string,
  config?: RateLimitConfig
): { allowed: boolean; retryAfterMs?: number } {
  const windowMs = config?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = config?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const now = Date.now();

  const entry = store.get(actionKey);

  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    store.set(actionKey, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * Reset rate limit for a specific action.
 */
export function resetRateLimit(actionKey: string) {
  store.delete(actionKey);
}

/**
 * Rate limit presets for different mutation types.
 */
export const RATE_LIMITS = {
  /** Creating entities (employees, companies, etc.) */
  create: { windowMs: 60_000, maxRequests: 20 },
  /** Bulk operations */
  bulk: { windowMs: 60_000, maxRequests: 5 },
  /** Sensitive ops (salary changes, role assignments) */
  sensitive: { windowMs: 60_000, maxRequests: 10 },
  /** Auth operations (login, signup) */
  auth: { windowMs: 300_000, maxRequests: 10 },
} as const;
