/**
 * change-tenant-plan — End-to-end plan change for a tenant.
 *
 * Lifecycle:
 *   1. Validate caller is platform_user with financial access
 *   2. Validate target tenant exists and is active
 *   3. Validate new plan exists and is active
 *   4. Cancel current plan (if any) with audit trail
 *   5. Activate new plan in tenant_plans
 *   6. Generate proration invoice (credit old plan, charge new plan)
 *   7. Record financial ledger entries
 *   8. Sync tenant_modules to match new plan's allowed_modules
 *   9. Write audit log
 *  10. Return full result
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ── Auth: validate JWT ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError(401, "MISSING_TOKEN", "Authorization header required");
  }

  const userSupabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await userSupabase.auth.getUser();
  if (authError || !user) {
    return jsonError(401, "INVALID_TOKEN", "Authentication failed");
  }

  // ── Parse body ──
  let body: { tenant_id: string; plan_id: string; billing_cycle?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_BODY", "Request body must be valid JSON");
  }

  const { tenant_id, plan_id, billing_cycle = "monthly", reason } = body;

  if (!tenant_id || !plan_id) {
    return jsonError(400, "MISSING_FIELDS", "tenant_id and plan_id are required");
  }

  // UUID format validation
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(tenant_id) || !uuidRe.test(plan_id)) {
    return jsonError(400, "INVALID_UUID", "tenant_id and plan_id must be valid UUIDs");
  }

  if (!["monthly", "quarterly", "semiannual", "annual"].includes(billing_cycle)) {
    return jsonError(400, "INVALID_CYCLE", "billing_cycle must be monthly, quarterly, semiannual or annual");
  }

  // ── Admin client ──
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // ── 1. Validate caller is platform_user with financial access ──
  const { data: platformUser } = await admin
    .from("platform_users")
    .select("id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!platformUser) {
    return jsonError(403, "NOT_PLATFORM_USER", "Caller is not an active platform user");
  }

  const allowedRoles = ["platform_super_admin", "platform_admin", "platform_finance"];
  if (!allowedRoles.includes(platformUser.role)) {
    return jsonError(403, "INSUFFICIENT_ROLE", `Role '${platformUser.role}' cannot change tenant plans`);
  }

  // ── 2. Validate tenant ──
  const { data: tenant, error: tenantErr } = await admin
    .from("tenants")
    .select("id, name, status")
    .eq("id", tenant_id)
    .single();

  if (tenantErr || !tenant) {
    return jsonError(404, "TENANT_NOT_FOUND", "Tenant not found");
  }

  if (!["active", "trial"].includes(tenant.status)) {
    return jsonError(409, "TENANT_INACTIVE", `Tenant status '${tenant.status}' does not allow plan changes`);
  }

  // ── 3. Validate new plan ──
  const { data: newPlan, error: planErr } = await admin
    .from("saas_plans")
    .select("*")
    .eq("id", plan_id)
    .eq("is_active", true)
    .single();

  if (planErr || !newPlan) {
    return jsonError(404, "PLAN_NOT_FOUND", "Target plan not found or inactive");
  }

  // ── 4. Get current plan (if any) ──
  const { data: currentPlan } = await admin
    .from("tenant_plans")
    .select("*, saas_plans(name, price)")
    .eq("tenant_id", tenant_id)
    .in("status", ["active", "trial"])
    .maybeSingle();

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Check if same plan
  if (currentPlan && currentPlan.plan_id === plan_id) {
    return jsonError(409, "SAME_PLAN", "Tenant is already on this plan");
  }

  // ── 5. Cancel current plan ──
  if (currentPlan) {
    const { error: cancelErr } = await admin
      .from("tenant_plans")
      .update({ status: "cancelled", updated_at: now })
      .eq("id", currentPlan.id);

    if (cancelErr) {
      console.error("[change-tenant-plan] Failed to cancel current plan:", cancelErr);
      return jsonError(500, "CANCEL_FAILED", "Failed to cancel current plan");
    }
  }

  // ── 6. Activate new plan ──
  const nextBillingDate = calculateNextBillingDate(billing_cycle);

  const { data: newTenantPlan, error: insertErr } = await admin
    .from("tenant_plans")
    .insert({
      tenant_id,
      plan_id,
      status: "active",
      billing_cycle,
      started_at: now,
      next_billing_date: nextBillingDate,
      activated_by: user.id,
    })
    .select()
    .single();

  if (insertErr) {
    console.error("[change-tenant-plan] Failed to create new plan:", insertErr);
    // Attempt to rollback
    if (currentPlan) {
      await admin.from("tenant_plans").update({ status: "active", updated_at: now }).eq("id", currentPlan.id);
    }
    return jsonError(500, "ACTIVATION_FAILED", "Failed to activate new plan. Previous plan restored.");
  }

  // ── 7. Generate proration invoice ──
  const oldPrice = currentPlan?.saas_plans?.price ?? 0;
  const newPrice = newPlan.price;
  const prorationAmount = Math.max(0, newPrice - oldPrice); // charge difference if upgrading

  let invoice = null;
  if (prorationAmount > 0) {
    const periodEnd = nextBillingDate;
    const { data: inv, error: invErr } = await admin
      .from("invoices")
      .insert({
        tenant_id,
        plan_id,
        total_amount: prorationAmount,
        status: "pending",
        billing_period_start: today,
        billing_period_end: periodEnd,
        due_date: today,
        notes: `Proration: ${currentPlan?.saas_plans?.name ?? 'Nenhum'} → ${newPlan.name} | Cycle: ${billing_cycle}`,
      })
      .select()
      .single();

    if (!invErr && inv) {
      invoice = inv;
    }
  }

  // ── 8. Record financial ledger entries ──
  const ledgerEntries = [];

  // Credit for old plan (unused portion) if downgrading
  if (currentPlan && oldPrice > newPrice) {
    const creditAmount = oldPrice - newPrice;
    ledgerEntries.push({
      tenant_id,
      entry_type: "credit",
      amount: creditAmount,
      source_plan_id: currentPlan.plan_id,
      invoice_id: invoice?.id ?? null,
      description: `Crédito proration: ${currentPlan.saas_plans?.name} → ${newPlan.name}`,
    });
  }

  // Charge for new plan
  if (prorationAmount > 0) {
    ledgerEntries.push({
      tenant_id,
      entry_type: "charge",
      amount: prorationAmount,
      source_plan_id: plan_id,
      invoice_id: invoice?.id ?? null,
      description: `Ativação plano ${newPlan.name} (${billing_cycle})`,
    });
  }

  // Plan change event entry
  ledgerEntries.push({
    tenant_id,
    entry_type: "plan_change",
    amount: 0,
    source_plan_id: plan_id,
    invoice_id: null,
    description: `Troca: ${currentPlan?.saas_plans?.name ?? 'Nenhum'} → ${newPlan.name}`,
    metadata: {
      from_plan_id: currentPlan?.plan_id ?? null,
      to_plan_id: plan_id,
      billing_cycle,
      changed_by: user.id,
      reason: reason ?? null,
    },
  });

  if (ledgerEntries.length > 0) {
    const { error: ledgerErr } = await admin
      .from("platform_financial_entries")
      .insert(ledgerEntries);
    if (ledgerErr) {
      console.error("[change-tenant-plan] Ledger write failed:", ledgerErr);
    }
  }

  // ── 9. Sync tenant_modules to match new plan ──
  const allowedModules = newPlan.allowed_modules ?? [];

  // Get current tenant_modules
  const { data: currentModules } = await admin
    .from("tenant_modules")
    .select("id, module_key, is_active")
    .eq("tenant_id", tenant_id);

  const currentModuleKeys = new Set((currentModules ?? []).map((m: any) => m.module_key));
  const targetModuleKeys = new Set(allowedModules);

  // Enable modules that should be active
  for (const moduleKey of allowedModules) {
    if (!currentModuleKeys.has(moduleKey)) {
      await admin.from("tenant_modules").insert({
        tenant_id,
        module_key: moduleKey,
        is_active: true,
      });
    } else {
      // Ensure it's active
      await admin
        .from("tenant_modules")
        .update({ is_active: true })
        .eq("tenant_id", tenant_id)
        .eq("module_key", moduleKey);
    }
  }

  // Disable modules not in the new plan
  for (const mod of (currentModules ?? [])) {
    if (!targetModuleKeys.has(mod.module_key) && mod.is_active) {
      await admin
        .from("tenant_modules")
        .update({ is_active: false })
        .eq("id", mod.id);
    }
  }

  // ── 10. Audit log ──
  await admin.from("audit_logs").insert({
    tenant_id,
    user_id: user.id,
    action: "plan_change",
    entity_type: "tenant_plans",
    entity_id: newTenantPlan.id,
    old_value: currentPlan
      ? { plan_id: currentPlan.plan_id, plan_name: currentPlan.saas_plans?.name, billing_cycle: currentPlan.billing_cycle }
      : null,
    new_value: { plan_id, plan_name: newPlan.name, billing_cycle },
    metadata: {
      proration_amount: prorationAmount,
      invoice_id: invoice?.id ?? null,
      modules_synced: allowedModules.length,
      reason: reason ?? null,
    },
  });

  // ── Response ──
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        tenant: { id: tenant.id, name: tenant.name },
        previous_plan: currentPlan
          ? { id: currentPlan.plan_id, name: currentPlan.saas_plans?.name, price: oldPrice }
          : null,
        new_plan: { id: newPlan.id, name: newPlan.name, price: newPlan.price, billing_cycle },
        tenant_plan_id: newTenantPlan.id,
        proration: { amount: prorationAmount, invoice_id: invoice?.id ?? null },
        modules_synced: allowedModules,
        next_billing_date: nextBillingDate,
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

// ── Helpers ──

function calculateNextBillingDate(cycle: string): string {
  const now = new Date();
  switch (cycle) {
    case "quarterly": now.setMonth(now.getMonth() + 3); break;
    case "semiannual": now.setMonth(now.getMonth() + 6); break;
    case "annual": now.setFullYear(now.getFullYear() + 1); break;
    default: now.setMonth(now.getMonth() + 1); break;
  }
  return now.toISOString().slice(0, 10);
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
