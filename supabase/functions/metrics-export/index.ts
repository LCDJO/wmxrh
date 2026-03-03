import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * metrics-export — Prometheus/OpenTelemetry compatible metrics endpoint.
 *
 * GET  → Scrape real metrics from DB in Prometheus exposition format.
 * POST → Accept custom metrics payload and return formatted.
 *
 * Exported metrics:
 *   billing_usage_total{module}             — usage entries per module
 *   coupon_redemptions_total{coupon}         — redemptions per coupon code
 *   billing_discount_amount{coupon}          — total discount BRL per coupon
 *   billing_overage_amount                   — total usage_overage BRL
 *   support_chat_active_total                — active chat sessions
 *   support_chat_message_rate                — messages in last hour
 *   support_agent_response_time_seconds      — avg agent response time (seconds)
 *   support_agent_active_sessions{agent}     — active sessions per agent
 *   support_alert_triggered_total            — total support alerts triggered
 *   support_agent_avg_response_time          — avg agent response time (alias)
 *   support_unresolved_total                 — unresolved tickets count
 *   workflow_executions_total{tenant,status} — total workflow executions
 *   workflow_failures_total{tenant}          — failed workflow executions
 *   workflow_latency_ms{tenant}              — avg workflow execution latency
 *   automation_active_workflows{tenant}      — active integration workflows
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── GET: live metrics scrape ────────────────────────────────
    if (req.method === "GET") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceKey);

      // Parallel queries — billing + support + subscription health
      const [
        usageRes, redemptionsRes, discountRes, overageRes,
        activeSessions, recentMessages, closedSessions,
        agentActiveSessions,
        unresolvedTickets,
        alertTriggered,
        // Integration Automation Engine
        workflowExecutionsRes,
        activeWorkflowsRes,
        // ── Subscription Health metrics ──
        activeSubsRes,
        pastDueSubsRes,
        downgradeScheduledRes,
        planLimitExceededRes,
        fraudFlagsRes,
        // ── Navigation Governance metrics ──
        navVersionsRes,
        navRefactorsRes,
        navRollbacksRes,
      ] = await Promise.all([
        sb.from("platform_financial_entries").select("entry_type, description, amount"),
        sb.from("coupon_redemptions").select("coupon_id, discount_applied_brl, coupons(code)"),
        sb.from("platform_financial_entries").select("amount, description").eq("entry_type", "coupon_discount"),
        sb.from("platform_financial_entries").select("amount").eq("entry_type", "usage_overage"),
        sb.from("support_chat_sessions").select("id", { count: "exact", head: true }).eq("status", "active"),
        sb.from("support_chat_messages").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 3600_000).toISOString()),
        sb.from("support_chat_sessions").select("id").eq("status", "closed").limit(100).order("created_at", { ascending: false }),
        sb.from("support_chat_sessions").select("agent_id").eq("status", "active").not("agent_id", "is", null),
        sb.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
        sb.from("support_chat_notes").select("id", { count: "exact", head: true }).eq("note_type", "alert"),
        sb.from("integration_workflow_executions").select("tenant_id, status, duration_ms"),
        sb.from("integration_workflows").select("tenant_id, status").eq("status", "active"),
        sb.from("tenant_plans").select("id", { count: "exact", head: true }).eq("status", "active"),
        sb.from("tenant_plans").select("id", { count: "exact", head: true }).eq("status", "past_due"),
        sb.from("tenant_plans").select("id", { count: "exact", head: true }).eq("downgrade_scheduled", true),
        sb.from("audit_logs").select("id", { count: "exact", head: true }).eq("action", "plan_limit_exceeded"),
        sb.from("tenant_plans").select("id", { count: "exact", head: true }).eq("review_required", true),
        // Navigation Governance
        sb.from("navigation_versions").select("id, context", { count: "exact" }),
        sb.from("navigation_versions").select("id", { count: "exact", head: true }).like("description", "%Refatoração aprovada%"),
        sb.from("navigation_versions").select("id", { count: "exact", head: true }).like("description", "%Rollback%"),
      ]);

      const lines: string[] = [];
      const ts = Date.now();

      // ── billing_usage_total ──────────────────────────────────
      lines.push("# HELP billing_usage_total Total billing usage entries by module");
      lines.push("# TYPE billing_usage_total counter");
      const moduleCounts = new Map<string, number>();
      for (const row of usageRes.data ?? []) {
        const mod = inferModule(row.description ?? "");
        moduleCounts.set(mod, (moduleCounts.get(mod) ?? 0) + 1);
      }
      for (const [mod, count] of moduleCounts) {
        lines.push(`billing_usage_total{module="${esc(mod)}"} ${count} ${ts}`);
      }

      // ── coupon_redemptions_total ─────────────────────────────
      lines.push("# HELP coupon_redemptions_total Total coupon redemptions by coupon code");
      lines.push("# TYPE coupon_redemptions_total counter");
      const couponCounts = new Map<string, number>();
      for (const row of redemptionsRes.data ?? []) {
        const code = (row as any).coupons?.code ?? "unknown";
        couponCounts.set(code, (couponCounts.get(code) ?? 0) + 1);
      }
      for (const [code, count] of couponCounts) {
        lines.push(`coupon_redemptions_total{coupon="${esc(code)}"} ${count} ${ts}`);
      }

      // ── billing_discount_amount ──────────────────────────────
      lines.push("# HELP billing_discount_amount Total discount amount in BRL by coupon");
      lines.push("# TYPE billing_discount_amount gauge");
      const discountByCoupon = new Map<string, number>();
      for (const row of discountRes.data ?? []) {
        const coupon = extractCouponCode(row.description ?? "");
        discountByCoupon.set(coupon, (discountByCoupon.get(coupon) ?? 0) + Number(row.amount));
      }
      for (const [coupon, total] of discountByCoupon) {
        lines.push(`billing_discount_amount{coupon="${esc(coupon)}"} ${total.toFixed(2)} ${ts}`);
      }

      // ── billing_overage_amount ───────────────────────────────
      lines.push("# HELP billing_overage_amount Total usage overage amount in BRL");
      lines.push("# TYPE billing_overage_amount gauge");
      const overageTotal = (overageRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      lines.push(`billing_overage_amount ${overageTotal.toFixed(2)} ${ts}`);

      // ── support_chat_active_total ─────────────────────────────
      lines.push("# HELP support_chat_active_total Number of currently active chat sessions");
      lines.push("# TYPE support_chat_active_total gauge");
      lines.push(`support_chat_active_total ${activeSessions.count ?? 0} ${ts}`);

      // ── support_chat_message_rate ─────────────────────────────
      lines.push("# HELP support_chat_message_rate Messages sent in the last hour");
      lines.push("# TYPE support_chat_message_rate gauge");
      lines.push(`support_chat_message_rate ${recentMessages.count ?? 0} ${ts}`);

      // ── support_agent_response_time ───────────────────────────
      lines.push("# HELP support_agent_response_time_seconds Average agent response time in seconds");
      lines.push("# TYPE support_agent_response_time_seconds gauge");
      const avgResponseSec = await calcAvgResponseTime(sb, closedSessions.data ?? []);
      lines.push(`support_agent_response_time_seconds ${avgResponseSec.toFixed(1)} ${ts}`);

      // ── support_agent_active_sessions (per agent) ─────────────
      lines.push("# HELP support_agent_active_sessions Number of active chat sessions per agent");
      lines.push("# TYPE support_agent_active_sessions gauge");
      const agentSessionCounts = new Map<string, number>();
      for (const row of agentActiveSessions.data ?? []) {
        const aid = (row as any).agent_id ?? "unassigned";
        agentSessionCounts.set(aid, (agentSessionCounts.get(aid) ?? 0) + 1);
      }
      if (agentSessionCounts.size === 0) {
        lines.push(`support_agent_active_sessions{agent="none"} 0 ${ts}`);
      } else {
        for (const [agent, count] of agentSessionCounts) {
          lines.push(`support_agent_active_sessions{agent="${esc(agent)}"} ${count} ${ts}`);
        }
      }

      // ── support_alert_triggered_total ──────────────────────────
      lines.push("# HELP support_alert_triggered_total Total number of support alerts triggered");
      lines.push("# TYPE support_alert_triggered_total counter");
      lines.push(`support_alert_triggered_total ${alertTriggered.count ?? 0} ${ts}`);

      // ── support_agent_avg_response_time ────────────────────────
      lines.push("# HELP support_agent_avg_response_time Average agent response time in seconds (alias)");
      lines.push("# TYPE support_agent_avg_response_time gauge");
      lines.push(`support_agent_avg_response_time ${avgResponseSec.toFixed(1)} ${ts}`);

      // ── support_unresolved_total ───────────────────────────────
      lines.push("# HELP support_unresolved_total Total unresolved support tickets");
      lines.push("# TYPE support_unresolved_total gauge");
      lines.push(`support_unresolved_total ${unresolvedTickets.count ?? 0} ${ts}`);

      // ══════════════════════════════════════════════════════════
      // Integration Automation Engine Metrics
      // ══════════════════════════════════════════════════════════

      const wfExecs = workflowExecutionsRes.data ?? [];
      const wfActive = activeWorkflowsRes.data ?? [];

      // ── workflow_executions_total ──────────────────────────────
      lines.push("# HELP workflow_executions_total Total workflow executions by tenant and status");
      lines.push("# TYPE workflow_executions_total counter");
      const execByTenantStatus = new Map<string, number>();
      for (const row of wfExecs) {
        const key = `${row.tenant_id}|${row.status}`;
        execByTenantStatus.set(key, (execByTenantStatus.get(key) ?? 0) + 1);
      }
      if (execByTenantStatus.size === 0) {
        lines.push(`workflow_executions_total{tenant="none",status="none"} 0 ${ts}`);
      } else {
        for (const [key, count] of execByTenantStatus) {
          const [tenant, status] = key.split("|");
          lines.push(`workflow_executions_total{tenant="${esc(tenant)}",status="${esc(status)}"} ${count} ${ts}`);
        }
      }

      // ── workflow_failures_total ────────────────────────────────
      lines.push("# HELP workflow_failures_total Total failed workflow executions by tenant");
      lines.push("# TYPE workflow_failures_total counter");
      const failsByTenant = new Map<string, number>();
      for (const row of wfExecs) {
        if (row.status === "failed" || row.status === "timeout") {
          failsByTenant.set(row.tenant_id, (failsByTenant.get(row.tenant_id) ?? 0) + 1);
        }
      }
      if (failsByTenant.size === 0) {
        lines.push(`workflow_failures_total{tenant="none"} 0 ${ts}`);
      } else {
        for (const [tenant, count] of failsByTenant) {
          lines.push(`workflow_failures_total{tenant="${esc(tenant)}"} ${count} ${ts}`);
        }
      }

      // ── workflow_latency_ms ───────────────────────────────────
      lines.push("# HELP workflow_latency_ms Average workflow execution latency in milliseconds by tenant");
      lines.push("# TYPE workflow_latency_ms gauge");
      const latencyByTenant = new Map<string, { sum: number; count: number }>();
      for (const row of wfExecs) {
        if (row.duration_ms != null && row.duration_ms > 0) {
          const entry = latencyByTenant.get(row.tenant_id) ?? { sum: 0, count: 0 };
          entry.sum += row.duration_ms;
          entry.count += 1;
          latencyByTenant.set(row.tenant_id, entry);
        }
      }
      if (latencyByTenant.size === 0) {
        lines.push(`workflow_latency_ms{tenant="none"} 0 ${ts}`);
      } else {
        for (const [tenant, { sum, count }] of latencyByTenant) {
          lines.push(`workflow_latency_ms{tenant="${esc(tenant)}"} ${(sum / count).toFixed(1)} ${ts}`);
        }
      }

      // ── automation_active_workflows ────────────────────────────
      lines.push("# HELP automation_active_workflows Number of active integration workflows by tenant");
      lines.push("# TYPE automation_active_workflows gauge");
      const activeByTenant = new Map<string, number>();
      for (const row of wfActive) {
        activeByTenant.set(row.tenant_id, (activeByTenant.get(row.tenant_id) ?? 0) + 1);
      }
      if (activeByTenant.size === 0) {
        lines.push(`automation_active_workflows{tenant="none"} 0 ${ts}`);
      } else {
        for (const [tenant, count] of activeByTenant) {
          lines.push(`automation_active_workflows{tenant="${esc(tenant)}"} ${count} ${ts}`);
        }
      }

      // ══════════════════════════════════════════════════════════
      // Subscription Health Metrics (Grafana)
      // ══════════════════════════════════════════════════════════

      // ── active_subscriptions_total ─────────────────────────────
      lines.push("# HELP active_subscriptions_total Total active subscriptions");
      lines.push("# TYPE active_subscriptions_total gauge");
      lines.push(`active_subscriptions_total ${activeSubsRes.count ?? 0} ${ts}`);

      // ── past_due_total ─────────────────────────────────────────
      lines.push("# HELP past_due_total Total subscriptions in past_due status");
      lines.push("# TYPE past_due_total gauge");
      lines.push(`past_due_total ${pastDueSubsRes.count ?? 0} ${ts}`);

      // ── downgrades_scheduled_total ─────────────────────────────
      lines.push("# HELP downgrades_scheduled_total Total subscriptions with scheduled downgrade");
      lines.push("# TYPE downgrades_scheduled_total gauge");
      lines.push(`downgrades_scheduled_total ${downgradeScheduledRes.count ?? 0} ${ts}`);

      // ── plan_limit_exceeded_total ──────────────────────────────
      lines.push("# HELP plan_limit_exceeded_total Total plan limit exceeded events");
      lines.push("# TYPE plan_limit_exceeded_total counter");
      lines.push(`plan_limit_exceeded_total ${planLimitExceededRes.count ?? 0} ${ts}`);

      // ── fraud_flags_total ──────────────────────────────────────
      lines.push("# HELP fraud_flags_total Total tenants flagged for fraud review");
      lines.push("# TYPE fraud_flags_total gauge");
      lines.push(`fraud_flags_total ${fraudFlagsRes.count ?? 0} ${ts}`);

      // ══════════════════════════════════════════════════════════
      // WhiteLabel / Branding Metrics
      // ══════════════════════════════════════════════════════════

      const [
        wlEnabledRes,
        brandingUpdatesRes,
        customDomainRes,
      ] = await Promise.all([
        // tenants with whitelabel enabled (plan allows it)
        sb.from("tenant_plans").select("id", { count: "exact", head: true })
          .contains("plan_limits", { can_white_label: true } as any),
        // total branding version updates
        sb.from("tenant_branding_versions").select("id", { count: "exact", head: true }),
        // tenants with custom domain active
        sb.from("tenant_plans").select("id", { count: "exact", head: true })
          .contains("plan_limits", { custom_domain: true } as any),
      ]);

      // ── tenants_whitelabel_enabled_total ───────────────────────
      lines.push("# HELP tenants_whitelabel_enabled_total Total tenants with whitelabel enabled");
      lines.push("# TYPE tenants_whitelabel_enabled_total gauge");
      lines.push(`tenants_whitelabel_enabled_total ${wlEnabledRes.count ?? 0} ${ts}`);

      // ── branding_updates_total ─────────────────────────────────
      lines.push("# HELP branding_updates_total Total branding version updates across all tenants");
      lines.push("# TYPE branding_updates_total counter");
      lines.push(`branding_updates_total ${brandingUpdatesRes.count ?? 0} ${ts}`);

      // ── custom_domain_active_total ─────────────────────────────
      lines.push("# HELP custom_domain_active_total Total tenants with custom domain active");
      lines.push("# TYPE custom_domain_active_total gauge");
      lines.push(`custom_domain_active_total ${customDomainRes.count ?? 0} ${ts}`);

      // ══════════════════════════════════════════════════════════
      // Architecture Intelligence Metrics
      // ══════════════════════════════════════════════════════════

      const [
        archModuleVersionsRes,
        archChangelogsRes,
      ] = await Promise.all([
        sb.from("module_versions").select("module_id, status"),
        sb.from("platform_changelogs").select("id", { count: "exact", head: true }),
      ]);

      const mvRows = archModuleVersionsRes.data ?? [];
      // Unique modules from version table
      const uniqueModules = new Set(mvRows.map((r: any) => r.module_id));
      const totalModules = uniqueModules.size;
      const devModules = mvRows.filter((r: any) => r.status === "development" || r.status === "planning" || r.status === "draft");
      const devModuleIds = new Set(devModules.map((r: any) => r.module_id));

      // ── modules_total ─────────────────────────────────────────
      lines.push("# HELP modules_total Total registered platform modules");
      lines.push("# TYPE modules_total gauge");
      lines.push(`modules_total ${totalModules} ${ts}`);

      // ── modules_in_development ────────────────────────────────
      lines.push("# HELP modules_in_development Modules in development or planning phase");
      lines.push("# TYPE modules_in_development gauge");
      lines.push(`modules_in_development ${devModuleIds.size} ${ts}`);

      // ── architecture_changes_total ────────────────────────────
      lines.push("# HELP architecture_changes_total Total architecture changelog entries");
      lines.push("# TYPE architecture_changes_total counter");
      lines.push(`architecture_changes_total ${archChangelogsRes.count ?? 0} ${ts}`);

      // ── critical_dependency_count ─────────────────────────────
      // Count modules with breaking_changes flagged in latest versions
      const criticalDeps = mvRows.filter((r: any) => r.breaking_changes === true);
      const criticalModuleIds = new Set(criticalDeps.map((r: any) => r.module_id));
      lines.push("# HELP critical_dependency_count Modules with breaking changes (critical dependencies)");
      lines.push("# TYPE critical_dependency_count gauge");
      lines.push(`critical_dependency_count ${criticalModuleIds.size} ${ts}`);

      // ── navigation_versions_total ─────────────────────────────
      lines.push("# HELP navigation_versions_total Total navigation versions by context");
      lines.push("# TYPE navigation_versions_total counter");
      const navByContext = new Map<string, number>();
      for (const row of navVersionsRes.data ?? []) {
        const ctx = (row as any).context ?? "unknown";
        navByContext.set(ctx, (navByContext.get(ctx) ?? 0) + 1);
      }
      for (const [ctx, count] of navByContext) {
        lines.push(`navigation_versions_total{context="${esc(ctx)}"} ${count} ${ts}`);
      }
      if (navByContext.size === 0) {
        lines.push(`navigation_versions_total ${navVersionsRes.count ?? 0} ${ts}`);
      }

      // ── navigation_refactors_total ────────────────────────────
      lines.push("# HELP navigation_refactors_total Total applied navigation refactors");
      lines.push("# TYPE navigation_refactors_total counter");
      lines.push(`navigation_refactors_total ${navRefactorsRes.count ?? 0} ${ts}`);

      // ── navigation_rollbacks_total ────────────────────────────
      lines.push("# HELP navigation_rollbacks_total Total navigation rollbacks executed");
      lines.push("# TYPE navigation_rollbacks_total counter");
      lines.push(`navigation_rollbacks_total ${navRollbacksRes.count ?? 0} ${ts}`);

      return new Response(lines.join("\n") + "\n", {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        },
      });
    }

    // ── POST: custom metrics passthrough ───────────────────────
    if (req.method === "POST") {
      const body = await req.json();
      const { metrics, format } = body;

      if (format === "prometheus" || !format) {
        const lines: string[] = [];
        for (const metric of metrics ?? []) {
          const name = (metric.name ?? "").replace(/[.-]/g, "_");
          lines.push(`# HELP ${name} ${metric.help ?? name}`);
          lines.push(`# TYPE ${name} ${metric.type ?? "gauge"}`);
          for (const sample of metric.samples ?? []) {
            const labels = Object.entries(sample.labels ?? {})
              .map(([k, v]) => `${k}="${v}"`)
              .join(",");
            const labelStr = labels ? `{${labels}}` : "";
            lines.push(`${name}${labelStr} ${sample.value}${sample.timestamp ? ` ${sample.timestamp}` : ""}`);
          }
        }
        return new Response(lines.join("\n") + "\n", {
          headers: { ...corsHeaders, "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
        });
      }

      return new Response(JSON.stringify({
        resource_metrics: [{ scope_metrics: [{ metrics: metrics ?? [] }] }],
        exported_at: Date.now(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    console.error("metrics-export error:", e);
    return new Response(JSON.stringify({ error: "Failed to export metrics" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Helpers ──────────────────────────────────────────────────────

/** Escape label values for Prometheus */
function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/** Infer module name from entry description */
function inferModule(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes("hr") || d.includes("rh") || d.includes("folha")) return "hr";
  if (d.includes("sst") || d.includes("saúde") || d.includes("saude") || d.includes("esocial")) return "sst";
  if (d.includes("agreement") || d.includes("acordo") || d.includes("contrato")) return "agreements";
  if (d.includes("plano") || d.includes("plan")) return "billing";
  if (d.includes("cupom") || d.includes("coupon") || d.includes("desconto")) return "coupons";
  return "general";
}

/** Extract coupon code from description like "Desconto cupom: WELCOME10" */
function extractCouponCode(desc: string): string {
  const match = desc.match(/cupom[:\s]+(\S+)/i);
  return match?.[1] ?? "unknown";
}

/** Calculate average agent response time from closed sessions */
async function calcAvgResponseTime(
  sb: ReturnType<typeof createClient>,
  sessions: Array<{ id: string }>,
): Promise<number> {
  if (!sessions.length) return 0;

  const deltas: number[] = [];
  // Process in batches of 20
  for (let i = 0; i < sessions.length; i += 20) {
    const batch = sessions.slice(i, i + 20).map((s) => s.id);
    const { data: msgs } = await sb
      .from("support_chat_messages")
      .select("session_id, sender_type, created_at")
      .in("session_id", batch)
      .order("created_at", { ascending: true });

    if (!msgs) continue;

    const bySession: Record<string, typeof msgs> = {};
    for (const m of msgs) {
      (bySession[m.session_id] ??= []).push(m);
    }

    for (const sessionMsgs of Object.values(bySession)) {
      for (let j = 0; j < sessionMsgs.length - 1; j++) {
        if (sessionMsgs[j].sender_type === "tenant" && sessionMsgs[j + 1].sender_type === "agent") {
          const delta =
            (new Date(sessionMsgs[j + 1].created_at).getTime() -
              new Date(sessionMsgs[j].created_at).getTime()) /
            1000;
          if (delta > 0 && delta < 86400) deltas.push(delta);
        }
      }
    }
  }

  if (!deltas.length) return 0;
  return deltas.reduce((s, v) => s + v, 0) / deltas.length;
}
