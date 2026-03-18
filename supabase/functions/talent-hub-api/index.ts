import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createHandler,
  jsonResponse,
  validateBody,
  requireRoles,
  type MiddlewareContext,
} from "../_shared/middleware.ts";
import {
  ENRICHMENT_PROVIDERS,
  candidateCreateSchema,
  candidateUpdateSchema,
  pipelineMoveSchema,
  jobCreateSchema,
  jobUpdateSchema,
  enrichmentStartSchema,
  aiAnalyzeSchema,
} from "../_shared/talent-hub-schemas.ts";

const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

Deno.serve(createHandler(async (ctx) => {
  const url = new URL(ctx.request.url);
  const pathname = url.pathname.replace(/^.*\/talent-hub-api/, "") || "/";
  const method = ctx.request.method.toUpperCase();

  if (pathname === "/candidates" && method === "POST") return createCandidate(ctx);
  if (pathname === "/candidates" && method === "GET") return listCandidates(ctx, url);
  if (pathname.startsWith("/candidates/") && pathname.endsWith("/forget") && method === "DELETE") {
    return forgetCandidate(ctx, pathname.split("/")[2]);
  }
  if (pathname.startsWith("/candidates/") && method === "GET") return getCandidate(ctx, pathname.split("/")[2]);
  if (pathname.startsWith("/candidates/") && method === "PUT") return updateCandidate(ctx, pathname.split("/")[2]);
  if (pathname.startsWith("/candidates/") && method === "DELETE") return deleteCandidate(ctx, pathname.split("/")[2]);

  if (pathname === "/pipeline" && method === "GET") return listPipeline(ctx, url);
  if (pathname === "/pipeline/move" && method === "POST") return movePipeline(ctx);
  if (pathname === "/pipeline/kanban" && method === "GET") return kanbanPipeline(ctx, url);

  if (pathname === "/jobs" && method === "POST") return createJob(ctx);
  if (pathname === "/jobs" && method === "GET") return listJobs(ctx, url);
  if (pathname.startsWith("/jobs/") && method === "GET") return getJob(ctx, pathname.split("/")[2]);
  if (pathname.startsWith("/jobs/") && method === "PUT") return updateJob(ctx, pathname.split("/")[2]);
  if (pathname.startsWith("/jobs/") && method === "DELETE") return deleteJob(ctx, pathname.split("/")[2]);

  if (pathname === "/enrichment/start" && method === "POST") return startEnrichment(ctx);
  if (pathname.startsWith("/enrichment/status/") && method === "GET") return enrichmentStatus(ctx, pathname.split("/")[3]);

  if (pathname === "/ai/analyze-candidate" && method === "POST") return analyzeCandidate(ctx);

  return jsonResponse(ctx, { error: "Endpoint not found", path: pathname }, 404);
}, { rateLimit: "sensitive", route: "talent-hub-api", action: "api_request" }));

function adminClient() {
  return createClient(supabaseUrl, serviceRole);
}

function parseLimit(url: URL, fallback = 25, max = 100) {
  const raw = Number(url.searchParams.get("limit") || fallback);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(max, Math.floor(raw));
}

