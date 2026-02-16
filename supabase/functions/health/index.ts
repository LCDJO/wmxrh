/**
 * Health Check — tests full 7-layer middleware pipeline.
 *
 * GET /health?public=true              → public
 * GET /health                          → authenticated (all 7 layers)
 * POST /health?test=salary_contract    → test salary contract validation
 * POST /health?test=salary_adjustment  → test salary adjustment validation
 * POST /health?test=employee           → test employee validation
 */

import {
  createHandler, jsonResponse, validateBody, corsHeaders,
  salaryContractSchema, salaryAdjustmentSchema, salaryAdditionalSchema, employeeSchema,
  type MiddlewareContext, type RateLimitTier, type ValidationSchema,
} from "../_shared/middleware.ts";

const VALIDATION_TEST_SCHEMAS: Record<string, ValidationSchema> = {
  salary_contract: salaryContractSchema,
  salary_adjustment: salaryAdjustmentSchema,
  salary_additional: salaryAdditionalSchema,
  employee: employeeSchema,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Public health
  if (url.searchParams.get("public") === "true") {
    return new Response(
      JSON.stringify({
        data: { status: "ok", mode: "public", pipeline: ["1_request_id"] },
        request_id: crypto.randomUUID(), timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const tier = (url.searchParams.get("tier") as RateLimitTier) || "standard";
  const testSchema = url.searchParams.get("test");

  const handler = createHandler(
    async (ctx: MiddlewareContext) => {
      // If POST + test param, run validation
      if (req.method === "POST" && testSchema && VALIDATION_TEST_SCHEMAS[testSchema]) {
        const validated = await validateBody(ctx, VALIDATION_TEST_SCHEMAS[testSchema]);
        return jsonResponse(ctx, {
          status: "ok",
          mode: "validation_test",
          schema: testSchema,
          validated_data: validated,
          pipeline: ["1_request_id", "2_tenant", "3_auth", "4_scope_guard", "5_rate_limit", "6_audit", "7_validation"],
        });
      }

      return jsonResponse(ctx, {
        status: "ok",
        mode: "authenticated",
        pipeline: ["1_request_id", "2_tenant", "3_auth", "4_scope_guard", "5_rate_limit", "6_audit", "7_validation"],
        user_id: ctx.userId, email: ctx.email,
        tenant_id: ctx.tenantId, tenant_name: ctx.tenantName,
        roles: ctx.roles, permission_scopes: ctx.permissionScopes,
        elapsed_ms: Date.now() - ctx.startedAt,
      });
    },
    { rateLimit: tier, route: "health", action: "health_check" },
  );

  return handler(req);
});
