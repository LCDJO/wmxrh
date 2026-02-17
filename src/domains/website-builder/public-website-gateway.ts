/**
 * PublicWebsiteGateway — Security boundary for the institutional website.
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  SECURITY MODEL (WEBSITE-SPECIFIC)                                    ║
 * ║                                                                       ║
 * ║  1. Completely isolated from Security Kernel / IAM / Platform APIs    ║
 * ║  2. Only whitelisted, read-only endpoints for published content       ║
 * ║  3. Public tokens are scope-limited and short-lived (15 min)          ║
 * ║  4. Stricter rate limiting than landing pages (institutional = less   ║
 * ║     dynamic, less traffic variance)                                   ║
 * ║  5. No authenticated user context — zero auth token leakage           ║
 * ║  6. Mutations BLOCKED entirely (no conversion-event equivalent)       ║
 * ║                                                                       ║
 * ║  Architecture:                                                        ║
 * ║    Browser → PublicWebsiteGateway → Edge Function (public-website)    ║
 * ║                                                                       ║
 * ║  NEVER imports from:                                                  ║
 * ║    - platform-permissions, PlatformGuard, SecurityKernel              ║
 * ║    - supabase/client (for direct DB access)                           ║
 * ║    - Any tenant/billing/IAM module                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

// ── Allowed endpoints (strict whitelist) ────────────────────────
export type WebsitePublicEndpoint =
  | 'website-page'       // GET published website page by slug
  | 'website-structure'  // GET site navigation / structure
  | 'website-seo'        // GET SEO metadata for a page
  | 'sitemap'            // GET auto-generated sitemap.xml data
  | 'robots'             // GET dynamic robots.txt
  | 'health';            // GET health check

const ALLOWED_ENDPOINTS: Set<WebsitePublicEndpoint> = new Set([
  'website-page',
  'website-structure',
  'website-seo',
  'sitemap',
  'robots',
  'health',
]);

// ── Blocked patterns (defense-in-depth) ─────────────────────────
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
  /^landing/i,    // Landing pages have their own gateway
  /^growth/i,
  /^kernel/i,
  /^impersona/i,
];

// ── Rate Limiting (stricter for institutional site) ─────────────
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 40;           // 40 req/min (institutional pages are cacheable)

class WebsiteRateLimiter {
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

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) this.store.delete(key);
    }
  }
}

// ── Public Token (website-scoped, short-lived) ──────────────────
export interface WebsitePublicToken {
  type: 'website_public';
  fingerprint: string;
  issuedAt: number;
  expiresAt: number;
  scope: readonly WebsitePublicEndpoint[];
}

export function createWebsitePublicToken(fingerprint: string): WebsitePublicToken {
  const now = Date.now();
  return {
    type: 'website_public',
    fingerprint,
    issuedAt: now,
    expiresAt: now + 15 * 60 * 1000, // 15 minutes (shorter than landing gateway)
    scope: [...ALLOWED_ENDPOINTS],
  };
}

export function isWebsiteTokenValid(token: WebsitePublicToken): boolean {
  return token.type === 'website_public' && Date.now() < token.expiresAt;
}

// ── Request / Response ──────────────────────────────────────────
export interface WebsitePublicRequest {
  endpoint: string;
  params?: Record<string, string>;
  fingerprint: string;
}

export interface WebsitePublicResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { cached: boolean; rateLimit: { remaining: number; resetIn: number } };
}

// ── Gateway ─────────────────────────────────────────────────────
export class PublicWebsiteGateway {
  private rateLimiter = new WebsiteRateLimiter();
  private tokenCache = new Map<string, WebsitePublicToken>();
  private responseCache = new Map<string, { data: unknown; expiresAt: number }>();

  /**
   * Process a website public request through the security pipeline:
   *  1. Validate endpoint whitelist
   *  2. Block forbidden patterns
   *  3. Reject all mutations (POST/PUT/DELETE)
   *  4. Issue/validate scoped token
   *  5. Rate limit
   *  6. Cache check (10 min TTL — institutional content is stable)
   *  7. Proxy to dedicated edge function
   */
  async process<T = unknown>(request: WebsitePublicRequest): Promise<WebsitePublicResponse<T>> {
    // 1. Whitelist
    if (!ALLOWED_ENDPOINTS.has(request.endpoint as WebsitePublicEndpoint)) {
      return {
        success: false,
        error: { code: 'ENDPOINT_NOT_FOUND', message: 'This endpoint is not available.' },
      };
    }

    // 2. Blocked patterns (defense-in-depth)
    const fullPath = `${request.endpoint}/${Object.values(request.params ?? {}).join('/')}`;
    if (BLOCKED_PATTERNS.some(p => p.test(fullPath))) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      };
    }

    // 3. Token management
    let token = this.tokenCache.get(request.fingerprint);
    if (!token || !isWebsiteTokenValid(token)) {
      token = createWebsitePublicToken(request.fingerprint);
      this.tokenCache.set(request.fingerprint, token);
    }

    // 4. Rate limit
    const rateResult = this.rateLimiter.check(request.fingerprint);
    if (!rateResult.allowed) {
      return {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
        meta: { cached: false, rateLimit: rateResult },
      };
    }

    // 5. Cache check (10 min TTL for institutional content)
    const cacheKey = `ws:${request.endpoint}:${JSON.stringify(request.params)}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return {
        success: true,
        data: cached.data as T,
        meta: { cached: true, rateLimit: rateResult },
      };
    }

    // 6. Proxy to edge function
    try {
      const data = await this.callEdgeFunction<T>(request, token);

      if (data !== null) {
        this.responseCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 min cache
        });
      }

      return {
        success: true,
        data,
        meta: { cached: false, rateLimit: rateResult },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal gateway error.';
      return {
        success: false,
        error: { code: 'GATEWAY_ERROR', message },
        meta: { cached: false, rateLimit: rateResult },
      };
    }
  }

  /** Proxy to the public-website edge function (isolated from public-api) */
  private async callEdgeFunction<T>(
    request: WebsitePublicRequest,
    token: WebsitePublicToken,
  ): Promise<T | null> {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) throw new Error('Project ID not configured.');

    const url = `https://${projectId}.supabase.co/functions/v1/public-website`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Website-Token': JSON.stringify({
          fingerprint: token.fingerprint,
          expiresAt: token.expiresAt,
          type: token.type,
        }),
      },
      body: JSON.stringify({
        endpoint: request.endpoint,
        params: request.params ?? {},
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error ?? `HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.data as T;
  }

  /** Invalidate cache for a specific endpoint (used after publish) */
  invalidateCache(endpoint?: WebsitePublicEndpoint): void {
    if (!endpoint) {
      this.responseCache.clear();
      return;
    }
    for (const key of this.responseCache.keys()) {
      if (key.startsWith(`ws:${endpoint}:`)) {
        this.responseCache.delete(key);
      }
    }
  }

  /** Periodic cleanup */
  cleanup(): void {
    this.rateLimiter.cleanup();
    const now = Date.now();
    for (const [key, entry] of this.responseCache) {
      if (now >= entry.expiresAt) this.responseCache.delete(key);
    }
    for (const [key, token] of this.tokenCache) {
      if (!isWebsiteTokenValid(token)) this.tokenCache.delete(key);
    }
  }
}

export const publicWebsiteGateway = new PublicWebsiteGateway();
