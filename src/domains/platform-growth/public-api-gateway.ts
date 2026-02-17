/**
 * PublicAPIGateway — Security boundary between the public website and the platform.
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  SECURITY MODEL                                                       ║
 * ║                                                                       ║
 * ║  1. Public website runs COMPLETELY SEPARATE from authenticated area   ║
 * ║  2. Only whitelisted endpoints are exposed (landing pages, site meta) ║
 * ║  3. Platform APIs (tenants, billing, users, etc.) are NEVER exposed   ║
 * ║  4. Rate limiting per IP/fingerprint                                  ║
 * ║  5. No auth tokens leak to the public surface                         ║
 * ║  6. Read-only access — no mutations allowed from public               ║
 * ║                                                                       ║
 * ║  Architecture:                                                        ║
 * ║    Browser (public) → PublicAPIGateway → Edge Function (public-api)   ║
 * ║                                                                       ║
 * ║  The gateway NEVER calls supabase client directly for sensitive data.  ║
 * ║  It proxies through a dedicated edge function that enforces isolation. ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

// ── Allowed public endpoints (whitelist) ────────────────────────
export type PublicEndpoint =
  | 'landing-page'       // GET published landing page by slug
  | 'site-meta'          // GET site metadata (SEO, OG tags)
  | 'conversion-event'   // POST conversion tracking (limited payload)
  | 'referral-validate'  // GET validate a referral code
  | 'health';            // GET health check

const ALLOWED_ENDPOINTS: Set<PublicEndpoint> = new Set([
  'landing-page',
  'site-meta',
  'conversion-event',
  'referral-validate',
  'health',
]);

// ── Blocked patterns (never exposed) ────────────────────────────
const BLOCKED_PATTERNS = [
  /^platform/i,
  /^admin/i,
  /^tenant/i,
  /^billing/i,
  /^user/i,
  /^auth/i,
  /^iam/i,
  /^security/i,
  /^audit/i,
  /^employee/i,
  /^salary/i,
  /^compliance/i,
];

// ── Rate Limiting ───────────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60;           // 60 requests per minute per key

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();

  check(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW_MS };
    }

    entry.count++;
    const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
    const resetIn = entry.resetAt - now;

    if (entry.count > RATE_LIMIT_MAX) {
      return { allowed: false, remaining: 0, resetIn };
    }

    return { allowed: true, remaining, resetIn };
  }

  /** Periodic cleanup of expired entries */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) this.store.delete(key);
    }
  }
}

// ── Public Token (limited, non-authenticated) ───────────────────
export interface PublicToken {
  type: 'public';
  fingerprint: string;
  issuedAt: number;
  expiresAt: number;
  scope: readonly PublicEndpoint[];
}

export function createPublicToken(fingerprint: string): PublicToken {
  const now = Date.now();
  return {
    type: 'public',
    fingerprint,
    issuedAt: now,
    expiresAt: now + 30 * 60 * 1000, // 30 minutes
    scope: [...ALLOWED_ENDPOINTS],
  };
}

export function isPublicTokenValid(token: PublicToken): boolean {
  return token.type === 'public' && Date.now() < token.expiresAt;
}

// ── Request / Response types ────────────────────────────────────
export interface PublicAPIRequest {
  endpoint: string;
  method: 'GET' | 'POST';
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  fingerprint: string;
}

export interface PublicAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { cached: boolean; rateLimit: { remaining: number; resetIn: number } };
}

// ── Gateway ─────────────────────────────────────────────────────
export class PublicAPIGateway {
  private rateLimiter = new RateLimiter();
  private tokenCache = new Map<string, PublicToken>();
  private responseCache = new Map<string, { data: unknown; expiresAt: number }>();

  /**
   * Process a public API request through the security pipeline:
   *  1. Validate endpoint is whitelisted
   *  2. Check for blocked patterns
   *  3. Issue/validate limited token
   *  4. Rate limit check
   *  5. Check cache
   *  6. Proxy to edge function
   */
  async process<T = unknown>(request: PublicAPIRequest): Promise<PublicAPIResponse<T>> {
    // 1. Whitelist check
    if (!ALLOWED_ENDPOINTS.has(request.endpoint as PublicEndpoint)) {
      return {
        success: false,
        error: { code: 'ENDPOINT_NOT_FOUND', message: 'This endpoint is not available on the public API.' },
      };
    }

    // 2. Blocked patterns
    const fullPath = `${request.endpoint}/${Object.values(request.params ?? {}).join('/')}`;
    if (BLOCKED_PATTERNS.some(p => p.test(fullPath))) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      };
    }

    // 3. Mutation guard — only conversion-event allows POST
    if (request.method === 'POST' && request.endpoint !== 'conversion-event') {
      return {
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET requests are allowed on this endpoint.' },
      };
    }

    // 4. Token management
    let token = this.tokenCache.get(request.fingerprint);
    if (!token || !isPublicTokenValid(token)) {
      token = createPublicToken(request.fingerprint);
      this.tokenCache.set(request.fingerprint, token);
    }

    // 5. Rate limit
    const rateResult = this.rateLimiter.check(request.fingerprint);
    if (!rateResult.allowed) {
      return {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
        meta: { cached: false, rateLimit: rateResult },
      };
    }

    // 6. Cache check (GET only, 5 min TTL)
    if (request.method === 'GET') {
      const cacheKey = `${request.endpoint}:${JSON.stringify(request.params)}`;
      const cached = this.responseCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return {
          success: true,
          data: cached.data as T,
          meta: { cached: true, rateLimit: rateResult },
        };
      }
    }

    // 7. Proxy to edge function
    try {
      const data = await this.callEdgeFunction<T>(request, token);

      // Cache GET responses for 5 minutes
      if (request.method === 'GET' && data !== null) {
        const cacheKey = `${request.endpoint}:${JSON.stringify(request.params)}`;
        this.responseCache.set(cacheKey, { data, expiresAt: Date.now() + 5 * 60 * 1000 });
      }

      return {
        success: true,
        data,
        meta: { cached: false, rateLimit: rateResult },
      };
    } catch (err: any) {
      return {
        success: false,
        error: { code: 'GATEWAY_ERROR', message: err.message ?? 'Internal gateway error.' },
        meta: { cached: false, rateLimit: rateResult },
      };
    }
  }

  /** Call the public-api edge function */
  private async callEdgeFunction<T>(request: PublicAPIRequest, token: PublicToken): Promise<T | null> {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) {
      throw new Error('Project ID not configured.');
    }

    const url = `https://${projectId}.supabase.co/functions/v1/public-api`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Public-Token': JSON.stringify({
          fingerprint: token.fingerprint,
          expiresAt: token.expiresAt,
        }),
      },
      body: JSON.stringify({
        endpoint: request.endpoint,
        method: request.method,
        params: request.params ?? {},
        body: request.body ?? {},
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error ?? `HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.data as T;
  }

  /** Clear expired cache and rate limit entries */
  cleanup(): void {
    this.rateLimiter.cleanup();
    const now = Date.now();
    for (const [key, entry] of this.responseCache) {
      if (now >= entry.expiresAt) this.responseCache.delete(key);
    }
    for (const [key, token] of this.tokenCache) {
      if (!isPublicTokenValid(token)) this.tokenCache.delete(key);
    }
  }
}

export const publicAPIGateway = new PublicAPIGateway();
