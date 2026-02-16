/**
 * Edge Function Middleware Pipeline
 *
 * Execution order (mandatory):
 *   1. RequestIdMiddleware      – generates unique request_id
 *   2. TenantResolverMiddleware – resolves tenant from JWT / header
 *   3. AuthMiddleware           – validates JWT, extracts user + roles + scopes
 *   4. ScopeGuardMiddleware     – validates hierarchical scope access
 *   5. RateLimitMiddleware      – per-user request throttling
 *   6. AuditMiddleware          – logs every request to audit_logs
 *
 * Usage in any edge function:
 *   import { createHandler } from "../_shared/middleware.ts";
 *   Deno.serve(createHandler(async (ctx) => { ... }));
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ═══════════════════════════════════
// Types
// ═══════════════════════════════════

export interface PermissionScope {
  role: string;
  scope_type: string;  // 'tenant' | 'company_group' | 'company'
  scope_id: string | null;
}

export interface MiddlewareContext {
  requestId: string;
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  roles: string[];
  permissionScopes: PermissionScope[];
  supabase: SupabaseClient;
  request: Request;
  startedAt: number;
}

export type HandlerFn = (ctx: MiddlewareContext) => Promise<Response>;

export interface HandlerOptions {
  /** Skip auth entirely (public/webhook endpoints) */
  skipAuth?: boolean;
  /** Rate limit tier for this endpoint */
  rateLimit?: RateLimitTier;
  /** Audit metadata: route name for logging */
  route?: string;
  /** Audit metadata: action name */
  action?: string;
  /** Skip audit logging for this endpoint */
  skipAudit?: boolean;
}

// ═══════════════════════════════════
// CORS
// ═══════════════════════════════════

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id, x-tenant-id, x-company-id, x-group-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

// ═══════════════════════════════════
// Error Handling
// ═══════════════════════════════════

export class MiddlewareError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function errorResponse(requestId: string, status: number, code: string, message: string): Response {
  return new Response(
    JSON.stringify({ error: { code, message }, request_id: requestId, timestamp: new Date().toISOString() }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId } },
  );
}

// ═══════════════════════════════════
// 1) RequestIdMiddleware
// ═══════════════════════════════════

function resolveRequestId(req: Request): string {
  const clientId = req.headers.get("x-request-id");
  if (clientId && clientId.length > 0 && clientId.length <= 64) return clientId;
  return crypto.randomUUID();
}

// ═══════════════════════════════════
// 2) TenantResolverMiddleware
// ═══════════════════════════════════

interface TenantInfo { tenantId: string; tenantName: string; }

async function resolveTenant(supabase: SupabaseClient, userId: string, req: Request): Promise<TenantInfo> {
  const headerTenantId = req.headers.get("x-tenant-id");

  if (headerTenantId) {
    const { data: membership, error } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, tenants(name)")
      .eq("user_id", userId)
      .eq("tenant_id", headerTenantId)
      .maybeSingle();
    if (error || !membership) throw new MiddlewareError(403, "TENANT_ACCESS_DENIED", "You do not have access to this tenant");
    return { tenantId: headerTenantId, tenantName: (membership as any).tenants?.name || "Unknown" };
  }

  const { data: memberships, error } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, tenants(name)")
    .eq("user_id", userId)
    .limit(1);
  if (error || !memberships?.length) throw new MiddlewareError(403, "NO_TENANT", "User has no tenant membership");

  const first = memberships[0];
  return { tenantId: first.tenant_id, tenantName: (first as any).tenants?.name || "Unknown" };
}

// ═══════════════════════════════════
// 3) AuthMiddleware
// ═══════════════════════════════════

interface AuthInfo { userId: string; email: string; supabase: SupabaseClient; }

async function authenticateRequest(req: Request): Promise<AuthInfo> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new MiddlewareError(401, "MISSING_TOKEN", "Authorization header is required");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) throw new MiddlewareError(401, "INVALID_TOKEN", "JWT validation failed");

  const claims = claimsData.claims;
  const userId = claims.sub as string;
  const email = (claims.email as string) || "";
  if (!userId) throw new MiddlewareError(401, "INVALID_TOKEN", "Token missing subject claim");

  const exp = claims.exp as number;
  if (exp && exp < Math.floor(Date.now() / 1000)) throw new MiddlewareError(401, "TOKEN_EXPIRED", "JWT has expired");

  return { userId, email, supabase };
}

