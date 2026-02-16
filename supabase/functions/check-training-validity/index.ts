/**
 * Edge Function: check-training-validity
 *
 * Scheduled job that scans all active training assignments and:
 *   1. Marks completed trainings as expired when past validity date
 *   2. Marks pending/scheduled trainings as overdue when past due date
 *   3. Applies blocking levels based on NR criticality
 *   4. Generates HR alerts (compliance_violations)
 *   5. Sends insights to Workforce Intelligence
 *
 * Designed to run on a cron schedule (e.g. daily at 06:00 UTC).
 * Can also be called on-demand with POST { tenant_id?: string }.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Blocking rules (mirror of lifecycle.engine.ts) ──

const HARD_BLOCK_NRS = new Set([10, 33, 35]);
const SOFT_BLOCK_NRS = new Set([6, 11, 12, 18, 32]);

function computeBlockingLevel(nrNumber: number): string {
  if (HARD_BLOCK_NRS.has(nrNumber)) return "hard_block";
  if (SOFT_BLOCK_NRS.has(nrNumber)) return "soft_block";
  return "warning";
}

function getBlockingDescription(level: string, nrNumber: number): string {
  if (level === "hard_block")
    return `Colaborador impedido de exercer função — treinamento NR-${nrNumber} vencido. Exposição a acidente grave.`;
  if (level === "soft_block")
    return `Colaborador com restrição de atividades de risco — treinamento NR-${nrNumber} vencido.`;
  return `Alerta: treinamento NR-${nrNumber} vencido. Regularizar com urgência.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const referenceDate = now.toISOString().split("T")[0];

    // Optional: filter by tenant
    let tenantFilter: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        tenantFilter = body.tenant_id ?? null;
      } catch {
        // no body, run for all tenants
      }
    }

    const results = {
      total_scanned: 0,
      expired: 0,
      overdue: 0,
      blocked: 0,
      alerts_created: 0,
      insights_created: 0,
      tenants_processed: 0,
      errors: [] as string[],
    };

    // ── 1. Scan COMPLETED trainings for expiry ──
    let completedQuery = supabase
      .from("nr_training_assignments")
      .select("id, tenant_id, company_id, employee_id, nr_number, training_name, status, data_validade, blocking_level, validity_months, required_hours, cbo_code")
      .eq("status", "completed")
      .not("data_validade", "is", null);

    if (tenantFilter) {
      completedQuery = completedQuery.eq("tenant_id", tenantFilter);
    }

    const { data: completedAssignments, error: completedErr } = await completedQuery;
    if (completedErr) {
      results.errors.push(`Completed query error: ${completedErr.message}`);
    }

    for (const a of completedAssignments ?? []) {
      results.total_scanned++;

      if (a.data_validade && new Date(a.data_validade) <= now) {
        const blockingLevel = computeBlockingLevel(a.nr_number);

        // Update assignment status
        const { error: updateErr } = await supabase
          .from("nr_training_assignments")
          .update({
            status: "expired",
            blocking_level: blockingLevel,
            updated_at: now.toISOString(),
          })
          .eq("id", a.id);

        if (updateErr) {
          results.errors.push(`Update error ${a.id}: ${updateErr.message}`);
          continue;
        }

        results.expired++;
        if (blockingLevel !== "warning") results.blocked++;

        // Audit trail
        await supabase.from("nr_training_audit_log").insert({
          tenant_id: a.tenant_id,
          assignment_id: a.id,
          employee_id: a.employee_id,
          from_status: "completed",
          to_status: "expired",
          performed_by: null,
          reason: "Auto-expired by validity check",
          metadata: { nr_number: a.nr_number, blocking_level: blockingLevel, reference_date: referenceDate },
        });

        // HR Alert (compliance violation)
        const description = getBlockingDescription(blockingLevel, a.nr_number);
        await supabase.from("compliance_violations").insert({
          tenant_id: a.tenant_id,
          employee_id: a.employee_id,
          company_id: a.company_id,
          violation_type: "training_expired",
          description,
          severity: blockingLevel === "hard_block" ? "critical" : blockingLevel === "soft_block" ? "high" : "medium",
          metadata: {
            assignment_id: a.id,
            nr_number: a.nr_number,
            training_name: a.training_name,
            blocking_level: blockingLevel,
            expired_date: a.data_validade,
            detected_at: referenceDate,
          },
        });
        results.alerts_created++;

        // Auto-create renewal assignment
        await supabase.from("nr_training_assignments").insert({
          tenant_id: a.tenant_id,
          company_id: a.company_id,
          employee_id: a.employee_id,
          nr_number: a.nr_number,
          training_name: a.training_name,
          cbo_code: a.cbo_code,
          status: "pending",
          trigger: "renewal",
          required_hours: a.required_hours,
          blocking_level: "none",
          is_renewal: true,
          previous_assignment_id: a.id,
          renewal_number: 1,
          validity_months: a.validity_months,
        });
      }
    }

    // ── 2. Scan PENDING/SCHEDULED trainings for overdue ──
    let pendingQuery = supabase
      .from("nr_training_assignments")
      .select("id, tenant_id, company_id, employee_id, nr_number, training_name, status, due_date, blocking_level")
      .in("status", ["pending", "scheduled"])
      .not("due_date", "is", null);

    if (tenantFilter) {
      pendingQuery = pendingQuery.eq("tenant_id", tenantFilter);
    }

    const { data: pendingAssignments, error: pendingErr } = await pendingQuery;
    if (pendingErr) {
      results.errors.push(`Pending query error: ${pendingErr.message}`);
    }

    for (const a of pendingAssignments ?? []) {
      results.total_scanned++;

      if (a.due_date && new Date(a.due_date) < now) {
        const blockingLevel = computeBlockingLevel(a.nr_number);

        const { error: updateErr } = await supabase
          .from("nr_training_assignments")
          .update({
            status: "overdue",
            blocking_level: blockingLevel,
            updated_at: now.toISOString(),
          })
          .eq("id", a.id);

        if (updateErr) {
          results.errors.push(`Overdue update error ${a.id}: ${updateErr.message}`);
          continue;
        }

        results.overdue++;
        if (blockingLevel !== "warning") results.blocked++;

        // Audit trail
        await supabase.from("nr_training_audit_log").insert({
          tenant_id: a.tenant_id,
          assignment_id: a.id,
          employee_id: a.employee_id,
          from_status: a.status,
          to_status: "overdue",
          performed_by: null,
          reason: "Auto-overdue by validity check",
          metadata: { nr_number: a.nr_number, blocking_level: blockingLevel, due_date: a.due_date, reference_date: referenceDate },
        });

        // HR Alert
        await supabase.from("compliance_violations").insert({
          tenant_id: a.tenant_id,
          employee_id: a.employee_id,
          company_id: a.company_id,
          violation_type: "training_overdue",
          description: `Treinamento NR-${a.nr_number} (${a.training_name}) não realizado no prazo. Vencimento: ${a.due_date}.`,
          severity: blockingLevel === "hard_block" ? "critical" : "high",
          metadata: {
            assignment_id: a.id,
            nr_number: a.nr_number,
            training_name: a.training_name,
            blocking_level: blockingLevel,
            due_date: a.due_date,
          },
        });
        results.alerts_created++;
      }
    }

    // ── 3. Send aggregated insight to Workforce Intelligence ──
    if (results.expired > 0 || results.overdue > 0) {
      // Group by tenant for per-tenant insights
      const tenantIds = new Set<string>();
      for (const a of [...(completedAssignments ?? []), ...(pendingAssignments ?? [])]) {
        tenantIds.add(a.tenant_id);
      }

      for (const tid of tenantIds) {
        // Count per-tenant stats
        const tenantExpired = (completedAssignments ?? []).filter(
          (a) => a.tenant_id === tid && a.data_validade && new Date(a.data_validade) <= now
        ).length;
        const tenantOverdue = (pendingAssignments ?? []).filter(
          (a) => a.tenant_id === tid && a.due_date && new Date(a.due_date) < now
        ).length;

        if (tenantExpired === 0 && tenantOverdue === 0) continue;

        const severity = results.blocked > 0 ? "critical" : tenantExpired > 0 ? "high" : "medium";

        await supabase.from("workforce_insights").insert({
          tenant_id: tid,
          insight_type: "training_validity_alert",
          severity,
          descricao: `Verificação automática detectou ${tenantExpired} treinamento(s) expirado(s) e ${tenantOverdue} em atraso. ${results.blocked > 0 ? `${results.blocked} colaborador(es) bloqueado(s) para exercício de função.` : ""}`,
          dados_origem_json: {
            expired_count: tenantExpired,
            overdue_count: tenantOverdue,
            blocked_count: results.blocked,
            reference_date: referenceDate,
            scan_timestamp: now.toISOString(),
            recomendacao: tenantExpired > 0
              ? "Agendar reciclagem imediata dos treinamentos expirados. Colaboradores bloqueados devem ser afastados das atividades de risco."
              : "Agendar treinamentos pendentes para evitar bloqueio de função.",
          },
        });
        results.insights_created++;
        results.tenants_processed++;
      }
    }

    console.log(`[CheckTrainingValidity] Scan complete:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        reference_date: referenceDate,
        ...results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[CheckTrainingValidity] Fatal error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
