/**
 * ApiManagementEngine — Core orchestration engine for PAMS.
 *
 * Subsystems:
 *  ├── ApiGatewayController   — Routes/validates API requests
 *  ├── ApiClientRegistry      — CRUD for API client applications
 *  ├── ApiKeyManager          — Key generation, rotation, revocation
 *  ├── ApiScopeResolver       — Maps scopes to permissions via Security Kernel
 *  ├── ApiRateLimiter         — Enforces rate limits per plan tier
 *  ├── ApiUsageTracker        — Logs and aggregates API usage
 *  ├── ApiVersionRouter       — Routes requests to correct API version
 *  └── ApiAnalyticsService    — Dashboards, metrics, and alerting
 */

// ── Types ──

export interface ApiGatewayRequest {
  apiKeyPrefix: string;
  apiKeyHash: string;
  endpoint: string;
  method: string;
  version: string;
  scopes: string[];
  ip: string;
  userAgent?: string;
}

export interface ApiGatewayResponse {
  allowed: boolean;
  reason?: string;
  clientId?: string;
  tenantId?: string;
  resolvedVersion?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
}

export interface KeyGenerationResult {
  keyId: string;
  fullKey: string;       // Only returned once at creation time
  prefix: string;
  hash: string;
  expiresAt?: string;
}

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  resetAt: number;         // Unix timestamp
  retryAfterMs?: number;
}

export interface UsageSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  p95ResponseTimeMs: number;
  rateLimitedRequests: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  errorBreakdown: Record<string, number>;
}

// ── ApiGatewayController ──

export const ApiGatewayController = {
  /**
   * Validate an incoming API request against keys, scopes, rate limits, and version.
   */
  async validateRequest(request: ApiGatewayRequest): Promise<ApiGatewayResponse> {
    // This is the client-side model — actual validation happens in the edge function.
    // This controller is used for dry-run/sandbox testing.
    return {
      allowed: true,
      reason: 'client-side-dry-run',
      resolvedVersion: request.version || 'v1',
    };
  },
};

// ── ApiClientRegistry ──

export const ApiClientRegistry = {
  validateClientData(data: { name?: string; client_type?: string }): string[] {
    const errors: string[] = [];
    if (!data.name || data.name.trim().length < 3) {
      errors.push('Client name must be at least 3 characters');
    }
    if (data.name && data.name.length > 100) {
      errors.push('Client name must be at most 100 characters');
    }
    const validTypes = ['external', 'internal', 'partner', 'sandbox'];
    if (data.client_type && !validTypes.includes(data.client_type)) {
      errors.push(`Invalid client type. Must be one of: ${validTypes.join(', ')}`);
    }
    return errors;
  },
};

// ── ApiKeyManager ──

export const ApiKeyManager = {
  /**
   * Generate a cryptographically secure API key.
   * The full key is returned ONCE — only the hash is stored.
   */
  generateKeyParts(): { prefix: string; secret: string; full: string } {
    const prefix = 'pams_' + randomHex(4) + '_';
    const secret = randomHex(32);
    const full = prefix + secret;
    return { prefix, secret, full };
  },

  /**
   * SHA-256 hash for storage.
   */
  async hashKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Mask a key for display (show prefix + last 4 chars).
   */
  maskKey(prefix: string): string {
    return `${prefix}${'•'.repeat(24)}`;
  },

  /**
   * Check if a key has expired.
   */
  isExpired(expiresAt?: string): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  },
};

// ── ApiScopeResolver ──

export const ApiScopeResolver = {
  /**
   * Check if requested scopes are all within the granted set.
   */
  validateScopes(requested: string[], granted: string[]): { valid: boolean; missing: string[] } {
    const grantedSet = new Set(granted);
    const missing = requested.filter(s => !grantedSet.has(s) && !matchesWildcard(s, granted));
    return { valid: missing.length === 0, missing };
  },

  /**
   * Categorize scopes by risk level.
   */
  categorizeByRisk(scopes: Array<{ code: string; risk_level: string }>): Record<string, string[]> {
    const result: Record<string, string[]> = { low: [], medium: [], high: [], critical: [] };
    for (const scope of scopes) {
      result[scope.risk_level]?.push(scope.code);
    }
    return result;
  },
};

// ── ApiRateLimiter ──

const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

export const ApiRateLimiter = {
  /**
   * Check rate limit for a given key + scope combination.
   */
  check(keyId: string, limit: number, windowMs: number = 60_000): RateLimitCheck {
    const now = Date.now();
    const entry = rateLimitStore.get(keyId);

    if (!entry || now - entry.windowStart > windowMs) {
      rateLimitStore.set(keyId, { count: 1, windowStart: now });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    if (entry.count >= limit) {
      const retryAfterMs = windowMs - (now - entry.windowStart);
      return { allowed: false, remaining: 0, resetAt: entry.windowStart + windowMs, retryAfterMs };
    }

    entry.count++;
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.windowStart + windowMs };
  },

  /**
   * Reset rate limit for a key.
   */
  reset(keyId: string): void {
    rateLimitStore.delete(keyId);
  },

  /**
   * Get the appropriate rate limit config for a plan tier.
   */
  getConfigForTier(tier: string, configs: Array<{ plan_tier: string; requests_per_minute: number }>): number {
    const config = configs.find(c => c.plan_tier === tier);
    return config?.requests_per_minute ?? 10; // fallback to free tier
  },
};

