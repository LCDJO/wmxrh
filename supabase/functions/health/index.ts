/**
 * Health Check Edge Function — tests full 6-layer middleware pipeline.
 *
 * GET /health?public=true  → public (layers 1 only)
 * GET /health              → authenticated (all 6 layers)
 * GET /health?tier=financial → test financial rate limiting
 */

import {
  createHandler,
  jsonResponse,
  corsHeaders,
  type MiddlewareContext,
  type RateLimitTier,
} from "../_shared/middleware.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Public health (no auth, no audit)
  if (url.searchParams.get("public") === "true") {
    return new Response(
      JSON.stringify({
        data: { status: "ok", mode: "public", pipeline: ["1_request_id"] },
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Determine rate limit tier from query param
  const tier = (url.searchParams.get("tier") as RateLimitTier) || "standard";

  const handler = createHandler(
    async (ctx: MiddlewareContext) => {
      return jsonResponse(ctx, {
        status: "ok",
        mode: "authenticated",
        pipeline: [
          "1_request_id",
          "2_tenant_resolver",
          "3_auth",
          "4_scope_guard",
          "5_rate_limit",
          "6_audit",
        ],
        user_id: ctx.userId,
        email: ctx.email,
        tenant_id: ctx.tenantId,
        tenant_name: ctx.tenantName,
        roles: ctx.roles,
        permission_scopes: ctx.permissionScopes,
        elapsed_ms: Date.now() - ctx.startedAt,
      });
    },
    {
      rateLimit: tier,
      route: "health",
      action: "health_check",
    },
  );

  return handler(req);
});
