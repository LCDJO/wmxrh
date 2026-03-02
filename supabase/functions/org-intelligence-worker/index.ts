import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Job {
  id: string;
  tenant_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Fetch pending jobs (oldest first, by priority)
    const { data: jobs, error: fetchErr } = await supabase
      .from("org_intelligence_jobs")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("priority", { ascending: true })
      .order("scheduled_at", { ascending: true })
      .limit(10);

    if (fetchErr) throw fetchErr;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const job of jobs as Job[]) {
      // Mark as processing
      await supabase
        .from("org_intelligence_jobs")
        .update({ status: "processing", started_at: new Date().toISOString(), attempts: job.attempts + 1 })
        .eq("id", job.id);

      try {
        const result = await processJob(supabase, job);

        await supabase
          .from("org_intelligence_jobs")
          .update({ status: "completed", result, completed_at: new Date().toISOString() })
          .eq("id", job.id);

        processed++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const newStatus = job.attempts + 1 >= job.max_attempts ? "failed" : "pending";

        await supabase
          .from("org_intelligence_jobs")
          .update({
            status: newStatus,
            error_message: errorMsg,
            scheduled_at: newStatus === "pending"
              ? new Date(Date.now() + (job.attempts + 1) * 60000).toISOString()
              : undefined,
          })
          .eq("id", job.id);

        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, total: jobs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Job Processors ──

async function processJob(
  supabase: ReturnType<typeof createClient>,
  job: Job,
): Promise<Record<string, unknown>> {
  switch (job.job_type) {
    case "turnover_calc":
      return await calcTurnover(supabase, job);
    case "risk_heatmap":
      return await calcRiskHeatmap(supabase, job);
    case "absenteeism_index":
      return await calcAbsenteeism(supabase, job);
    case "headcount_snapshot":
      return await calcHeadcount(supabase, job);
    case "performance_summary":
      return await calcPerformanceSummary(supabase, job);
    case "disciplinary_patterns":
      return await calcDisciplinaryPatterns(supabase, job);
    default:
      throw new Error(`Unknown job type: ${job.job_type}`);
  }
}

async function calcTurnover(supabase: ReturnType<typeof createClient>, job: Job) {
  const { tenant_id, payload } = job;
  const periodStart = (payload.period_start as string) ?? new Date(Date.now() - 30 * 86400000).toISOString();
  const periodEnd = (payload.period_end as string) ?? new Date().toISOString();

  // Count events from governance_events
  const { data: hiredEvents } = await supabase
    .from("governance_events")
    .select("id")
    .eq("tenant_id", tenant_id)
    .eq("event_type", "EmployeeHired")
    .gte("occurred_at", periodStart)
    .lte("occurred_at", periodEnd);

  const { data: terminatedEvents } = await supabase
    .from("governance_events")
    .select("id")
    .eq("tenant_id", tenant_id)
    .eq("event_type", "EmployeeTerminated")
    .gte("occurred_at", periodStart)
    .lte("occurred_at", periodEnd);

  const hired = hiredEvents?.length ?? 0;
  const terminated = terminatedEvents?.length ?? 0;
  const avgHeadcount = Math.max(1, hired); // simplified
  const turnoverRate = avgHeadcount > 0 ? (terminated / avgHeadcount) * 100 : 0;

  const metrics = { hired, terminated, turnover_rate: Math.round(turnoverRate * 100) / 100 };

  // Save snapshot
  await supabase.from("org_intelligence_snapshots").upsert([{
    tenant_id,
    snapshot_type: "turnover",
    period_type: (payload.period_type as string) ?? "monthly",
    period_start: periodStart.split("T")[0],
    period_end: periodEnd.split("T")[0],
    metrics,
    computed_at: new Date().toISOString(),
  }], { onConflict: "tenant_id,snapshot_type,period_type,period_start" });

  return metrics;
}

async function calcRiskHeatmap(supabase: ReturnType<typeof createClient>, job: Job) {
  const { tenant_id, payload } = job;
  const periodStart = (payload.period_start as string) ?? new Date(Date.now() - 30 * 86400000).toISOString();

  const eventTypes = ["EmployeeWarned", "EmployeeSuspended", "EmployeeTerminated"];
  const counts: Record<string, number> = {};

  for (const et of eventTypes) {
    const { data } = await supabase
      .from("governance_events")
      .select("id, payload")
      .eq("tenant_id", tenant_id)
      .eq("event_type", et)
      .gte("occurred_at", periodStart);

    counts[et] = data?.length ?? 0;
  }

  const metrics = {
    warnings: counts["EmployeeWarned"],
    suspensions: counts["EmployeeSuspended"],
    terminations: counts["EmployeeTerminated"],
    composite_risk: (counts["EmployeeWarned"] * 10) + (counts["EmployeeSuspended"] * 25) + (counts["EmployeeTerminated"] * 40),
  };

  await supabase.from("org_intelligence_snapshots").upsert([{
    tenant_id,
    snapshot_type: "risk",
    period_type: "monthly",
    period_start: periodStart.split("T")[0],
    period_end: new Date().toISOString().split("T")[0],
    metrics,
    computed_at: new Date().toISOString(),
  }], { onConflict: "tenant_id,snapshot_type,period_type,period_start" });

  return metrics;
}

async function calcAbsenteeism(supabase: ReturnType<typeof createClient>, job: Job) {
  const { tenant_id, payload } = job;
  const periodStart = (payload.period_start as string) ?? new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: leaveEvents } = await supabase
    .from("governance_events")
    .select("id, payload")
    .eq("tenant_id", tenant_id)
    .eq("event_type", "EmployeeLeaveStarted")
    .gte("occurred_at", periodStart);

  const { data: suspensionEvents } = await supabase
    .from("governance_events")
    .select("id, payload")
    .eq("tenant_id", tenant_id)
    .eq("event_type", "EmployeeSuspended")
    .gte("occurred_at", periodStart);

  const metrics = {
    total_leaves: leaveEvents?.length ?? 0,
    total_suspensions: suspensionEvents?.length ?? 0,
    total_absences: (leaveEvents?.length ?? 0) + (suspensionEvents?.length ?? 0),
  };

  await supabase.from("org_intelligence_snapshots").upsert([{
    tenant_id,
    snapshot_type: "absenteeism",
    period_type: "monthly",
    period_start: periodStart.split("T")[0],
    period_end: new Date().toISOString().split("T")[0],
    metrics,
    computed_at: new Date().toISOString(),
  }], { onConflict: "tenant_id,snapshot_type,period_type,period_start" });

  return metrics;
}

async function calcHeadcount(supabase: ReturnType<typeof createClient>, job: Job) {
  const { tenant_id } = job;

  const { data: hired } = await supabase
    .from("governance_events")
    .select("id")
    .eq("tenant_id", tenant_id)
    .eq("event_type", "EmployeeHired");

  const { data: terminated } = await supabase
    .from("governance_events")
    .select("id")
    .eq("tenant_id", tenant_id)
    .eq("event_type", "EmployeeTerminated");

  const metrics = {
    total_hired_ever: hired?.length ?? 0,
    total_terminated_ever: terminated?.length ?? 0,
    estimated_active: (hired?.length ?? 0) - (terminated?.length ?? 0),
  };

  await supabase.from("org_intelligence_snapshots").upsert([{
    tenant_id,
    snapshot_type: "headcount",
    period_type: "daily",
    period_start: new Date().toISOString().split("T")[0],
    period_end: new Date().toISOString().split("T")[0],
    metrics,
    computed_at: new Date().toISOString(),
  }], { onConflict: "tenant_id,snapshot_type,period_type,period_start" });

  return metrics;
}

async function calcPerformanceSummary(supabase: ReturnType<typeof createClient>, job: Job) {
  const { tenant_id, payload } = job;
  const periodStart = (payload.period_start as string) ?? new Date(Date.now() - 90 * 86400000).toISOString();

  const { data: reviews } = await supabase
    .from("governance_events")
    .select("payload")
    .eq("tenant_id", tenant_id)
    .eq("event_type", "PerformanceReviewCompleted")
    .gte("occurred_at", periodStart);

  const scores = (reviews ?? []).map(r => {
    const p = r.payload as Record<string, unknown>;
    return (p.score as number) ?? 0;
  });

  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const metrics = {
    total_reviews: scores.length,
    average_score: Math.round(avg * 100) / 100,
    min_score: scores.length > 0 ? Math.min(...scores) : 0,
    max_score: scores.length > 0 ? Math.max(...scores) : 0,
  };

  await supabase.from("org_intelligence_snapshots").upsert([{
    tenant_id,
    snapshot_type: "performance",
    period_type: "monthly",
    period_start: periodStart.split("T")[0],
    period_end: new Date().toISOString().split("T")[0],
    metrics,
    computed_at: new Date().toISOString(),
  }], { onConflict: "tenant_id,snapshot_type,period_type,period_start" });

  return metrics;
}

async function calcDisciplinaryPatterns(supabase: ReturnType<typeof createClient>, job: Job) {
  const { tenant_id, payload } = job;
  const periodStart = (payload.period_start as string) ?? new Date(Date.now() - 90 * 86400000).toISOString();

  const { data: warnings } = await supabase
    .from("governance_events")
    .select("payload, occurred_at")
    .eq("tenant_id", tenant_id)
    .eq("event_type", "EmployeeWarned")
    .gte("occurred_at", periodStart);

  // Detect repeat offenders
  const employeeCounts: Record<string, number> = {};
  for (const w of warnings ?? []) {
    const p = w.payload as Record<string, unknown>;
    const empId = (p.employee_id as string) ?? "unknown";
    employeeCounts[empId] = (employeeCounts[empId] ?? 0) + 1;
  }

  const repeatOffenders = Object.entries(employeeCounts)
    .filter(([, count]) => count >= 2)
    .map(([id, count]) => ({ employee_id: id, warning_count: count }))
    .sort((a, b) => b.warning_count - a.warning_count);

  const metrics = {
    total_warnings: warnings?.length ?? 0,
    unique_employees_warned: Object.keys(employeeCounts).length,
    repeat_offenders: repeatOffenders.slice(0, 20),
    repeat_offender_count: repeatOffenders.length,
  };

  await supabase.from("org_intelligence_snapshots").upsert([{
    tenant_id,
    snapshot_type: "disciplinary_patterns",
    period_type: "monthly",
    period_start: periodStart.split("T")[0],
    period_end: new Date().toISOString().split("T")[0],
    metrics,
    computed_at: new Date().toISOString(),
  }], { onConflict: "tenant_id,snapshot_type,period_type,period_start" });

  return metrics;
}