// ── ApiUsageTracker ──

export const ApiUsageTracker = {
  /**
   * Build a usage summary from raw logs.
   */
  summarize(logs: Array<{
    status_code: number;
    response_time_ms?: number;
    endpoint: string;
    error_code?: string;
  }>): UsageSummary {
    const total = logs.length;
    const successful = logs.filter(l => l.status_code >= 200 && l.status_code < 400).length;
    const failed = total - successful;
    const rateLimited = logs.filter(l => l.status_code === 429).length;

    const times = logs.map(l => l.response_time_ms ?? 0).filter(t => t > 0).sort((a, b) => a - b);
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const p95 = times.length ? times[Math.floor(times.length * 0.95)] ?? 0 : 0;

    // Top endpoints
    const endpointCounts = new Map<string, number>();
    for (const log of logs) {
      endpointCounts.set(log.endpoint, (endpointCounts.get(log.endpoint) ?? 0) + 1);
    }
    const topEndpoints = [...endpointCounts.entries()]
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Error breakdown
    const errorBreakdown: Record<string, number> = {};
    for (const log of logs) {
      if (log.error_code) {
        errorBreakdown[log.error_code] = (errorBreakdown[log.error_code] ?? 0) + 1;
      }
    }

    return {
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      avgResponseTimeMs: Math.round(avg),
      p95ResponseTimeMs: Math.round(p95),
      rateLimitedRequests: rateLimited,
      topEndpoints,
      errorBreakdown,
    };
  },
};

// ── ApiVersionRouter ──

export const ApiVersionRouter = {
  /**
   * Resolve the target version for a request.
   */
  resolve(
    requested: string,
    versions: Array<{ version: string; status: string }>
  ): { version: string; status: string; warning?: string } | null {
    const match = versions.find(v => v.version === requested);
    if (!match) return null;

    if (match.status === 'sunset') {
      return null; // No longer available
    }

    const warning = match.status === 'deprecated'
      ? `API version ${requested} is deprecated. Please migrate to the latest version.`
      : undefined;

    return { version: match.version, status: match.status, warning };
  },

  /**
   * Get the latest active version.
   */
  getLatest(versions: Array<{ version: string; status: string }>): string {
    const active = versions.filter(v => v.status === 'active');
    return active.length > 0 ? active[active.length - 1].version : 'v1';
  },
};

// ── ApiAnalyticsService ──

export const ApiAnalyticsService = {
  /**
   * Calculate health score (0-100) based on error rate and latency.
   */
  calculateHealthScore(summary: UsageSummary): number {
    if (summary.totalRequests === 0) return 100;

    const errorRate = summary.failedRequests / summary.totalRequests;
    const latencyScore = Math.max(0, 100 - (summary.p95ResponseTimeMs / 10));
    const errorScore = Math.max(0, 100 - (errorRate * 200));
    const rateLimitScore = Math.max(0, 100 - (summary.rateLimitedRequests / summary.totalRequests * 200));

    return Math.round((errorScore * 0.4 + latencyScore * 0.3 + rateLimitScore * 0.3));
  },

  /**
   * Determine alert thresholds.
   */
  getAlerts(summary: UsageSummary): Array<{ level: 'info' | 'warn' | 'error'; message: string }> {
    const alerts: Array<{ level: 'info' | 'warn' | 'error'; message: string }> = [];

    if (summary.totalRequests === 0) return alerts;

    const errorRate = summary.failedRequests / summary.totalRequests;
    if (errorRate > 0.1) {
      alerts.push({ level: 'error', message: `High error rate: ${(errorRate * 100).toFixed(1)}%` });
    } else if (errorRate > 0.05) {
      alerts.push({ level: 'warn', message: `Elevated error rate: ${(errorRate * 100).toFixed(1)}%` });
    }

    if (summary.p95ResponseTimeMs > 5000) {
      alerts.push({ level: 'error', message: `P95 latency exceeds 5s: ${summary.p95ResponseTimeMs}ms` });
    } else if (summary.p95ResponseTimeMs > 2000) {
      alerts.push({ level: 'warn', message: `P95 latency exceeds 2s: ${summary.p95ResponseTimeMs}ms` });
    }

    if (summary.rateLimitedRequests > 0) {
      alerts.push({ level: 'info', message: `${summary.rateLimitedRequests} requests were rate-limited` });
    }

    return alerts;
  },
};

// ── Helpers ──

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

function matchesWildcard(scope: string, granted: string[]): boolean {
  const [resource] = scope.split(':');
  return granted.some(g => g === `${resource}:*` || g === '*');
}