async function resolvePermissionScopes(
  supabase: SupabaseClient, userId: string, tenantId: string
): Promise<{ roles: string[]; scopes: PermissionScope[] }> {
  const { data: userRoles, error } = await supabase
    .from("user_roles").select("role, scope_type, scope_id")
    .eq("user_id", userId).eq("tenant_id", tenantId);

  if (error) { console.error("[AuthMiddleware] Failed to fetch user_roles:", error.message); return { roles: [], scopes: [] }; }

  const roles = [...new Set((userRoles || []).map((r: any) => r.role))];
  const scopes: PermissionScope[] = (userRoles || []).map((r: any) => ({
    role: r.role, scope_type: r.scope_type, scope_id: r.scope_id,
  }));
  return { roles, scopes };
}

// ═══════════════════════════════════
// 4) ScopeGuardMiddleware
// ═══════════════════════════════════

/**
 * Validates that the user can access the requested company/group scope.
 * Reads x-company-id and x-group-id headers from the request.
 * Tenant-scoped users pass through; group/company-scoped users are restricted.
 */
function validateScopeAccess(ctx: MiddlewareContext): void {
  const requestedCompanyId = ctx.request.headers.get("x-company-id");
  const requestedGroupId = ctx.request.headers.get("x-group-id");

  // If no specific scope requested, no cross-scope check needed
  if (!requestedCompanyId && !requestedGroupId) return;

  // Tenant-level users can access everything within the tenant
  const hasTenantScope = ctx.permissionScopes.some(s => s.scope_type === "tenant");
  if (hasTenantScope) return;

  // Check group access
  if (requestedGroupId) {
    const hasGroupAccess = ctx.permissionScopes.some(
      s => s.scope_type === "company_group" && s.scope_id === requestedGroupId
    );
    if (!hasGroupAccess) {
      throw new MiddlewareError(403, "SCOPE_CROSS_GROUP", `Access denied to group ${requestedGroupId}`);
    }
  }

  // Check company access
  if (requestedCompanyId) {
    const hasCompanyAccess = ctx.permissionScopes.some(s =>
      (s.scope_type === "company" && s.scope_id === requestedCompanyId) ||
      (s.scope_type === "company_group") // Group-scoped users may access companies within their group (RLS enforces this)
    );
    if (!hasCompanyAccess) {
      throw new MiddlewareError(403, "SCOPE_CROSS_COMPANY", `Access denied to company ${requestedCompanyId}`);
    }
  }
}

// ═══════════════════════════════════
// 5) RateLimitMiddleware
// ═══════════════════════════════════

export type RateLimitTier = "standard" | "sensitive" | "financial";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const RATE_LIMIT_CONFIGS: Record<RateLimitTier, RateLimitConfig> = {
  standard:  { maxRequests: 100, windowMs: 60_000 },    // 100/min
  sensitive: { maxRequests: 30,  windowMs: 60_000 },     // 30/min
  financial: { maxRequests: 10,  windowMs: 60_000 },     // 10/min
};

// In-memory sliding window per user+tier (resets on cold start — acceptable for edge functions)
const rateLimitStore = new Map<string, { timestamps: number[] }>();

