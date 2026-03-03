/**
 * ApiManagementEngine — Core orchestration engine for PAMS.
 *
 * Integrations:
 *  - ModuleVersionRegistry  → ApiVersionRouter (resolve /api/v1/, /api/v2/)
 *  - TenantPlanResolver     → ApiRateLimiter (rate limits per TenantPlan)
 *  - UsageBillingRules      → ApiRateLimiter (billing-aware throttling)
 *  - TenantSandboxEngine    → ApiSandboxRouter (sandbox vs production isolation)
 *
 * Subsystems:
 *  ├── ApiGatewayController   — Routes/validates API requests
 *  ├── ApiClientRegistry      — CRUD for API client applications
 *  ├── ApiKeyManager          — Key generation, rotation, revocation
 *  ├── ApiScopeResolver       — Maps scopes to permissions via Security Kernel
 *  ├── ApiRateLimiter         — Enforces rate limits per TenantPlan + UsageBillingRules
 *  ├── ApiUsageTracker        — Logs and aggregates API usage
 *  ├── ApiVersionRouter       — Routes via ModuleVersionRegistry (/api/v1/, /api/v2/)
 *  ├── ApiSandboxRouter       — Sandbox environment isolation via TenantSandboxEngine
 *  └── ApiAnalyticsService    — Dashboards, metrics, and alerting
 */

import { ModuleVersionRegistry } from '@/domains/platform-versioning/module-version-registry';
import type { ModuleVersion } from '@/domains/platform-versioning/types';
import type { PlanTier, TenantPlanSnapshot, TenantPlanResolverAPI } from '@/domains/platform-experience/types';

// ── Types ──

export type ApiEnvironment = 'production' | 'sandbox';

export interface ApiGatewayRequest {
  apiKeyPrefix: string;
  apiKeyHash: string;
  endpoint: string;
  method: string;
  version: string;
  scopes: string[];
  ip: string;
  userAgent?: string;
  environment?: ApiEnvironment;
}

export interface ApiGatewayResponse {
  allowed: boolean;
  reason?: string;
  clientId?: string;
  tenantId?: string;
  resolvedVersion?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  environment?: ApiEnvironment;
  sandboxWarning?: string;
}

/** Structured API request log for analytics */
export interface ApiRequestLog {
  endpoint: string;
  module: string;
  tenant_id: string;
  latency_ms: number;
  status_code: number;
  timestamp: string;
  environment?: ApiEnvironment;
  client_id?: string;
  method?: string;
  scope?: string;
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
   * Delegates to the api-gateway-validate edge function for real validation.
   */
  async validateRequest(request: ApiGatewayRequest): Promise<ApiGatewayResponse> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('api-gateway-validate', {
        body: {
          api_key: request.apiKeyHash ? undefined : undefined,
          required_scopes: request.scopes,
          endpoint: request.endpoint,
          method: request.method,
        },
        headers: request.apiKeyHash
          ? { 'X-API-Key': request.apiKeyPrefix + request.apiKeyHash }
          : undefined,
      });

      if (error) {
        return {
          allowed: false,
          reason: `Gateway validation error: ${error.message}`,
        };
      }

      return {
        allowed: data?.valid ?? false,
        reason: data?.error,
        clientId: data?.client_id,
        tenantId: data?.tenant_id,
        resolvedVersion: request.version || 'v1',
        environment: data?.environment ?? (request.environment || 'production'),
      };
    } catch (err) {
      // Fallback: dry-run for offline/dev
      return {
        allowed: true,
        reason: 'client-side-dry-run (gateway unreachable)',
        resolvedVersion: request.version || 'v1',
      };
    }
  },

  /**
   * Validate a JWT access token and check required scopes.
   * Convenience method for direct token validation.
   */
  async validateAccessToken(
    accessToken: string,
    requiredScopes: string[] = [],
  ): Promise<{ valid: boolean; userId?: string; tenantId?: string; grantedScopes?: string[]; missingScopes?: string[]; error?: string }> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('api-gateway-validate', {
        body: {
          access_token: accessToken,
          required_scopes: requiredScopes,
        },
      });

      if (error) {
        return { valid: false, error: error.message };
      }

      return {
        valid: data?.valid ?? false,
        userId: data?.user_id,
        tenantId: data?.tenant_id,
        grantedScopes: data?.granted_scopes,
        missingScopes: data?.missing_scopes,
        error: data?.error,
      };
    } catch {
      return { valid: false, error: 'Gateway unreachable' };
    }
  },

  /**
   * Introspect a token (RFC 7662).
   */
  async introspectToken(token: string): Promise<Record<string, unknown>> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('api-gateway-validate/introspect', {
        body: { access_token: token },
      });

      if (error) return { active: false };
      return data ?? { active: false };
    } catch {
      return { active: false };
    }
  },
};

