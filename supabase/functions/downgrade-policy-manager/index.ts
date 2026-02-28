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

    const { tenant_id, target_plan_id, action } = await req.json();

    // ─── CANCEL scheduled downgrade ───
    if (action === "cancel") {
      const { error } = await supabase
        .from("tenant_plans")
        .update({
          downgrade_scheduled: false,
          scheduled_plan_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenant_id)
        .eq("downgrade_scheduled", true);

      if (error) throw error;
      return json({ success: true, message: "Downgrade cancelado." });
    }

    // ─── SCHEDULE downgrade ───
    if (!tenant_id || !target_plan_id) {
      return json({ success: false, error: "tenant_id e target_plan_id são obrigatórios." }, 400);
    }

    // 1. Fetch current subscription
    const { data: sub, error: subErr } = await supabase
      .from("tenant_plans")
      .select("*, saas_plans!tenant_plans_plan_id_fkey(name, price, max_employees)")
      .eq("tenant_id", tenant_id)
      .in("status", ["active", "trial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr || !sub) {
      return json({ success: false, error: "Assinatura ativa não encontrada." }, 404);
    }

    // 2. Fetch target plan
    const { data: targetPlan, error: tpErr } = await supabase
      .from("saas_plans")
      .select("id, name, price, max_employees")
      .eq("id", target_plan_id)
      .single();

    if (tpErr || !targetPlan) {
      return json({ success: false, error: "Plano destino não encontrado." }, 404);
    }

    // 3. Validate it's actually a downgrade
    const currentPlan = (sub as any).saas_plans;
    if (targetPlan.price >= currentPlan.price) {
      return json({
        success: false,
        error: "O plano selecionado não é um downgrade. Use upgrade para planos superiores.",
      }, 400);
    }

    // 4. Check employee limits — block if current count exceeds target plan limit
    if (targetPlan.max_employees !== null) {
      const { count, error: countErr } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .is("deleted_at", null);

      const activeCount = countErr ? 0 : (count ?? 0);

      if (activeCount > targetPlan.max_employees) {
        return json({
          success: false,
          error: `Não é possível fazer downgrade para ${targetPlan.name}. Você tem ${activeCount} colaboradores ativos, mas o plano permite apenas ${targetPlan.max_employees}. Desative ${activeCount - targetPlan.max_employees} colaborador(es) antes de prosseguir.`,
          current_count: activeCount,
          target_limit: targetPlan.max_employees,
          excess: activeCount - targetPlan.max_employees,
        }, 422);
      }
    }

    // 5. Schedule the downgrade (apply at cycle_end_date)
    const { error: updateErr } = await supabase
      .from("tenant_plans")
      .update({
        downgrade_scheduled: true,
        scheduled_plan_id: target_plan_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    if (updateErr) throw updateErr;

    return json({
      success: true,
      message: `Downgrade para ${targetPlan.name} agendado para ${sub.cycle_end_date ? new Date(sub.cycle_end_date).toLocaleDateString("pt-BR") : "o fim do ciclo atual"}.`,
      scheduled_date: sub.cycle_end_date,
      target_plan: targetPlan.name,
    });
  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
      "Content-Type": "application/json",
    },
  });
}
