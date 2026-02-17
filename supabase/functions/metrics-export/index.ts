import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * metrics-export — Prometheus/OpenTelemetry compatible metrics endpoint.
 *
 * GET  → Scrape real billing metrics from DB in Prometheus exposition format.
 * POST → Accept custom metrics payload and return formatted.
 *
 * Exported metrics:
 *   billing_usage_total{module}        — usage entries per module
 *   coupon_redemptions_total{coupon}    — redemptions per coupon code
 *   billing_discount_amount{coupon}     — total discount BRL per coupon
 *   billing_overage_amount              — total usage_overage BRL
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── GET: live metrics scrape ────────────────────────────────
    if (req.method === "GET") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceKey);

      // Parallel queries
      const [usageRes, redemptionsRes, discountRes, overageRes] = await Promise.all([
        // billing_usage_total — count financial entries grouped by description keyword as module proxy
        sb.from("platform_financial_entries").select("entry_type, description, amount"),
        // coupon_redemptions_total — count per coupon code
        sb.from("coupon_redemptions").select("coupon_id, discount_applied_brl, coupons(code)"),
        // billing_discount_amount — sum coupon_discount entries
        sb.from("platform_financial_entries").select("amount, description").eq("entry_type", "coupon_discount"),
        // billing_overage_amount — sum usage_overage entries
        sb.from("platform_financial_entries").select("amount").eq("entry_type", "usage_overage"),
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
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