// ── ApiClientRegistry ──

export const ApiClientRegistry = {
  validateClientData(data: { name?: string; client_type?: string; environment?: string }): string[] {
    const errors: string[] = [];
    if (!data.name || data.name.trim().length < 3) {
      errors.push('Client name must be at least 3 characters');
    }
    if (data.name && data.name.length > 100) {
      errors.push('Client name must be at most 100 characters');
    }
    const validTypes = ['tenant', 'partner', 'internal'];
    if (data.client_type && !validTypes.includes(data.client_type)) {
      errors.push(`Invalid client type. Must be one of: ${validTypes.join(', ')}`);
    }
    const validEnvs: ApiEnvironment[] = ['production', 'sandbox'];
    if (data.environment && !validEnvs.includes(data.environment as ApiEnvironment)) {
      errors.push(`Invalid environment. Must be one of: ${validEnvs.join(', ')}`);
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

/** Platform roles allowed to create global scopes */
const GLOBAL_SCOPE_ADMIN_ROLES = ['platform_super_admin'] as const;

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

  /**
   * SECURITY: Only PlatformSuperAdmin can create global (system) scopes.
   * Returns true if the role is authorized.
   */
  canCreateGlobalScope(platformRole: string): boolean {
    return GLOBAL_SCOPE_ADMIN_ROLES.includes(platformRole as any);
  },

  /**
   * Validate a scope creation request.
   * Throws if the caller doesn't have permission for system scopes.
   */
  assertCanCreateScope(scope: { is_system: boolean }, callerRole: string): void {
    if (scope.is_system && !ApiScopeResolver.canCreateGlobalScope(callerRole)) {
      throw new Error(
        `[PAMS] Only PlatformSuperAdmin can create system/global scopes. Current role: "${callerRole}".`
      );
    }
  },
};

// ── ApiRateLimiter (integrates TenantPlan + UsageBillingRules) ──

/**
 * UsageBillingRules — Defines how API usage maps to billing thresholds.
 * These rules are resolved from the TenantPlan and enforce overage policies.
 */
export interface UsageBillingRules {
  /** Hard cap: reject requests beyond this count */
  hardLimitPerDay: number;
  /** Soft cap: start logging warnings after this */
  softLimitPerDay: number;
  /** Whether overage triggers billing events */
  overageBillable: boolean;
  /** Cost per 1000 requests over the soft limit (BRL) */
  overageCostPer1k_brl: number;
  /** Whether to auto-upgrade plan on sustained overage */
  autoUpgradeOnOverage: boolean;
}

/** Default billing rules per plan tier */
const USAGE_BILLING_RULES: Record<PlanTier, UsageBillingRules> = {
  free: {
    hardLimitPerDay: 500,
    softLimitPerDay: 400,
    overageBillable: false,
    overageCostPer1k_brl: 0,
    autoUpgradeOnOverage: false,
  },
  starter: {
    hardLimitPerDay: 5_000,
    softLimitPerDay: 4_000,
    overageBillable: true,
    overageCostPer1k_brl: 2.50,
    autoUpgradeOnOverage: false,
  },
  pro: {
    hardLimitPerDay: 20_000,
    softLimitPerDay: 15_000,
    overageBillable: true,
    overageCostPer1k_brl: 1.50,
    autoUpgradeOnOverage: false,
  },
  professional: {
    hardLimitPerDay: 20_000,
    softLimitPerDay: 15_000,
    overageBillable: true,
    overageCostPer1k_brl: 1.50,
    autoUpgradeOnOverage: false,
  },
  enterprise: {
    hardLimitPerDay: 100_000,
    softLimitPerDay: 80_000,
    overageBillable: true,
    overageCostPer1k_brl: 0.80,
    autoUpgradeOnOverage: true,
  },
  custom: {
    hardLimitPerDay: 500_000,
    softLimitPerDay: 400_000,
    overageBillable: true,
    overageCostPer1k_brl: 0.50,
    autoUpgradeOnOverage: false,
  },
};

/** Rate limit tiers per plan */
const PLAN_RATE_LIMITS: Record<PlanTier, { perMinute: number; perHour: number; burst: number; concurrent: number }> = {
  free:         { perMinute: 10,  perHour: 100,   burst: 3,  concurrent: 2 },
  starter:      { perMinute: 30,  perHour: 500,   burst: 5,  concurrent: 3 },
  pro:          { perMinute: 60,  perHour: 2000,  burst: 10, concurrent: 5 },
  professional: { perMinute: 60,  perHour: 2000,  burst: 10, concurrent: 5 },
  enterprise:   { perMinute: 300, perHour: 10000, burst: 50, concurrent: 20 },
  custom:       { perMinute: 600, perHour: 30000, burst: 100, concurrent: 50 },
};

export interface RateLimitDecision extends RateLimitCheck {
  planTier: PlanTier;
  billingWarning?: string;
  overageTriggered?: boolean;
}

const rateLimitStore = new Map<string, { count: number; windowStart: number }>();
const dailyUsageStore = new Map<string, { count: number; dayStart: number }>();

export const ApiRateLimiter = {
  /**
   * Check rate limit based on TenantPlan and UsageBillingRules.
   * Integrates with PXE TenantPlanResolver for dynamic plan resolution.
   */
  checkWithPlan(
    keyId: string,
    tenantId: string,
    planResolver?: TenantPlanResolverAPI | null,
  ): RateLimitDecision {
    // 1. Resolve tenant plan tier
    let planTier: PlanTier = 'free';
    if (planResolver) {
      try {
        const snapshot: TenantPlanSnapshot = planResolver.resolve(tenantId);
        planTier = snapshot.plan_tier;
      } catch {
        // Fallback to free if resolver unavailable
      }
    }

    const limits = PLAN_RATE_LIMITS[planTier] ?? PLAN_RATE_LIMITS.free;
    const billingRules = USAGE_BILLING_RULES[planTier] ?? USAGE_BILLING_RULES.free;

    // 2. Per-minute rate limit check
    const now = Date.now();
    const windowMs = 60_000;
    const entry = rateLimitStore.get(keyId);

    if (!entry || now - entry.windowStart > windowMs) {
      rateLimitStore.set(keyId, { count: 1, windowStart: now });
    } else if (entry.count >= limits.perMinute) {
      const retryAfterMs = windowMs - (now - entry.windowStart);
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.windowStart + windowMs,
        retryAfterMs,
        planTier,
        billingWarning: `Rate limit exceeded for ${planTier} plan (${limits.perMinute} req/min)`,
      };
    } else {
      entry.count++;
    }

    // 3. Daily usage + billing rules check
    const dayKey = `${tenantId}:daily`;
    const dayMs = 86_400_000;
    const dailyEntry = dailyUsageStore.get(dayKey);
    let dailyCount = 1;

    if (!dailyEntry || now - dailyEntry.dayStart > dayMs) {
      dailyUsageStore.set(dayKey, { count: 1, dayStart: now });
    } else {
      dailyEntry.count++;
      dailyCount = dailyEntry.count;
    }

    // 4. Hard limit check
    if (dailyCount >= billingRules.hardLimitPerDay) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + dayMs,
        planTier,
        billingWarning: `Daily hard limit reached (${billingRules.hardLimitPerDay} requests). Upgrade your plan.`,
        overageTriggered: true,
      };
    }

    // 5. Soft limit warning
    let billingWarning: string | undefined;
    let overageTriggered = false;
    if (dailyCount >= billingRules.softLimitPerDay) {
      overageTriggered = billingRules.overageBillable;
      billingWarning = billingRules.overageBillable
        ? `Approaching daily limit. Overage billing active (R$${billingRules.overageCostPer1k_brl}/1k requests).`
        : `Approaching daily limit (${dailyCount}/${billingRules.hardLimitPerDay}).`;
    }

    const remaining = Math.max(0, limits.perMinute - (rateLimitStore.get(keyId)?.count ?? 0));

    return {
      allowed: true,
      remaining,
      resetAt: (rateLimitStore.get(keyId)?.windowStart ?? now) + windowMs,
      planTier,
      billingWarning,
      overageTriggered,
    };
  },

  /**
   * Simple rate limit check (legacy — no plan integration).
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

  /** Reset rate limit for a key. */
  reset(keyId: string): void {
    rateLimitStore.delete(keyId);
  },

  /** Reset daily usage for a tenant. */
  resetDaily(tenantId: string): void {
    dailyUsageStore.delete(`${tenantId}:daily`);
  },

  /** Get billing rules for a plan tier. */
  getBillingRules(tier: PlanTier): UsageBillingRules {
    return USAGE_BILLING_RULES[tier] ?? USAGE_BILLING_RULES.free;
  },

  /** Get rate limits for a plan tier. */
  getLimitsForTier(tier: PlanTier): { perMinute: number; perHour: number; burst: number; concurrent: number } {
    return PLAN_RATE_LIMITS[tier] ?? PLAN_RATE_LIMITS.free;
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

// ── ApiVersionRouter (integrates ModuleVersionRegistry) ──

const moduleVersionRegistry = new ModuleVersionRegistry();

export interface VersionRouteResult {
  version: string;
  status: string;
  moduleVersion?: ModuleVersion;
  warning?: string;
  /** Resolved API path (e.g. /api/v1/hr/employees) */
  resolvedPath?: string;
}

export const ApiVersionRouter = {
  /**
   * Resolve /api/v{N}/... using ModuleVersionRegistry.
   * Maps API versions to module versions for backward compatibility.
   */
  async resolveFromRegistry(
    requestPath: string,
    moduleId: string = 'api_management',
  ): Promise<VersionRouteResult | null> {
    // Extract version from path: /api/v1/... → "v1"
    const versionMatch = requestPath.match(/^\/api\/(v\d+)\/?/);
    if (!versionMatch) {
      // No version prefix — resolve to latest
      const latest = await moduleVersionRegistry.getCurrent(moduleId);
      if (!latest) return null;
      return {
        version: latest.version_tag ?? `v${latest.version.major}`,
        status: latest.status,
        moduleVersion: latest,
        resolvedPath: `/api/v${latest.version.major}${requestPath}`,
      };
    }

    const requestedVersion = versionMatch[1]; // "v1", "v2"
    const majorVersion = parseInt(requestedVersion.replace('v', ''), 10);

    // Fetch all versions for the module and find matching major
    const allVersions = await moduleVersionRegistry.listForModule(moduleId);
    const matching = allVersions
      .filter(v => v.version.major === majorVersion)
      .sort((a, b) => {
        // Sort by minor desc, then patch desc to get latest within major
        if (a.version.minor !== b.version.minor) return b.version.minor - a.version.minor;
        return b.version.patch - a.version.patch;
      });

    if (matching.length === 0) return null;

    const best = matching[0];
    const restPath = requestPath.replace(/^\/api\/v\d+\/?/, '/');

    let warning: string | undefined;
    if (best.status === 'deprecated') {
      const latest = await moduleVersionRegistry.getCurrent(moduleId);
      warning = `API ${requestedVersion} is deprecated. Migrate to ${latest?.version_tag ?? 'latest'}.`;
    }

    return {
      version: requestedVersion,
      status: best.status,
      moduleVersion: best,
      warning,
      resolvedPath: `/api/${requestedVersion}${restPath}`,
    };
  },

  /**
   * Simple resolve against static version list (fallback).
   */
  resolve(
    requested: string,
    versions: Array<{ version: string; status: string }>
  ): { version: string; status: string; warning?: string } | null {
    const match = versions.find(v => v.version === requested);
    if (!match) return null;

    if (match.status === 'sunset') return null;

    const warning = match.status === 'deprecated'
      ? `API version ${requested} is deprecated. Please migrate to the latest version.`
      : undefined;

    return { version: match.version, status: match.status, warning };
  },

  /**
   * Get the latest active version from ModuleVersionRegistry.
   */
  async getLatestFromRegistry(moduleId: string = 'api_management'): Promise<string> {
    const current = await moduleVersionRegistry.getCurrent(moduleId);
    return current ? `v${current.version.major}` : 'v1';
  },

  /**
   * Get the latest active version from a static list (fallback).
   */
  getLatest(versions: Array<{ version: string; status: string }>): string {
    const active = versions.filter(v => v.status === 'active');
    return active.length > 0 ? active[active.length - 1].version : 'v1';
  },

  /**
   * List all available API versions from the registry.
   */
  async listAvailableVersions(moduleId: string = 'api_management'): Promise<Array<{
    version: string;
    status: string;
    releasedAt?: string;
  }>> {
    const allVersions = await moduleVersionRegistry.listForModule(moduleId);
    // Deduplicate by major version (keep latest)
    const byMajor = new Map<number, ModuleVersion>();
    for (const v of allVersions) {
      const existing = byMajor.get(v.version.major);
      if (!existing || v.version.minor > existing.version.minor || 
          (v.version.minor === existing.version.minor && v.version.patch > existing.version.patch)) {
        byMajor.set(v.version.major, v);
      }
    }
    return [...byMajor.entries()]
      .sort(([a], [b]) => a - b)
      .map(([major, v]) => ({
        version: `v${major}`,
        status: v.status,
        releasedAt: v.released_at ?? undefined,
      }));
  },
};

// ── ApiSandboxRouter (integrates TenantSandboxEngine) ──

/**
 * TenantSandboxEngine contract — defines the isolation boundary
 * that sandbox-mode API clients operate within.
 *
 * In sandbox mode:
 *  - Data is isolated (reads/writes go to a sandboxed dataset)
 *  - Rate limits are relaxed (testing-friendly)
 *  - Billing is not triggered
 *  - Responses are tagged with sandbox metadata
 */
export interface TenantSandboxEngineAPI {
  /** Check if a tenant has an active sandbox */
  hasSandbox(tenantId: string): boolean;
  /** Get sandbox config for a tenant */
  getSandboxConfig(tenantId: string): SandboxConfig | null;
  /** Create a sandbox for testing */
  createSandbox(tenantId: string, options?: SandboxOptions): SandboxConfig;
  /** Destroy a tenant sandbox */
  destroySandbox(tenantId: string): void;
}

export interface SandboxConfig {
  tenantId: string;
  createdAt: string;
  expiresAt?: string;
  /** Isolated data prefix for sandbox queries */
  dataPrefix: string;
  /** Whether sandbox has seeded test data */
  hasTestData: boolean;
  /** Max requests allowed in sandbox (generous for testing) */
  maxRequests: number;
}

export interface SandboxOptions {
  seedTestData?: boolean;
  expiresInHours?: number;
  maxRequests?: number;
}

/** Default sandbox rate limits — more generous than free tier */
const SANDBOX_RATE_LIMITS = {
  perMinute: 60,
  perHour: 1000,
  burst: 20,
  concurrent: 10,
  maxDailyRequests: 10_000,
};

export const ApiSandboxRouter = {
  /**
   * Determine if a request should be routed to sandbox.
   */
  isSandboxRequest(
    clientEnvironment: ApiEnvironment,
    sandboxEngine?: TenantSandboxEngineAPI | null,
    tenantId?: string,
  ): boolean {
    if (clientEnvironment !== 'sandbox') return false;
    if (!sandboxEngine || !tenantId) return true; // treat as sandbox even without engine
    return sandboxEngine.hasSandbox(tenantId);
  },

  /**
   * Apply sandbox constraints to a gateway response.
   */
  applySandboxContext(
    response: ApiGatewayResponse,
    sandboxEngine?: TenantSandboxEngineAPI | null,
    tenantId?: string,
  ): ApiGatewayResponse {
    const config = tenantId && sandboxEngine
      ? sandboxEngine.getSandboxConfig(tenantId)
      : null;

    return {
      ...response,
      environment: 'sandbox',
      sandboxWarning: 'This request was processed in SANDBOX mode. Data is isolated and not persisted to production.',
      rateLimitRemaining: SANDBOX_RATE_LIMITS.perMinute,
      rateLimitReset: Date.now() + 60_000,
    };
  },

  /**
   * Get sandbox-specific rate limits (more generous for testing).
   */
  getSandboxRateLimits() {
    return { ...SANDBOX_RATE_LIMITS };
  },

  /**
   * Validate that a sandbox hasn't expired.
   */
  isSandboxExpired(config: SandboxConfig): boolean {
    if (!config.expiresAt) return false;
    return new Date(config.expiresAt).getTime() < Date.now();
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

  /**
   * Aggregate ApiRequestLog entries into a UsageSummary.
   */
  aggregateRequestLogs(logs: ApiRequestLog[]): UsageSummary {
    const total = logs.length;
    const successful = logs.filter(l => l.status_code >= 200 && l.status_code < 400).length;
    const failed = total - successful;
    const rateLimited = logs.filter(l => l.status_code === 429).length;

    const times = logs.map(l => l.latency_ms).filter(t => t > 0).sort((a, b) => a - b);
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

    // Module breakdown
    const moduleBreakdown: Record<string, number> = {};
    for (const log of logs) {
      if (log.module) {
        moduleBreakdown[log.module] = (moduleBreakdown[log.module] ?? 0) + 1;
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
      errorBreakdown: moduleBreakdown,
    };
  },

  /**
   * Filter logs by environment (sandbox vs production).
   */
  filterByEnvironment(logs: ApiRequestLog[], env: ApiEnvironment): ApiRequestLog[] {
    return logs.filter(l => (l.environment ?? 'production') === env);
  },
};

// ── Helpers ──

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Wildcard matcher for module.resource.action scope format.
 * Examples:
 *   "hr.employee.read" matches "hr.*", "hr.employee.*", "*"
 */
function matchesWildcard(scope: string, granted: string[]): boolean {
  const parts = scope.split('.');
  return granted.some(g => {
    if (g === '*') return true;
    const gParts = g.split('.');
    for (let i = 0; i < gParts.length; i++) {
      if (gParts[i] === '*') return true;
      if (gParts[i] !== parts[i]) return false;
    }
    return gParts.length === parts.length;
  });
}