function checkRateLimit(userId: string, tier: RateLimitTier): void {
  const config = RATE_LIMIT_CONFIGS[tier];
  const key = `${userId}:${tier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Slide window: remove expired timestamps
  entry.timestamps = entry.timestamps.filter(t => t > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    const retryAfterMs = entry.timestamps[0] + config.windowMs - now;
    throw new MiddlewareError(
      429,
      "RATE_LIMITED",
      `Rate limit exceeded (${tier}: ${config.maxRequests}/${config.windowMs / 1000}s). Retry after ${Math.ceil(retryAfterMs / 1000)}s`
    );
  }

  entry.timestamps.push(now);
}

// Periodic cleanup to prevent memory leaks (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter(t => t > now - 120_000);
    if (entry.timestamps.length === 0) rateLimitStore.delete(key);
  }
}, 300_000);

// ═══════════════════════════════════
// 6) AuditMiddleware
// ═══════════════════════════════════

/**
 * Logs the request to audit_logs using a service-role client (SECURITY DEFINER equivalent).
 * Fire-and-forget: does not block the response.
 */
async function auditLog(
  ctx: MiddlewareContext,
  options: HandlerOptions,
  responseStatus: number,
): Promise<void> {
  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) { console.warn("[AuditMiddleware] Missing service role key, skipping audit"); return; }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

    const url = new URL(ctx.request.url);
    const companyId = ctx.request.headers.get("x-company-id") || null;
    const groupId = ctx.request.headers.get("x-group-id") || null;

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      company_id: companyId,
      company_group_id: groupId,
      action: options.action || ctx.request.method,
      entity_type: options.route || url.pathname,
      entity_id: null,
      metadata: {
        request_id: ctx.requestId,
        method: ctx.request.method,
        path: url.pathname,
        response_status: responseStatus,
        elapsed_ms: Date.now() - ctx.startedAt,
        roles: ctx.roles,
        ip: ctx.request.headers.get("x-forwarded-for") || ctx.request.headers.get("cf-connecting-ip") || null,
        user_agent: ctx.request.headers.get("user-agent") || null,
      },
    });
  } catch (err) {
    // Never let audit failures break the pipeline
    console.error("[AuditMiddleware] Failed to write audit log:", err);
  }
}

// ═══════════════════════════════════
// Pipeline Orchestrator
// ═══════════════════════════════════

/**
 * Creates a Deno.serve-compatible handler with the full 6-layer middleware pipeline.
 */
export function createHandler(handler: HandlerFn, options: HandlerOptions = {}): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // ── CORS preflight ──
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── 1) RequestId ──
    const requestId = resolveRequestId(req);
    const startedAt = Date.now();

    try {
      // ── Public/webhook endpoints ──
      if (options.skipAuth) {
        const ctx: MiddlewareContext = {
          requestId, userId: "", email: "", tenantId: "", tenantName: "",
          roles: [], permissionScopes: [],
          supabase: createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!),
          request: req, startedAt,
        };
        const response = await handler(ctx);
        response.headers.set("x-request-id", requestId);
        return response;
      }

      // ── 3) Auth ──
      const { userId, email, supabase } = await authenticateRequest(req);

      // ── 2) Tenant ──
      const { tenantId, tenantName } = await resolveTenant(supabase, userId, req);

      // ── 3 cont.) Permission Scopes ──
      const { roles, scopes } = await resolvePermissionScopes(supabase, userId, tenantId);

      // ── Build Context ──
      const ctx: MiddlewareContext = {
        requestId, userId, email, tenantId, tenantName,
        roles, permissionScopes: scopes, supabase, request: req, startedAt,
      };

      // ── 4) ScopeGuard ──
      validateScopeAccess(ctx);

      // ── 5) RateLimit ──
      const tier = options.rateLimit || "standard";
      checkRateLimit(userId, tier);

      console.log(`[Middleware] req=${requestId} user=${userId} tenant=${tenantId} roles=[${roles.join(",")}] tier=${tier}`);

      // ── Execute Handler ──
      const response = await handler(ctx);

      // Attach trace headers
      response.headers.set("x-request-id", requestId);
      response.headers.set("x-tenant-id", tenantId);

      const elapsed = Date.now() - startedAt;
      console.log(`[Middleware] req=${requestId} completed in ${elapsed}ms status=${response.status}`);

      // ── 6) Audit (fire-and-forget) ──
      if (!options.skipAudit) {
        auditLog(ctx, options, response.status).catch(() => {});
      }

      return response;
    } catch (err) {
      if (err instanceof MiddlewareError) {
        console.warn(`[Middleware] req=${requestId} error=${err.code}: ${err.message}`);
        return errorResponse(requestId, err.status, err.code, err.message);
      }
      console.error(`[Middleware] req=${requestId} unhandled:`, err);
      return errorResponse(requestId, 500, "INTERNAL_ERROR", "An unexpected error occurred");
    }
  };
}

// ═══════════════════════════════════
// Guards (exported for handlers)
// ═══════════════════════════════════

/** Throws 403 if user doesn't have any of the required roles. */
export function requireRoles(ctx: MiddlewareContext, ...requiredRoles: string[]): void {
  if (!ctx.roles.some(r => requiredRoles.includes(r))) {
    throw new MiddlewareError(403, "INSUFFICIENT_PERMISSIONS", `Requires one of: ${requiredRoles.join(", ")}`);
  }
}

/** Throws 403 if user doesn't have scoped access to a specific entity. */
export function requireScopedAccess(
  ctx: MiddlewareContext, entityType: "company_group" | "company", entityId: string, requiredRoles: string[]
): void {
  const hasAccess = ctx.permissionScopes.some(scope => {
    if (!requiredRoles.includes(scope.role)) return false;
    if (scope.scope_type === "tenant") return true;
    if (scope.scope_type === entityType && scope.scope_id === entityId) return true;
    // Group-scoped users can access companies within their group
    if (entityType === "company" && scope.scope_type === "company_group") return true;
    return false;
  });
  if (!hasAccess) throw new MiddlewareError(403, "SCOPE_ACCESS_DENIED", `No ${entityType} access for entity ${entityId}`);
}

/** Creates a JSON success response with standard envelope. */
export function jsonResponse(ctx: MiddlewareContext, data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ data, request_id: ctx.requestId, timestamp: new Date().toISOString() }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": ctx.requestId } },
  );
}
