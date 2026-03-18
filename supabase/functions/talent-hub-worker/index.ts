import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveEnrichmentProvider, buildScoreSnapshot } from "../_shared/talent-hub-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tenant-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "process-next";
    if (action !== "process-next") {
      return json({ error: "Unsupported action" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    const expectedAuth = `Bearer ${serviceRole}`;
    if (authHeader !== expectedAuth) {
      return json({ error: "Unauthorized" }, 401);
    }

    const db = createClient(supabaseUrl, serviceRole);
    const body = req.headers.get("content-type")?.includes("application/json") ? await req.json().catch(() => ({})) : {};
    const tenantId = body?.tenant_id ?? req.headers.get("x-tenant-id") ?? null;

    let query = db
      .from("talent_enrichment_jobs")
      .select("*")
      .eq("job_type", "enrichment")
      .eq("status", "pending")
      .order("priority", { ascending: true })
      .order("scheduled_at", { ascending: true })
      .limit(1);

    if (tenantId) query = query.eq("tenant_id", tenantId);

    const { data: jobs, error } = await query;
    if (error) throw new Error(`Failed to load jobs: ${error.message}`);
    const job = jobs?.[0];
    if (!job) return json({ processed: false, reason: "no_pending_jobs" });

    const startedAt = new Date().toISOString();
    const { error: markError } = await db
      .from("talent_enrichment_jobs")
      .update({ status: "running", attempts: (job.attempts ?? 0) + 1, started_at: startedAt, last_error: null })
      .eq("id", job.id)
      .eq("status", "pending");

    if (markError) throw new Error(`Failed to lock job: ${markError.message}`);

    const { data: candidate, error: candidateError } = await db
      .from("candidates")
      .select("id, tenant_id, nome, email, telefone, cpf_hash, cidade, estado, origem, metadata_json")
      .eq("tenant_id", job.tenant_id)
      .eq("id", job.candidate_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (candidateError) throw new Error(`Failed to load candidate: ${candidateError.message}`);
    if (!candidate) throw new Error("Candidate not found for enrichment job");

    const providerResult = await resolveEnrichmentProvider(job.provider, {
      candidate,
      identifier: job.payload?.identifier ?? null,
      identifierType: job.payload?.identifier_type ?? null,
    });

    const enrichmentRow = {
      tenant_id: job.tenant_id,
      candidate_id: job.candidate_id,
      fonte: providerResult.provider,
      dados_json: providerResult.structuredData,
      score_risco: providerResult.riskScore,
      data_consulta: providerResult.fetchedAt,
      deleted_at: null,
    };

    const { error: enrichmentError } = await db
      .from("candidate_enrichment")
      .upsert(enrichmentRow, { onConflict: "tenant_id,candidate_id,fonte" });

    if (enrichmentError) throw new Error(`Failed to persist enrichment: ${enrichmentError.message}`);

    const { data: allEnrichments, error: allEnrichmentsError } = await db
      .from("candidate_enrichment")
      .select("fonte, score_risco, dados_json, data_consulta")
      .eq("tenant_id", job.tenant_id)
      .eq("candidate_id", job.candidate_id)
      .is("deleted_at", null);

    if (allEnrichmentsError) throw new Error(`Failed to load candidate enrichments: ${allEnrichmentsError.message}`);

    const normalizedResults = (allEnrichments ?? []).map((item: any) => ({
      provider: item.fonte,
      mode: "real",
      structuredData: item.dados_json ?? {},
      riskScore: Number(item.score_risco ?? 0),
      notes: [],
      fetchedAt: item.data_consulta,
    }));

    const scoreSnapshot = buildScoreSnapshot(normalizedResults);
    const { error: scoreError } = await db.from("candidate_scores").insert({
      tenant_id: job.tenant_id,
      candidate_id: job.candidate_id,
      ...scoreSnapshot,
    });

    if (scoreError) throw new Error(`Failed to persist candidate score: ${scoreError.message}`);

    await Promise.all([
      db.from("candidate_logs").insert({
        tenant_id: job.tenant_id,
        candidate_id: job.candidate_id,
        acao: "enrichment_completed",
        usuario_id: job.payload?.requested_by ?? null,
        descricao: `Provider ${job.provider} processado com sucesso`,
        metadata_json: {
          provider: job.provider,
          mode: providerResult.mode,
          risk_score: providerResult.riskScore,
          notes: providerResult.notes,
        },
      }),
      db.from("talent_enrichment_jobs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        result: {
          provider: providerResult.provider,
          mode: providerResult.mode,
          risk_score: providerResult.riskScore,
          fetched_at: providerResult.fetchedAt,
          notes: providerResult.notes,
        },
      }).eq("id", job.id),
    ]);

    const pendingSameTenant = await db
      .from("talent_enrichment_jobs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", job.tenant_id)
      .eq("job_type", "enrichment")
      .eq("status", "pending");

    if ((pendingSameTenant.count ?? 0) > 0) {
      fetch(`${supabaseUrl}/functions/v1/talent-hub-worker?action=process-next`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRole}`,
          "Content-Type": "application/json",
          "x-tenant-id": job.tenant_id,
        },
        body: JSON.stringify({ tenant_id: job.tenant_id }),
      }).catch((err) => console.error("[talent-hub-worker] recursive trigger failed", err));
    }

    return json({ processed: true, job_id: job.id, provider: job.provider, candidate_id: job.candidate_id });
  } catch (error) {
    console.error("[talent-hub-worker]", error);

    const db = createClient(supabaseUrl, serviceRole);
    const authHeader = req.headers.get("Authorization");
    if (authHeader === `Bearer ${serviceRole}`) {
      const body = req.headers.get("content-type")?.includes("application/json") ? await req.json().catch(() => ({})) : {};
      const tenantId = body?.tenant_id ?? req.headers.get("x-tenant-id") ?? null;
      if (tenantId) {
        const { data: runningJobs } = await db
          .from("talent_enrichment_jobs")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("status", "running")
          .order("started_at", { ascending: false })
          .limit(1);

        const runningJobId = runningJobs?.[0]?.id;
        if (runningJobId) {
          await db.from("talent_enrichment_jobs").update({
            status: "failed",
            completed_at: new Date().toISOString(),
            last_error: error instanceof Error ? error.message : String(error),
          }).eq("id", runningJobId);
        }
      }
    }

    return json({
      processed: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
