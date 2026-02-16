/**
 * Edge Function Middleware Pipeline
 *
 * Execution order (mandatory):
 *   1. RequestIdMiddleware  – generates unique request_id
 *   2. TenantResolverMiddleware – resolves tenant from JWT / header
 *   3. AuthMiddleware – validates JWT, extracts user + roles + scopes
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
  /** Unique request identifier for tracing */
  requestId: string;
  /** Authenticated user id (from JWT sub claim) */
  userId: string;
  /** User email (from JWT) */
  email: string;
  /** Resolved tenant id */
  tenantId: string;
  /** Tenant name (for logging) */
  tenantName: string;
  /** User roles as simple strings */
  roles: string[];
  /** Full permission scopes (role + scope_type + scope_id) */
  permissionScopes: PermissionScope[];
  /** Pre-configured Supabase client scoped to the user's JWT */
  supabase: SupabaseClient;
  /** Original request */
  request: Request;
  /** Timestamp when processing started */
  startedAt: number;
}

export type HandlerFn = (ctx: MiddlewareContext) => Promise<Response>;

// ═══════════════════════════════════
// CORS
// ═══════════════════════════════════

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id, x-tenant-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

// ═══════════════════════════════════
// 1) RequestIdMiddleware
// ═══════════════════════════════════

function resolveRequestId(req: Request): string {
  // Allow client to pass a correlation id; otherwise generate one
  const clientId = req.headers.get("x-request-id");
  if (clientId && clientId.length > 0 && clientId.length <= 64) {
    return clientId;
  }
  return crypto.randomUUID();
}

// ═══════════════════════════════════
// 2) TenantResolverMiddleware
// ═══════════════════════════════════

interface TenantInfo {
  tenantId: string;
  tenantName: string;
}

async function resolveTenant(
  supabase: SupabaseClient,
  userId: string,
  req: Request
): Promise<TenantInfo> {
  // Option A: explicit tenant header (for multi-tenant switching)
  const headerTenantId = req.headers.get("x-tenant-id");

  if (headerTenantId) {
    // Validate the user actually belongs to this tenant
    const { data: membership, error } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, tenants(name)")
      .eq("user_id", userId)
      .eq("tenant_id", headerTenantId)
      .maybeSingle();

    if (error || !membership) {
      throw new MiddlewareError(403, "TENANT_ACCESS_DENIED", "You do not have access to this tenant");
    }

    const tenantName = (membership as any).tenants?.name || "Unknown";
    return { tenantId: headerTenantId, tenantName };
  }

  // Option B: resolve from user's memberships (first / only tenant)
  const { data: memberships, error } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, tenants(name)")
    .eq("user_id", userId)
    .limit(1);

  if (error || !memberships || memberships.length === 0) {
    throw new MiddlewareError(403, "NO_TENANT", "User has no tenant membership");
  }

  const first = memberships[0];
  return {
    tenantId: first.tenant_id,
    tenantName: (first as any).tenants?.name || "Unknown",
  };
}

// ═══════════════════════════════════
// 3) AuthMiddleware
// ═══════════════════════════════════

interface AuthInfo {
  userId: string;
  email: string;
  supabase: SupabaseClient;
}

async function authenticateRequest(req: Request): Promise<AuthInfo> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new MiddlewareError(401, "MISSING_TOKEN", "Authorization header is required");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

  if (claimsError || !claimsData?.claims) {
    throw new MiddlewareError(401, "INVALID_TOKEN", "JWT validation failed");
  }

  const claims = claimsData.claims;
  const userId = claims.sub as string;
  const email = (claims.email as string) || "";

  if (!userId) {
    throw new MiddlewareError(401, "INVALID_TOKEN", "Token missing subject claim");
  }

  // Check token expiry
  const exp = claims.exp as number;
  if (exp && exp < Math.floor(Date.now() / 1000)) {
    throw new MiddlewareError(401, "TOKEN_EXPIRED", "JWT has expired");
  }

  return { userId, email, supabase };
}

