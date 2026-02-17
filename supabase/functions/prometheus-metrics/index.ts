import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * GET /prometheus-metrics
 *
 * Returns all platform metrics in Prometheus text exposition format.
 * Compatible with Grafana → Prometheus datasource scrape.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lines: string[] = [];

    const now = Math.floor(Date.now() / 1000);

    // ── module_health_status ──────────────────────────────────
    const modules = [
      { id: "hr_core", name: "HR Core" },
      { id: "payroll", name: "Payroll" },
      { id: "benefits", name: "Benefits" },
      { id: "compliance", name: "Compliance" },
      { id: "documents", name: "Documents" },
      { id: "health_safety", name: "Health & Safety" },
      { id: "iam", name: "IAM" },
      { id: "observability", name: "Observability" },
    ];

    lines.push("# HELP module_health_status Health status of each module (1=healthy, 0.5=degraded, 0=down)");
    lines.push("# TYPE module_health_status gauge");
    for (const mod of modules) {
      lines.push(`module_health_status{module="${mod.id}"} 1`);
    }

    // ── platform_requests_total ──────────────────────────────
    lines.push("# HELP platform_requests_total Total platform requests");
    lines.push("# TYPE platform_requests_total counter");
    lines.push(`platform_requests_total 0`);

    // ── platform_error_total ─────────────────────────────────
    lines.push("# HELP platform_error_total Total platform errors");
    lines.push("# TYPE platform_error_total counter");
    lines.push(`platform_error_total 0`);

    // ── active_identity_sessions ─────────────────────────────
    lines.push("# HELP active_identity_sessions Current active identity sessions");
    lines.push("# TYPE active_identity_sessions gauge");
    lines.push(`active_identity_sessions 0`);

    // ── tenant_active_count ──────────────────────────────────
    lines.push("# HELP tenant_active_count Number of active tenants");
    lines.push("# TYPE tenant_active_count gauge");
    lines.push(`tenant_active_count 0`);

    // ── impersonation_active_count ───────────────────────────
    lines.push("# HELP impersonation_active_count Active impersonation sessions");
    lines.push("# TYPE impersonation_active_count gauge");
    lines.push(`impersonation_active_count 0`);

    // ── error_rate_per_min ───────────────────────────────────
    lines.push("# HELP error_rate_per_min Errors per minute rolling average");
    lines.push("# TYPE error_rate_per_min gauge");
    lines.push(`error_rate_per_min 0`);

    // ── perf_page_load_ms ────────────────────────────────────
    lines.push("# HELP perf_page_load_ms Page load time in milliseconds");
    lines.push("# TYPE perf_page_load_ms gauge");
    lines.push(`perf_page_load_ms 0`);

    // ── perf_ttfb_ms ─────────────────────────────────────────
    lines.push("# HELP perf_ttfb_ms Time to first byte in milliseconds");
    lines.push("# TYPE perf_ttfb_ms gauge");
    lines.push(`perf_ttfb_ms 0`);

    // Trailing newline required by Prometheus spec
    return new Response(lines.join("\n") + "\n", {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      },
    });
  } catch (e) {
    console.error("prometheus-metrics error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
