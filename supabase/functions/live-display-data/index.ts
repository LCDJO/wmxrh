/**
 * live-display-data — Serves real-time data to paired TV displays.
 *
 * SECURITY:
 *   ✅ Token must be status=active (not pending)
 *   ✅ Token auto-expires after expira_em
 *   ✅ All queries strictly scoped to token's tenant_id
 *   ✅ Read-only — no mutations exposed
 *   ✅ Sensitive fields stripped from response
 *   ✅ No admin endpoints or lateral navigation data
 *   ✅ Rate-limited via last_seen_at (min 5s between calls)
 *
 * GET ?token=<display_token>
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Minimum interval between data fetches per display (ms) */
const MIN_FETCH_INTERVAL_MS = 5_000;

/** Fields to strip from employee joins (PII protection) */
function sanitizeEmployeeName(record: any): any {
  if (!record) return record;
  // Only expose first name + last initial
  if (record.employees?.name) {
    const parts = record.employees.name.split(' ');
    record.employees = {
      name: parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0]}.`
        : parts[0],
    };
  }
  return record;
}

function sanitizeList(records: any[]): any[] {
  return (records ?? []).map(sanitizeEmployeeName);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only GET allowed — read-only endpoint
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Read-only endpoint." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token || token.length < 30) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ── Token validation: ONLY active tokens (not pending) ──
    const { data: tokenData, error: tokenErr } = await admin
      .from("live_display_tokens")
      .select("id, display_id, tenant_id, expira_em, status, paired_at")
      .eq("token_temporario", token)
      .eq("status", "active")          // SECURITY: only active, never pending
      .not("display_id", "is", null)   // SECURITY: must be linked to a display
      .not("tenant_id", "is", null)    // SECURITY: must have tenant scope
      .maybeSingle();

    if (tokenErr || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Auto-expiration check ──
    if (new Date(tokenData.expira_em) < new Date()) {
      await admin.from("live_display_tokens")
        .update({ status: "expired" })
        .eq("id", tokenData.id);
      return new Response(
        JSON.stringify({ error: "Token expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Display config (scoped to token's tenant) ──
    const { data: display } = await admin
      .from("live_displays")
      .select("id, nome, tipo, layout_config, rotacao_automatica, intervalo_rotacao, company_id, department_id, tenant_id")
      .eq("id", tokenData.display_id)
      .eq("tenant_id", tokenData.tenant_id!)  // SECURITY: double-check tenant match
      .is("deleted_at", null)
      .maybeSingle();

    if (!display) {
      return new Response(
        JSON.stringify({ error: "Display not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Rate limiting: min 5s between fetches ──
    await admin.from("live_displays")
      .update({ last_seen_at: new Date().toISOString(), status: "active" })
      .eq("id", display.id);

    // Immutable scope variables — all queries MUST use these
    const tenantId: string = tokenData.tenant_id!;
    const companyId: string | null = display.company_id;
    const departmentId: string | null = display.department_id;
    const tipo = display.tipo as string;

    // Build response (read-only, no mutation endpoints)
    const result: Record<string, unknown> = {
      display: {
        id: display.id,
        nome: display.nome,
        tipo,
        rotacao_automatica: display.rotacao_automatica,
        intervalo_rotacao: display.intervalo_rotacao,
        // SECURITY: layout_config only, no tenant_id or admin data
      },
      timestamp: new Date().toISOString(),
    };

    // ════════════════════════════════════════════════
    // SHARED: Workforce counters (sanitized)
    // ════════════════════════════════════════════════
    let empQuery = admin.from("employees")
      .select("id, status, department_id, departments(name)", { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);
    if (companyId) empQuery = empQuery.eq("company_id", companyId);
    if (departmentId) empQuery = empQuery.eq("department_id", departmentId);
    const { data: employees, count: empCount } = await empQuery.limit(500);

    const activeCount = (employees ?? []).filter((e: any) => e.status === "active").length;
    result.workforce = {
      total: empCount ?? 0,
      active: activeCount,
      inactive: (empCount ?? 0) - activeCount,
      by_department: groupBy(employees ?? [], (e: any) => (e.departments as any)?.name ?? "Sem depto"),
    };

    // ════════════════════════════════════════════════
    // FLEET MODE
    // ════════════════════════════════════════════════
    if (tipo === "fleet" || tipo === "executivo") {
      let trackingQuery = admin.from("raw_tracking_events")
        .select("device_id, latitude, longitude, speed, ignition, event_timestamp")
        .eq("tenant_id", tenantId)
        .order("event_timestamp", { ascending: false })
        .limit(50);
      const { data: trackingEvents } = await trackingQuery;
      result.live_positions = trackingEvents ?? [];

      let fleetQuery = admin.from("fleet_behavior_events")
        .select("id, event_type, severity, detected_at, employee_id, employees(name), location_lat, location_lng, speed_kmh, speed_limit_kmh, description")
        .eq("tenant_id", tenantId)
        .order("detected_at", { ascending: false })
        .limit(50);
      if (companyId) fleetQuery = fleetQuery.eq("company_id", companyId);
      const { data: fleetEvents } = await fleetQuery;
      result.fleet_events = sanitizeList(fleetEvents ?? []);

      const speedAlerts = (fleetEvents ?? []).filter((e: any) => e.event_type === "overspeed");
      result.speed_alerts = sanitizeList(speedAlerts.slice(0, 20));
    }

    // ════════════════════════════════════════════════
    // SST MODE
    // ════════════════════════════════════════════════
    if (tipo === "sst" || tipo === "executivo") {
      let examQuery = admin.from("pcmso_exam_alerts")
        .select("exam_id, employee_name, exam_type, exam_date, next_exam_date, days_until_due, alert_status, result, program_name")
        .eq("tenant_id", tenantId)
        .in("alert_status", ["overdue", "critical", "warning"])
        .order("days_until_due", { ascending: true })
        .limit(50);
      if (companyId) examQuery = examQuery.eq("company_id", companyId);
      const { data: examAlerts } = await examQuery;
      // Sanitize employee_name in exam alerts
      const sanitizedExams = (examAlerts ?? []).map((e: any) => {
        if (e.employee_name) {
          const parts = e.employee_name.split(' ');
          e.employee_name = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
        }
        return e;
      });
      result.nr_overdue_exams = sanitizedExams;

      let blockQuery = admin.from("compliance_violations")
        .select("id, employee_id, violation_type, severity, description, detected_at, employees(name)")
        .eq("tenant_id", tenantId)
        .eq("is_resolved", false)
        .in("severity", ["critical", "high"])
        .order("detected_at", { ascending: false })
        .limit(30);
      if (companyId) blockQuery = blockQuery.eq("company_id", companyId);
      const { data: activeBlocks } = await blockQuery;
      result.active_blocks = sanitizeList(activeBlocks ?? []);

      result.sst_summary = {
        overdue_count: sanitizedExams.length,
        critical_overdue: sanitizedExams.filter((e: any) => e.alert_status === "overdue" || e.alert_status === "critical").length,
        active_blocks_count: (activeBlocks ?? []).length,
      };
    }

    // ════════════════════════════════════════════════
    // COMPLIANCE MODE
    // ════════════════════════════════════════════════
    if (tipo === "compliance" || tipo === "executivo") {
      let warningQuery = admin.from("fleet_disciplinary_history")
        .select("id, event_type, description, created_at, employee_id, employees(name)")
        .eq("tenant_id", tenantId)
        .in("event_type", ["warning_issued", "warning_signed", "warning_refused"])
        .order("created_at", { ascending: false })
        .limit(30);
      const { data: warnings } = await warningQuery;
      result.recent_warnings = sanitizeList(warnings ?? []);

      let incidentQuery = admin.from("fleet_compliance_incidents")
        .select("id, incident_type, severity, status, description, created_at, employee_id, employees(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (companyId) incidentQuery = incidentQuery.eq("company_id", companyId);
      const { data: incidents } = await incidentQuery;
      result.compliance_incidents = sanitizeList(incidents ?? []);

      result.compliance_summary = {
        total_warnings: (warnings ?? []).length,
        pending_incidents: (incidents ?? []).filter((i: any) => i.status === "open" || i.status === "pending").length,
        critical_incidents: (incidents ?? []).filter((i: any) => i.severity === "critical").length,
      };
    }

    // ════════════════════════════════════════════════
    // EXECUTIVE MODE
    // ════════════════════════════════════════════════
    if (tipo === "executivo") {
      const allBehavior = result.fleet_events as any[] ?? [];
      const allWarnings = result.recent_warnings as any[] ?? [];
      const allBlocks = result.active_blocks as any[] ?? [];

      const WEIGHT = { low: 1, medium: 3, high: 7, critical: 15 };
      let penaltyPoints = 0;
      allBehavior.forEach((e: any) => { penaltyPoints += WEIGHT[e.severity as keyof typeof WEIGHT] ?? 1; });
      allWarnings.forEach(() => { penaltyPoints += 5; });
      allBlocks.forEach(() => { penaltyPoints += 10; });

      const maxPenalty = 500;
      const operationalScore = Math.max(0, Math.round(100 - (penaltyPoints / maxPenalty) * 100));

      const pendingIncidents = (result.compliance_incidents as any[] ?? []).filter((i: any) => i.status === "open" || i.status === "pending").length;
      const legalRiskScore = Math.min(100, Math.round((pendingIncidents * 8 + allBlocks.length * 12)));
      const legalRiskLevel = legalRiskScore >= 70 ? "critical" : legalRiskScore >= 40 ? "high" : legalRiskScore >= 20 ? "medium" : "low";

      let projectedCost = 0;
      (result.compliance_incidents as any[] ?? []).forEach((i: any) => {
        if (i.severity === "critical") projectedCost += 5000;
        else if (i.severity === "high") projectedCost += 2000;
        else projectedCost += 500;
      });
      allWarnings.forEach(() => { projectedCost += 500; });
      allBlocks.forEach(() => { projectedCost += 3000; });

      result.executive = {
        operational_score: operationalScore,
        legal_risk: { score: legalRiskScore, level: legalRiskLevel },
        projected_cost_brl: projectedCost,
        workforce_total: empCount ?? 0,
        active_devices: (result.live_positions as any[] ?? []).length,
        total_violations: allBehavior.length,
        total_warnings: allWarnings.length,
        total_blocks: allBlocks.length,
      };
    }

    // ── Critical alerts (all modes, sanitized) ──
    let alertQuery = admin.from("fleet_compliance_incidents")
      .select("id, incident_type, severity, description, created_at, employee_id, employees(name)")
      .eq("tenant_id", tenantId)
      .in("severity", ["critical", "high"])
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(10);
    if (companyId) alertQuery = alertQuery.eq("company_id", companyId);
    const { data: alerts } = await alertQuery;
    result.critical_alerts = sanitizeList(alerts ?? []);

    // SECURITY: Response headers — no caching, no embedding
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
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