async function resolvePermissionScopes(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<{ roles: string[]; scopes: PermissionScope[] }> {
  const { data: userRoles, error } = await supabase
    .from("user_roles")
    .select("role, scope_type, scope_id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[AuthMiddleware] Failed to fetch user_roles:", error.message);
    return { roles: [], scopes: [] };
  }

  const roles = [...new Set((userRoles || []).map((r: any) => r.role))];
  const scopes: PermissionScope[] = (userRoles || []).map((r: any) => ({
    role: r.role,
    scope_type: r.scope_type,
    scope_id: r.scope_id,
  }));

  return { roles, scopes };
}

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
    JSON.stringify({
      error: { code, message },
      request_id: requestId,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId },
    }
  );
}

// ═══════════════════════════════════
// Pipeline Orchestrator
// ═══════════════════════════════════

/**
 * Creates a Deno.serve-compatible handler with the full middleware pipeline.
 *
 * @param handler - Your business logic, receives a fully populated MiddlewareContext
 * @param options - Optional config (e.g. skip auth for public endpoints)
 */
export function createHandler(
  handler: HandlerFn,
  options?: { skipAuth?: boolean }
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // ── CORS preflight ──
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── 1) RequestId ──
    const requestId = resolveRequestId(req);
    const startedAt = Date.now();

    try {
      // ── 2 & 3) Auth + Tenant ──
      if (options?.skipAuth) {
        // Public endpoint: no auth, no tenant
        const ctx: MiddlewareContext = {
          requestId,
          userId: "",
          email: "",
          tenantId: "",
          tenantName: "",
          roles: [],
          permissionScopes: [],
          supabase: createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!),
          request: req,
          startedAt,
        };
        const response = await handler(ctx);
        response.headers.set("x-request-id", requestId);
        return response;
      }

      // ── Auth ──
      const { userId, email, supabase } = await authenticateRequest(req);

      // ── Tenant ──
      const { tenantId, tenantName } = await resolveTenant(supabase, userId, req);

      // ── Permission Scopes ──
      const { roles, scopes } = await resolvePermissionScopes(supabase, userId, tenantId);

      console.log(
        `[Middleware] req=${requestId} user=${userId} tenant=${tenantId} roles=[${roles.join(",")}]`
      );

      // ── Build Context ──
      const ctx: MiddlewareContext = {
        requestId,
        userId,
        email,
        tenantId,
        tenantName,
        roles,
        permissionScopes: scopes,
        supabase,
        request: req,
        startedAt,
      };

      // ── Execute Handler ──
      const response = await handler(ctx);

      // Attach trace headers
      response.headers.set("x-request-id", requestId);
      response.headers.set("x-tenant-id", tenantId);

      const elapsed = Date.now() - startedAt;
      console.log(`[Middleware] req=${requestId} completed in ${elapsed}ms status=${response.status}`);

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
// Helper: role-based guard
// ═══════════════════════════════════

/**
 * Quick guard: throws 403 if user doesn't have any of the required roles.
 */
export function requireRoles(ctx: MiddlewareContext, ...requiredRoles: string[]): void {
  const hasAny = ctx.roles.some((r) => requiredRoles.includes(r));
  if (!hasAny) {
    throw new MiddlewareError(
      403,
      "INSUFFICIENT_PERMISSIONS",
      `Requires one of: ${requiredRoles.join(", ")}`
    );
  }
}

/**
 * Quick guard: throws 403 if user doesn't have scoped access to a specific entity.
 */
export function requireScopedAccess(
  ctx: MiddlewareContext,
  entityType: "company_group" | "company",
  entityId: string,
  requiredRoles: string[]
): void {
  const hasAccess = ctx.permissionScopes.some((scope) => {
    if (!requiredRoles.includes(scope.role)) return false;
    // Tenant-level scope has access to everything
    if (scope.scope_type === "tenant") return true;
    // Exact scope match
    if (scope.scope_type === entityType && scope.scope_id === entityId) return true;
    return false;
  });

  if (!hasAccess) {
    throw new MiddlewareError(
      403,
      "SCOPE_ACCESS_DENIED",
      `No ${entityType} access for entity ${entityId}`
    );
  }
}

/**
 * Creates a JSON success response with standard envelope.
 */
export function jsonResponse(ctx: MiddlewareContext, data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      data,
      request_id: ctx.requestId,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "x-request-id": ctx.requestId,
      },
    }
  );
}
