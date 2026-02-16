/**
 * Health Check Edge Function
 *
 * Tests the full middleware pipeline:
 *   1. RequestId → present in response header
 *   2. TenantResolver → tenantId in response body
 *   3. Auth → userId and roles in response body
 */

import { createHandler, jsonResponse, corsHeaders, type MiddlewareContext } from "../_shared/middleware.ts";

const authHandler = createHandler(async (ctx: MiddlewareContext) => {
  return jsonResponse(ctx, {
    status: "ok",
    mode: "authenticated",
    user_id: ctx.userId,
    email: ctx.email,
    tenant_id: ctx.tenantId,
    tenant_name: ctx.tenantName,
    roles: ctx.roles,
    permission_scopes: ctx.permissionScopes,
    elapsed_ms: Date.now() - ctx.startedAt,
  });
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Public health check (no auth)
  const url = new URL(req.url);
  if (url.searchParams.get("public") === "true") {
    return new Response(
      JSON.stringify({ data: { status: "ok", mode: "public" }, request_id: crypto.randomUUID(), timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return authHandler(req);
});
