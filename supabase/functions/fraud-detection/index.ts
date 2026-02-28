import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { tenant_id, action } = await req.json();

    // ─── ACTION: check — run fraud checks for a specific tenant ───
    if (action === "check" && tenant_id) {
      const { data, error } = await supabase.rpc("check_tenant_fraud", {
        p_tenant_id: tenant_id,
      });

      if (error) throw error;

      const signals = data as unknown[];
      const hasCritical = Array.isArray(signals) && signals.some((s: any) => s.severity === "critical");

      // Log each signal
      for (const signal of (signals as any[]) ?? []) {
        await supabase.from("fraud_detection_logs").insert({
          tenant_id,
          detection_type: signal.type,
          severity: signal.severity,
          details: signal,
          action_taken: signal.severity === "critical" ? "flagged" : "none",
        });
      }

      return json({
        success: true,
        signals,
        review_required: hasCritical,
        blocked: hasCritical,
        message: hasCritical
          ? "Atividade suspeita detectada. Mudança bloqueada para revisão."
          : "Nenhuma anomalia crítica detectada.",
      });
    }

    // ─── ACTION: resolve — mark a fraud flag as resolved ───
    if (action === "resolve" && tenant_id) {
      await supabase
        .from("tenant_plans")
        .update({
          review_required: false,
          review_reason: null,
          review_flagged_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenant_id)
        .eq("review_required", true);

      await supabase
        .from("fraud_detection_logs")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("tenant_id", tenant_id)
        .eq("resolved", false);

      return json({ success: true, message: "Revisão concluída." });
    }

    // ─── ACTION: scan_all — batch scan all active tenants ───
    if (action === "scan_all") {
      const { data: tenants } = await supabase
        .from("tenant_plans")
        .select("tenant_id")
        .in("status", ["active", "trial"])
        .limit(500);

      const results = { scanned: 0, flagged: 0 };

      for (const t of tenants ?? []) {
        const { data } = await supabase.rpc("check_tenant_fraud", {
          p_tenant_id: t.tenant_id,
        });
        results.scanned++;
        const signals = data as unknown[];
        if (Array.isArray(signals) && signals.some((s: any) => s.severity === "critical")) {
          results.flagged++;
        }
      }

      return json({ success: true, ...results });
    }

    return json({ success: false, error: "Ação inválida. Use: check, resolve, scan_all" }, 400);
  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