function parseOffset(url: URL) {
  const raw = Number(url.searchParams.get("offset") || 0);
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

async function assertTenantMembership(ctx: MiddlewareContext) {
  const db = adminClient();
  const { data, error } = await db
    .from("tenant_memberships")
    .select("tenant_id, role, status")
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", ctx.userId)
    .in("status", ["active", "accepted"])
    .maybeSingle();

  if (error || !data) {
    throw new Error("Tenant membership not found for authenticated user");
  }

  return data;
}

async function createCandidate(ctx: MiddlewareContext) {
  const body = await validateBody<{
    nome: string;
    email: string;
    telefone?: string;
    cpf_hash: string;
    data_nascimento?: string;
    cidade?: string;
    estado?: string;
    consentimento_lgpd: boolean;
    origem: string;
    metadata_json?: Record<string, unknown>;
    termo_versao?: string;
  }>(ctx, candidateCreateSchema);

  await assertTenantMembership(ctx);
  const db = adminClient();
  const now = new Date().toISOString();

  const candidatePayload = {
    tenant_id: ctx.tenantId,
    nome: body.nome,
    email: body.email.toLowerCase().trim(),
    telefone: body.telefone ?? null,
    cpf_hash: body.cpf_hash,
    data_nascimento: body.data_nascimento ?? null,
    cidade: body.cidade ?? null,
    estado: body.estado?.toUpperCase() ?? null,
    consentimento_lgpd: body.consentimento_lgpd,
    consentimento_data: body.consentimento_lgpd ? now : null,
    origem: body.origem,
    metadata_json: body.metadata_json ?? {},
  };

  const { data: created, error } = await db
    .from("candidates")
    .insert(candidatePayload)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create candidate: ${error.message}`);

  await Promise.all([
    db.from("candidate_logs").insert({
      tenant_id: ctx.tenantId,
      candidate_id: created.id,
      acao: "candidate_created",
      usuario_id: ctx.userId,
      descricao: `Candidato ${created.nome} criado via API`,
      metadata_json: { origem: created.origem },
    }),
    body.consentimento_lgpd
      ? db.from("consent_logs").insert({
          tenant_id: ctx.tenantId,
          candidate_id: created.id,
          termo_versao: body.termo_versao ?? "v1",
          ip: ctx.request.headers.get("x-forwarded-for") || ctx.request.headers.get("cf-connecting-ip") || null,
          user_agent: ctx.request.headers.get("user-agent"),
          data_consentimento: now,
        })
      : Promise.resolve({ error: null }),
  ]);

  return jsonResponse(ctx, created, 201);
}

async function listCandidates(ctx: MiddlewareContext, url: URL) {
  await assertTenantMembership(ctx);
  const limit = parseLimit(url);
  const offset = parseOffset(url);
  const search = url.searchParams.get("search")?.trim();
  const db = adminClient();

  let query = db
    .from("candidates")
    .select("*", { count: "exact" })
    .eq("tenant_id", ctx.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to list candidates: ${error.message}`);
  return jsonResponse(ctx, { items: data ?? [], total: count ?? 0, limit, offset });
}

