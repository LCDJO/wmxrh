import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is platform user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check platform user
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: platformUser } = await adminClient
      .from("platform_users")
      .select("id, role, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!platformUser) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id");

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all data in parallel using service role
    const [
      invoicesRes,
      ledgerRes,
      supportRes,
      employeesRes,
      companiesRes,
      modulesRes,
      membershipsRes,
      tenantPlanRes,
    ] = await Promise.all([
      // Invoices (last 12)
      adminClient
        .from("invoices")
        .select("id, total_amount, currency, status, due_date, paid_at, billing_period_start, billing_period_end, notes, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(12),

      // Financial ledger entries (last 20)
      adminClient
        .from("platform_financial_entries")
        .select("id, entry_type, amount, currency, description, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20),

      // Support sessions (last 6 months aggregated)
      adminClient
        .from("support_chat_sessions")
        .select("id, status, priority, started_at, ended_at, closure_resolved, module_reference")
        .eq("tenant_id", tenantId)
        .order("started_at", { ascending: false })
        .limit(100),

      // Employee count
      adminClient
        .from("employees")
        .select("id, status", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),

      // Company count
      adminClient
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),

      // Active modules
      adminClient
        .from("tenant_modules")
        .select("module_key, is_active, activated_at")
        .eq("tenant_id", tenantId),

      // Member count
      adminClient
        .from("tenant_memberships")
        .select("id, role, user_id", { count: "exact" })
        .eq("tenant_id", tenantId),

      // Current plan
      adminClient
        .from("tenant_plans")
        .select("*, saas_plans(name, price, allowed_modules)")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "trial"])
        .maybeSingle(),
    ]);

    // Aggregate support by month
    const supportSessions = supportRes.data ?? [];
    const supportByMonth: Record<string, { total: number; resolved: number; pending: number }> = {};
    supportSessions.forEach((s: any) => {
      const month = s.started_at?.slice(0, 7); // YYYY-MM
      if (!month) return;
      if (!supportByMonth[month]) supportByMonth[month] = { total: 0, resolved: 0, pending: 0 };
      supportByMonth[month].total++;
      if (s.closure_resolved) supportByMonth[month].resolved++;
      if (s.status === 'waiting' || s.status === 'active') supportByMonth[month].pending++;
    });

    // Invoice summary
    const invoices = invoicesRes.data ?? [];
    const invoiceSummary = {
      total: invoices.length,
      paid: invoices.filter((i: any) => i.status === "paid").length,
      pending: invoices.filter((i: any) => i.status === "pending").length,
      overdue: invoices.filter((i: any) => i.status === "overdue").length,
      total_billed: invoices.reduce((sum: number, i: any) => sum + Number(i.total_amount ?? 0), 0),
      total_paid: invoices.filter((i: any) => i.status === "paid").reduce((sum: number, i: any) => sum + Number(i.total_amount ?? 0), 0),
    };

    const result = {
      usage: {
        employees: employeesRes.count ?? 0,
        companies: companiesRes.count ?? 0,
        members: membershipsRes.count ?? 0,
        active_modules: (modulesRes.data ?? []).filter((m: any) => m.is_active).length,
        total_modules: (modulesRes.data ?? []).length,
        modules: modulesRes.data ?? [],
      },
      plan: tenantPlanRes.data
        ? {
            plan_id: tenantPlanRes.data.plan_id,
            plan_name: (tenantPlanRes.data as any).saas_plans?.name ?? "Free",
            plan_price: (tenantPlanRes.data as any).saas_plans?.price ?? 0,
            status: tenantPlanRes.data.status,
            billing_cycle: tenantPlanRes.data.billing_cycle,
            started_at: tenantPlanRes.data.started_at,
            next_billing_date: tenantPlanRes.data.next_billing_date,
            trial_ends_at: tenantPlanRes.data.trial_ends_at,
            payment_method: tenantPlanRes.data.payment_method,
          }
        : null,
      invoices: {
        summary: invoiceSummary,
        recent: invoices,
      },
      financial_entries: ledgerRes.data ?? [],
      support: {
        total_sessions: supportSessions.length,
        resolved: supportSessions.filter((s: any) => s.closure_resolved).length,
        by_month: supportByMonth,
        by_priority: {
          critical: supportSessions.filter((s: any) => s.priority === "critical").length,
          high: supportSessions.filter((s: any) => s.priority === "high").length,
          medium: supportSessions.filter((s: any) => s.priority === "medium").length,
          low: supportSessions.filter((s: any) => s.priority === "low").length,
        },
      },
      memberships: membershipsRes.data ?? [],
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[tenant-details] error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
