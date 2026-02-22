/**
 * live-display-data — Serves real-time data to paired TV displays.
 * Auth via display token (no JWT needed).
 *
 * GET ?token=<display_token>
 * Returns: employees, fleet events, infractions, alerts based on display scope.
 */
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
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Validate token
    const { data: tokenData, error: tokenErr } = await admin
      .from("live_display_tokens")
      .select("id, display_id, tenant_id, expires_at, is_active")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (tokenErr || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get display config
    const { data: display } = await admin
      .from("live_displays")
      .select("id, name, layout, company_id, department_id, tenant_id, refresh_interval_seconds")
      .eq("id", tokenData.display_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!display) {
      return new Response(
        JSON.stringify({ error: "Display not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_seen and status
    await admin.from("live_displays").update({ last_seen_at: new Date().toISOString(), status: "active" }).eq("id", display.id);

    // Update paired info if not set
    if (!tokenData.paired_at) {
      await admin.from("live_display_tokens").update({
        paired_at: new Date().toISOString(),
        paired_ip: req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "unknown",
        paired_user_agent: req.headers.get("user-agent") ?? "unknown",
      }).eq("id", tokenData.id);
    }

    const tenantId = display.tenant_id;
    const companyId = display.company_id;
    const departmentId = display.department_id;

    // Build data based on layout
    const result: Record<string, unknown> = {
      display: { id: display.id, name: display.name, layout: display.layout, refresh_interval_seconds: display.refresh_interval_seconds },
      timestamp: new Date().toISOString(),
    };

    // ── Employees (workforce counters) ──
    let empQuery = admin.from("employees")
      .select("id, name, status, department_id, departments(name)", { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);
    if (companyId) empQuery = empQuery.eq("company_id", companyId);
    if (departmentId) empQuery = empQuery.eq("department_id", departmentId);
    const { data: employees, count: empCount } = await empQuery.limit(500);

    const activeCount = (employees ?? []).filter((e: any) => e.status === "active").length;
    const inactiveCount = (empCount ?? 0) - activeCount;

    result.workforce = {
      total: empCount ?? 0,
      active: activeCount,
      inactive: inactiveCount,
      by_department: groupBy(employees ?? [], (e: any) => (e.departments as any)?.name ?? "Sem depto"),
    };

    // ── Fleet behavior events (last 50) ──
    if (display.layout === "operations" || display.layout === "overview") {
      let fleetQuery = admin.from("fleet_behavior_events")
        .select("id, event_type, severity, detected_at, employee_id, employees(name), location_lat, location_lng, speed_kmh, speed_limit_kmh, description")
        .eq("tenant_id", tenantId)
        .order("detected_at", { ascending: false })
        .limit(50);
      if (companyId) fleetQuery = fleetQuery.eq("company_id", companyId);
      const { data: fleetEvents } = await fleetQuery;
      result.fleet_events = fleetEvents ?? [];
    }

    // ── Compliance incidents (last 30) ──
    if (display.layout === "compliance" || display.layout === "overview") {
      let incidentQuery = admin.from("fleet_compliance_incidents")
        .select("id, incident_type, severity, status, description, created_at, employee_id, employees(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (companyId) incidentQuery = incidentQuery.eq("company_id", companyId);
      const { data: incidents } = await incidentQuery;
      result.compliance_incidents = incidents ?? [];
    }

    // ── Critical alerts ──
    let alertQuery = admin.from("fleet_compliance_incidents")
      .select("id, incident_type, severity, description, created_at, employee_id, employees(name)")
      .eq("tenant_id", tenantId)
      .in("severity", ["critical", "high"])
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(10);
    if (companyId) alertQuery = alertQuery.eq("company_id", companyId);
    const { data: alerts } = await alertQuery;
    result.critical_alerts = alerts ?? [];

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[live-display-data] error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function groupBy(arr: any[], keyFn: (item: any) => string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const key = keyFn(item);
    map[key] = (map[key] ?? 0) + 1;
  }
  return map;
}
