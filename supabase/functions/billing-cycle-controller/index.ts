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

    const now = new Date();
    const results = {
      invoices_generated: 0,
      subscriptions_past_due: 0,
      subscriptions_suspended: 0,
      errors: [] as string[],
    };

    // ─── STEP 1: Generate invoices for subscriptions due today ───
    const { data: dueSubs, error: dueErr } = await supabase
      .from("tenant_plans")
      .select(
        "id, tenant_id, plan_id, billing_cycle, cycle_end_date, next_billing_date, status, saas_plans!tenant_plans_plan_id_fkey(name, price, annual_price)"
      )
      .in("status", ["active", "trial"])
      .lte("next_billing_date", now.toISOString());

    if (dueErr) {
      results.errors.push(`Fetch due subs: ${dueErr.message}`);
    } else if (dueSubs) {
      for (const sub of dueSubs) {
        const plan = (sub as any).saas_plans;
        if (!plan || plan.price === 0) continue; // Skip free plans

        const amount =
          sub.billing_cycle === "yearly"
            ? plan.annual_price || plan.price * 10
            : plan.price;

        const periodStart = sub.cycle_end_date
          ? new Date(sub.cycle_end_date)
          : now;
        const periodEnd = new Date(periodStart);
        if (sub.billing_cycle === "yearly") {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        const dueDate = new Date(periodStart);
        dueDate.setDate(dueDate.getDate() + 5); // 5 days to pay

        // Check if invoice already exists for this period
        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("subscription_id", sub.id)
          .eq("billing_period_start", periodStart.toISOString().split("T")[0])
          .limit(1);

        if (existing && existing.length > 0) continue;

        const { error: invErr } = await supabase.from("invoices").insert({
          tenant_id: sub.tenant_id,
          plan_id: sub.plan_id,
          subscription_id: sub.id,
          total_amount: amount,
          currency: "BRL",
          billing_period_start: periodStart.toISOString().split("T")[0],
          billing_period_end: periodEnd.toISOString().split("T")[0],
          status: "pending",
          due_date: dueDate.toISOString().split("T")[0],
          auto_generated: true,
        });

        if (invErr) {
          results.errors.push(
            `Invoice for tenant ${sub.tenant_id}: ${invErr.message}`
          );
        } else {
          // Advance cycle dates and paid_until on subscription
          await supabase
            .from("tenant_plans")
            .update({
              cycle_start_date: periodStart.toISOString(),
              cycle_end_date: periodEnd.toISOString(),
              next_billing_date: periodEnd.toISOString(),
              paid_until: periodEnd.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("id", sub.id);

          // Log SubscriptionRenewed event to audit_logs
          await supabase.from("audit_logs").insert({
            tenant_id: sub.tenant_id,
            entity_type: "subscription",
            entity_id: sub.id,
            action: "subscription_renewed",
            metadata: {
              plan_id: sub.plan_id,
              billing_cycle: sub.billing_cycle,
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
              amount,
            },
          });

          results.invoices_generated++;
        }
      }
    }

    // ─── STEP 2: Mark overdue invoices and set subscriptions to past_due ───
    const { data: overdueInvoices, error: odErr } = await supabase
      .from("invoices")
      .select(
        "id, tenant_id, subscription_id, due_date"
      )
      .eq("status", "pending")
      .lt("due_date", now.toISOString().split("T")[0]);

    if (odErr) {
      results.errors.push(`Fetch overdue: ${odErr.message}`);
    } else if (overdueInvoices) {
      for (const inv of overdueInvoices) {
        // Mark invoice as overdue
        await supabase
          .from("invoices")
          .update({ status: "overdue", updated_at: now.toISOString() })
          .eq("id", inv.id);

        // Set subscription to past_due and increment failed count
        const { error: pdErr } = await supabase
          .from("tenant_plans")
          .update({
            status: "past_due",
            failed_payment_count: supabase.rpc ? undefined : 1, // fallback
            updated_at: now.toISOString(),
          })
          .eq("id", inv.subscription_id)
          .eq("status", "active");

        if (!pdErr) {
          // Increment failed_payment_count via raw update
          await supabase.rpc("increment_failed_payments" as any, {
            sub_id: inv.subscription_id,
          });
          results.subscriptions_past_due++;
        }
      }
    }

    // ─── STEP 3: Suspend tenants past grace period ───
    const { data: pastDueSubs, error: pdSubErr } = await supabase
      .from("tenant_plans")
      .select(
        "id, tenant_id, grace_period_ends_at, saas_plans!tenant_plans_plan_id_fkey(grace_period_days)"
      )
      .eq("status", "past_due")
      .not("grace_period_ends_at", "is", null)
      .lt("grace_period_ends_at", now.toISOString());

    if (pdSubErr) {
      results.errors.push(`Fetch past_due subs: ${pdSubErr.message}`);
    } else if (pastDueSubs) {
      for (const sub of pastDueSubs) {
        const { error: suspErr } = await supabase
          .from("tenant_plans")
          .update({
            status: "suspended",
            suspension_reason: "Pagamento não confirmado após grace period",
            updated_at: now.toISOString(),
          })
          .eq("id", sub.id);

        if (!suspErr) {
          results.subscriptions_suspended++;
        } else {
          results.errors.push(
            `Suspend ${sub.tenant_id}: ${suspErr.message}`
          );
        }
      }
    }

    // ─── STEP 4: Apply scheduled downgrades at cycle end ───
    const { data: downgradeSubs } = await supabase
      .from("tenant_plans")
      .select("id, tenant_id, plan_id, scheduled_plan_id, cycle_end_date")
      .eq("downgrade_scheduled", true)
      .not("scheduled_plan_id", "is", null)
      .lte("cycle_end_date", now.toISOString());

    if (downgradeSubs) {
      for (const sub of downgradeSubs) {
        const fromPlanId = sub.plan_id;
        const toPlanId = sub.scheduled_plan_id;

        const { error: dgErr } = await supabase
          .from("tenant_plans")
          .update({
            plan_id: toPlanId,
            downgrade_scheduled: false,
            scheduled_plan_id: null,
            updated_at: now.toISOString(),
          })
          .eq("id", sub.id);

        if (!dgErr) {
          // Log DowngradeApplied event to audit_logs
          await supabase.from("audit_logs").insert({
            tenant_id: sub.tenant_id,
            entity_type: "subscription",
            entity_id: sub.id,
            action: "downgrade_applied",
            metadata: {
              from_plan_id: fromPlanId,
              to_plan_id: toPlanId,
            },
          });

          // Refresh experience profile with new plan's modules
          const { data: newPlan } = await supabase
            .from("saas_plans")
            .select("allowed_modules")
            .eq("id", toPlanId)
            .maybeSingle();

          if (newPlan?.allowed_modules) {
            await supabase
              .from("experience_profiles")
              .update({
                plan_id: toPlanId,
                visible_navigation: newPlan.allowed_modules,
                updated_at: now.toISOString(),
              })
              .eq("tenant_id", sub.tenant_id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