async function getCandidate(ctx: MiddlewareContext, id: string) {
  await assertTenantMembership(ctx);
  const db = adminClient();

  const [{ data: candidate, error }, docs, scores, enrichments, logs, consents, pipeline] = await Promise.all([
    db.from("candidates").select("*").eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).maybeSingle(),
    db.from("candidate_documents").select("*").eq("tenant_id", ctx.tenantId).eq("candidate_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    db.from("candidate_scores").select("*").eq("tenant_id", ctx.tenantId).eq("candidate_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
    db.from("candidate_enrichment").select("*").eq("tenant_id", ctx.tenantId).eq("candidate_id", id).is("deleted_at", null).order("data_consulta", { ascending: false }),
    db.from("candidate_logs").select("*").eq("tenant_id", ctx.tenantId).eq("candidate_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    db.from("consent_logs").select("*").eq("tenant_id", ctx.tenantId).eq("candidate_id", id).is("deleted_at", null).order("data_consentimento", { ascending: false }),
    db.from("candidate_pipeline").select("*, jobs(id, titulo, status)").eq("tenant_id", ctx.tenantId).eq("candidate_id", id).is("deleted_at", null).order("updated_at", { ascending: false }),
  ]);

  if (error) throw new Error(`Failed to load candidate: ${error.message}`);
  if (!candidate) return jsonResponse(ctx, { error: "Candidate not found" }, 404);

  return jsonResponse(ctx, {
    ...candidate,
    documents: docs.data ?? [],
    latest_scores: scores.data ?? [],
    enrichments: enrichments.data ?? [],
    logs: logs.data ?? [],
    consent_logs: consents.data ?? [],
    pipeline: pipeline.data ?? [],
  });
}

async function updateCandidate(ctx: MiddlewareContext, id: string) {
  const body = await validateBody<Record<string, unknown>>(ctx, candidateUpdateSchema);
  await assertTenantMembership(ctx);
  const db = adminClient();

  const patch: Record<string, unknown> = {
    ...body,
    email: typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined,
    estado: typeof body.estado === "string" ? body.estado.toUpperCase() : undefined,
  };

  if (body.consentimento_lgpd === true && !body.consentimento_data) {
    patch.consentimento_data = new Date().toISOString();
  }

  Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

  const { data, error } = await db
    .from("candidates")
    .update(patch)
    .eq("tenant_id", ctx.tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`Failed to update candidate: ${error.message}`);
  if (!data) return jsonResponse(ctx, { error: "Candidate not found" }, 404);

  await db.from("candidate_logs").insert({
    tenant_id: ctx.tenantId,
    candidate_id: id,
    acao: "candidate_updated",
    usuario_id: ctx.userId,
    descricao: `Candidato ${data.nome} atualizado via API`,
    metadata_json: { updated_fields: Object.keys(patch) },
  });

  return jsonResponse(ctx, data);
}

async function deleteCandidate(ctx: MiddlewareContext, id: string) {
  await assertTenantMembership(ctx);
  const db = adminClient();

  await db.from("candidate_logs").insert({
    tenant_id: ctx.tenantId,
    candidate_id: id,
    acao: "candidate_deleted",
    usuario_id: ctx.userId,
    descricao: "Soft delete de candidato via API",
    metadata_json: {},
  });

  const { error } = await db.from("candidates").delete().eq("tenant_id", ctx.tenantId).eq("id", id);
  if (error) throw new Error(`Failed to delete candidate: ${error.message}`);
  return jsonResponse(ctx, { success: true });
}

async function forgetCandidate(ctx: MiddlewareContext, id: string) {
  requireRoles(ctx, "owner", "admin", "superadmin", "rh");
  const db = adminClient();
  const anonymizedEmail = `${id}@forgotten.local`;

  const { data, error } = await db
    .from("candidates")
    .update({
      nome: "ANONIMIZADO",
      email: anonymizedEmail,
      telefone: null,
      cpf_hash: `forgotten:${id}`,
      data_nascimento: null,
      cidade: null,
      estado: null,
      metadata_json: { forgotten_at: new Date().toISOString(), forgotten_by: ctx.userId },
    })
    .eq("tenant_id", ctx.tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, nome, email")
    .maybeSingle();

  if (error) throw new Error(`Failed to forget candidate: ${error.message}`);
  if (!data) return jsonResponse(ctx, { error: "Candidate not found" }, 404);

  await Promise.all([
    db.from("candidate_logs").insert({
      tenant_id: ctx.tenantId,
      candidate_id: id,
      acao: "candidate_forgotten",
      usuario_id: ctx.userId,
      descricao: "Anonimização LGPD executada",
      metadata_json: { endpoint: "/candidates/{id}/forget" },
    }),
    db.from("consent_logs").insert({
      tenant_id: ctx.tenantId,
      candidate_id: id,
      termo_versao: "forget_request",
      ip: ctx.request.headers.get("x-forwarded-for") || null,
      user_agent: ctx.request.headers.get("user-agent"),
      data_consentimento: new Date().toISOString(),
    }),
  ]);

  return jsonResponse(ctx, { success: true, candidate: data });
}

async function listPipeline(ctx: MiddlewareContext, url: URL) {
  await assertTenantMembership(ctx);
  const status = url.searchParams.get("status");
  const jobId = url.searchParams.get("job_id");
  const db = adminClient();

  let query = db
    .from("candidate_pipeline")
    .select("*, candidates(id, nome, email, cidade, estado, origem), jobs(id, titulo, status)")
    .eq("tenant_id", ctx.tenantId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (jobId) query = query.eq("job_id", jobId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list pipeline: ${error.message}`);
  return jsonResponse(ctx, data ?? []);
}

async function movePipeline(ctx: MiddlewareContext) {
  const body = await validateBody<{
    candidate_id: string;
    job_id?: string;
    status: string;
    score?: number;
    responsavel_id?: string;
    observacoes?: string;
  }>(ctx, pipelineMoveSchema);

  await assertTenantMembership(ctx);
  const db = adminClient();

  const { data, error } = await db
    .from("candidate_pipeline")
    .upsert({
      tenant_id: ctx.tenantId,
      candidate_id: body.candidate_id,
      job_id: body.job_id ?? null,
      status: body.status,
      score: body.score ?? 0,
      responsavel_id: body.responsavel_id ?? ctx.userId,
      observacoes: body.observacoes ?? null,
    }, { onConflict: "tenant_id,candidate_id,job_id" })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to move pipeline: ${error.message}`);

  await db.from("candidate_logs").insert({
    tenant_id: ctx.tenantId,
    candidate_id: body.candidate_id,
    acao: "pipeline_moved",
    usuario_id: ctx.userId,
    descricao: `Pipeline movido para ${body.status}`,
    metadata_json: { job_id: body.job_id ?? null, score: body.score ?? 0 },
  });

  return jsonResponse(ctx, data, 201);
}

async function kanbanPipeline(ctx: MiddlewareContext, url: URL) {
  await assertTenantMembership(ctx);
  const jobId = url.searchParams.get("job_id");
  const db = adminClient();

  let query = db
    .from("candidate_pipeline")
    .select("id, status, score, updated_at, observacoes, candidates(id, nome, email, origem), jobs(id, titulo)")
    .eq("tenant_id", ctx.tenantId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (jobId) query = query.eq("job_id", jobId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to build kanban: ${error.message}`);

  const grouped = ["novo", "triagem", "entrevista", "proposta", "contratado", "rejeitado"].map((status) => ({
    status,
    items: (data ?? []).filter((item: any) => item.status === status),
  }));

  return jsonResponse(ctx, grouped);
}

async function createJob(ctx: MiddlewareContext) {
  const body = await validateBody<Record<string, unknown>>(ctx, jobCreateSchema);
  await assertTenantMembership(ctx);
  const db = adminClient();

  const payload = {
    tenant_id: ctx.tenantId,
    titulo: body.titulo,
    descricao: body.descricao ?? null,
    requisitos: body.requisitos ?? [],
    salario: body.salario ?? null,
    status: body.status ?? "draft",
    metadata_json: body.metadata_json ?? {},
  };

  const { data, error } = await db.from("jobs").insert(payload).select("*").single();
  if (error) throw new Error(`Failed to create job: ${error.message}`);
  return jsonResponse(ctx, data, 201);
}

async function listJobs(ctx: MiddlewareContext, url: URL) {
  await assertTenantMembership(ctx);
  const limit = parseLimit(url);
  const offset = parseOffset(url);
  const status = url.searchParams.get("status");
  const db = adminClient();

  let query = db
    .from("jobs")
    .select("*", { count: "exact" })
    .eq("tenant_id", ctx.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to list jobs: ${error.message}`);
  return jsonResponse(ctx, { items: data ?? [], total: count ?? 0, limit, offset });
}

async function getJob(ctx: MiddlewareContext, id: string) {
  await assertTenantMembership(ctx);
  const db = adminClient();
  const { data, error } = await db.from("jobs").select("*").eq("tenant_id", ctx.tenantId).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(`Failed to get job: ${error.message}`);
  if (!data) return jsonResponse(ctx, { error: "Job not found" }, 404);
  return jsonResponse(ctx, data);
}

async function updateJob(ctx: MiddlewareContext, id: string) {
  const body = await validateBody<Record<string, unknown>>(ctx, jobUpdateSchema);
  await assertTenantMembership(ctx);
  const db = adminClient();

  const patch = { ...body };
  Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

  const { data, error } = await db
    .from("jobs")
    .update(patch)
    .eq("tenant_id", ctx.tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`Failed to update job: ${error.message}`);
  if (!data) return jsonResponse(ctx, { error: "Job not found" }, 404);
  return jsonResponse(ctx, data);
}

async function deleteJob(ctx: MiddlewareContext, id: string) {
  requireRoles(ctx, "owner", "admin", "superadmin", "rh");
  const db = adminClient();
  const { error } = await db.from("jobs").delete().eq("tenant_id", ctx.tenantId).eq("id", id);
  if (error) throw new Error(`Failed to delete job: ${error.message}`);
  return jsonResponse(ctx, { success: true });
}

async function startEnrichment(ctx: MiddlewareContext) {
  const body = await validateBody<{
    candidate_id: string;
    providers?: string[];
    identifier?: string;
    identifier_type?: "cpf" | "cnpj";
  }>(ctx, enrichmentStartSchema);

  await assertTenantMembership(ctx);
  const db = adminClient();

  const providers = Array.isArray(body.providers) && body.providers.length > 0
    ? body.providers.filter((item) => ENRICHMENT_PROVIDERS.includes(item as any))
    : ["receita_federal", "cnj", "tst", "ceis", "trabalho_escravo"];

  const { data: candidate, error: candidateError } = await db
    .from("candidates")
    .select("id, tenant_id, nome, email")
    .eq("tenant_id", ctx.tenantId)
    .eq("id", body.candidate_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (candidateError) throw new Error(`Failed to load candidate for enrichment: ${candidateError.message}`);
  if (!candidate) return jsonResponse(ctx, { error: "Candidate not found" }, 404);

  const jobs = providers.map((provider) => ({
    tenant_id: ctx.tenantId,
    candidate_id: body.candidate_id,
    provider,
    job_type: "enrichment",
    status: "pending",
    payload: {
      candidate_id: body.candidate_id,
      identifier: body.identifier ?? null,
      identifier_type: body.identifier_type ?? null,
      requested_by: ctx.userId,
    },
  }));

  const { data: inserted, error } = await db.from("talent_enrichment_jobs").insert(jobs).select("id, provider, status, scheduled_at");
  if (error) throw new Error(`Failed to queue enrichment: ${error.message}`);

  await db.from("candidate_logs").insert({
    tenant_id: ctx.tenantId,
    candidate_id: body.candidate_id,
    acao: "enrichment_started",
    usuario_id: ctx.userId,
    descricao: `Enrichment iniciado para ${providers.length} providers`,
    metadata_json: { providers },
  });

  const workerUrl = `${supabaseUrl}/functions/v1/talent-hub-worker?action=process-next`;
  fetch(workerUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
      "x-tenant-id": ctx.tenantId,
    },
    body: JSON.stringify({ tenant_id: ctx.tenantId }),
  }).catch((err) => console.error("[talent-hub-api] worker trigger failed", err));

  return jsonResponse(ctx, { candidate, jobs: inserted ?? [] }, 202);
}

async function enrichmentStatus(ctx: MiddlewareContext, candidateId: string) {
  await assertTenantMembership(ctx);
  const db = adminClient();

  const [jobsRes, enrRes, scoreRes] = await Promise.all([
    db.from("talent_enrichment_jobs").select("id, provider, status, attempts, last_error, scheduled_at, started_at, completed_at, result").eq("tenant_id", ctx.tenantId).eq("candidate_id", candidateId).order("created_at", { ascending: false }),
    db.from("candidate_enrichment").select("id, fonte, score_risco, data_consulta, dados_json").eq("tenant_id", ctx.tenantId).eq("candidate_id", candidateId).is("deleted_at", null).order("data_consulta", { ascending: false }),
    db.from("candidate_scores").select("*").eq("tenant_id", ctx.tenantId).eq("candidate_id", candidateId).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (jobsRes.error) throw new Error(`Failed to load enrichment jobs: ${jobsRes.error.message}`);
  if (enrRes.error) throw new Error(`Failed to load enrichment data: ${enrRes.error.message}`);
  if (scoreRes.error) throw new Error(`Failed to load candidate score: ${scoreRes.error.message}`);

  return jsonResponse(ctx, {
    jobs: jobsRes.data ?? [],
    enrichments: enrRes.data ?? [],
    latest_score: scoreRes.data ?? null,
  });
}

async function analyzeCandidate(ctx: MiddlewareContext) {
  const body = await validateBody<{ candidate_id: string; focus?: string }>(ctx, aiAnalyzeSchema);
  await assertTenantMembership(ctx);
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const db = adminClient();
  const [candidateRes, enrichRes, scoreRes] = await Promise.all([
    db.from("candidates").select("*").eq("tenant_id", ctx.tenantId).eq("id", body.candidate_id).is("deleted_at", null).maybeSingle(),
    db.from("candidate_enrichment").select("fonte, score_risco, dados_json, data_consulta").eq("tenant_id", ctx.tenantId).eq("candidate_id", body.candidate_id).is("deleted_at", null).order("data_consulta", { ascending: false }),
    db.from("candidate_scores").select("*").eq("tenant_id", ctx.tenantId).eq("candidate_id", body.candidate_id).is("deleted_at", null).order("created_at", { ascending: false }).limit(3),
  ]);

  if (candidateRes.error) throw new Error(`Failed to load candidate for AI: ${candidateRes.error.message}`);
  if (!candidateRes.data) return jsonResponse(ctx, { error: "Candidate not found" }, 404);
  if (enrichRes.error) throw new Error(`Failed to load enrichments for AI: ${enrichRes.error.message}`);
  if (scoreRes.error) throw new Error(`Failed to load scores for AI: ${scoreRes.error.message}`);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "Você é um analista de recrutamento e risk intelligence. Responda em Português (BR) com análise objetiva, riscos, sinais positivos e recomendação final.",
        },
        {
          role: "user",
          content: JSON.stringify({
            candidate: candidateRes.data,
            enrichments: enrichRes.data ?? [],
            latest_scores: scoreRes.data ?? [],
            focus: body.focus ?? "Análise geral do candidato para triagem e decisão.",
          }),
        },
      ],
    }),
  });

  const aiBody = await response.text();
  if (!response.ok) throw new Error(`AI analysis failed [${response.status}]: ${aiBody}`);

  let parsed: any;
  try {
    parsed = JSON.parse(aiBody);
  } catch {
    parsed = { raw: aiBody };
  }

  await db.from("candidate_logs").insert({
    tenant_id: ctx.tenantId,
    candidate_id: body.candidate_id,
    acao: "ai_analysis_requested",
    usuario_id: ctx.userId,
    descricao: "Análise de IA executada para o candidato",
    metadata_json: { focus: body.focus ?? null },
  });

  return jsonResponse(ctx, parsed);
}
