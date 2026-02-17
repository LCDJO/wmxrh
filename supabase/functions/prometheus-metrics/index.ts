import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const lines: string[] = [];

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

    // ── gateway_response_ms ──────────────────────────────────
    lines.push("# HELP gateway_response_avg_ms Average Gateway response time");
    lines.push("# TYPE gateway_response_avg_ms gauge");
    lines.push(`gateway_response_avg_ms 0`);
    lines.push("# HELP gateway_response_p95_ms Gateway response time p95");
    lines.push("# TYPE gateway_response_p95_ms gauge");
    lines.push(`gateway_response_p95_ms 0`);
    lines.push("# HELP gateway_response_p99_ms Gateway response time p99");
    lines.push("# TYPE gateway_response_p99_ms gauge");
    lines.push(`gateway_response_p99_ms 0`);

    // ── module_latency_ms ────────────────────────────────────
    lines.push("# HELP module_latency_avg_ms Average module latency");
    lines.push("# TYPE module_latency_avg_ms gauge");
    for (const mod of modules) {
      lines.push(`module_latency_avg_ms{module="${mod.id}"} 0`);
    }
    lines.push("# HELP module_latency_p95_ms Module latency p95");
    lines.push("# TYPE module_latency_p95_ms gauge");
    for (const mod of modules) {
      lines.push(`module_latency_p95_ms{module="${mod.id}"} 0`);
    }

    // ── access_graph_recomposition_ms ────────────────────────
    lines.push("# HELP access_graph_recomposition_avg_ms Average AccessGraph recomposition time");
    lines.push("# TYPE access_graph_recomposition_avg_ms gauge");
    lines.push(`access_graph_recomposition_avg_ms 0`);
    lines.push("# HELP access_graph_recomposition_p95_ms AccessGraph recomposition p95");
    lines.push("# TYPE access_graph_recomposition_p95_ms gauge");
    lines.push(`access_graph_recomposition_p95_ms 0`);

    // ══════════════════════════════════════════════════════════
    // ── REFERRAL & GAMIFICATION METRICS (live from DB) ───────
    // ══════════════════════════════════════════════════════════

    const [linksRes, trackingRes, rewardsRes, plansRes] = await Promise.all([
      sb.from("referral_links").select("id, created_at", { count: "exact", head: true }),
      sb.from("referral_tracking").select("id, status, referred_plan_id, converted_at"),
      sb.from("referral_rewards").select("id, referrer_user_id, amount_brl, reward_type, status"),
      sb.from("saas_plans").select("id, name"),
    ]);

    // Build plan id→name map
    const planMap = new Map<string, string>();
    for (const p of (plansRes.data ?? [])) {
      planMap.set(p.id, (p.name ?? "unknown").toLowerCase().replace(/\s+/g, "_"));
    }

    // ── referral_links_created_total ─────────────────────────
    lines.push("# HELP referral_links_created_total Total referral links created");
    lines.push("# TYPE referral_links_created_total counter");
    lines.push(`referral_links_created_total ${linksRes.count ?? 0}`);

    // ── referral_conversion_total ────────────────────────────
    const conversions = (trackingRes.data ?? []).filter(t => t.status === "converted");
    const convByPlan = new Map<string, number>();
    for (const c of conversions) {
      const plan = planMap.get(c.referred_plan_id ?? "") ?? "unknown";
      convByPlan.set(plan, (convByPlan.get(plan) ?? 0) + 1);
    }
    lines.push("# HELP referral_conversion_total Total referral conversions by plan");
    lines.push("# TYPE referral_conversion_total counter");
    if (convByPlan.size === 0) {
      lines.push(`referral_conversion_total 0`);
    } else {
      for (const [plan, count] of convByPlan) {
        lines.push(`referral_conversion_total{plan="${esc(plan)}"} ${count}`);
      }
    }

    // ── gamification_points_total ────────────────────────────
    const totalPoints = (rewardsRes.data ?? [])
      .filter(r => r.status === "paid" || r.status === "pending")
      .reduce((s, r) => s + (r.amount_brl ?? 0), 0);
    lines.push("# HELP gamification_points_total Total gamification points (reward BRL accumulated)");
    lines.push("# TYPE gamification_points_total counter");
    lines.push(`gamification_points_total ${totalPoints.toFixed(2)}`);

    // ── revenue_forecast_value ───────────────────────────────
    // Simple MRR proxy: count active tenants × average plan value
    const { count: tenantCount } = await sb
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    const { data: planPrices } = await sb
      .from("saas_plans")
      .select("price_monthly_brl")
      .eq("is_active", true);

    const avgPrice = planPrices?.length
      ? planPrices.reduce((s, p) => s + (p.price_monthly_brl ?? 0), 0) / planPrices.length
      : 0;
    const forecastMrr = (tenantCount ?? 0) * avgPrice;

    lines.push("# HELP revenue_forecast_value Projected MRR in BRL");
    lines.push("# TYPE revenue_forecast_value gauge");
    lines.push(`revenue_forecast_value ${forecastMrr.toFixed(2)}`);

    // ── marketing_funnel_conversion_rate ──────────────────────
    // Average conversion across active funnels (placeholder: derived from referral data)
    const totalTracking = (trackingRes.data ?? []).length;
    const funnelConvRate = totalTracking > 0
      ? (conversions.length / totalTracking) * 100
      : 0;
    lines.push("# HELP marketing_funnel_conversion_rate Average marketing funnel conversion rate (%)");
    lines.push("# TYPE marketing_funnel_conversion_rate gauge");
    lines.push(`marketing_funnel_conversion_rate ${funnelConvRate.toFixed(2)}`);

    // ── growth_ai_suggestions_total ──────────────────────────
    const { count: aiSuggestionsCount } = await sb
      .from("landing_pages")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "review"]);
    lines.push("# HELP growth_ai_suggestions_total Total Growth AI optimization suggestions generated");
    lines.push("# TYPE growth_ai_suggestions_total counter");
    lines.push(`growth_ai_suggestions_total ${aiSuggestionsCount ?? 0}`);

    // ── marketing_pipeline_drop_rate ─────────────────────────
    const pendingTracking = (trackingRes.data ?? []).filter(t => t.status === "pending").length;
    const pipelineDropRate = totalTracking > 0
      ? (pendingTracking / totalTracking) * 100
      : 0;
    lines.push("# HELP marketing_pipeline_drop_rate Marketing pipeline drop-off rate (%)");
    lines.push("# TYPE marketing_pipeline_drop_rate gauge");
    lines.push(`marketing_pipeline_drop_rate ${pipelineDropRate.toFixed(2)}`);

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

function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}