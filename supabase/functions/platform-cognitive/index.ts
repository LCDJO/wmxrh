import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════════════════════
// In-memory cache — scoped by tenant + intent for isolation.
// TTL keeps responses fast without hitting AI on every request.
// ══════════════════════════════════════════════════════════════════

interface CacheEntry {
  data: unknown;
  ts: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes
const MAX_CACHE_ENTRIES = 100;

function cacheKey(tenantScope: string, intent: string, extra?: string): string {
  return `${tenantScope}::${intent}::${extra ?? ""}`;
}

function getCached(key: string): unknown | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown): void {
  // Evict oldest entries if cache is full
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = [...responseCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 10 && i < oldest.length; i++) {
      responseCache.delete(oldest[i][0]);
    }
  }
  responseCache.set(key, { data, ts: Date.now() });
}

// ══════════════════════════════════════════════════════════════════
// Server
// ══════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Auth (fast path — no heavy queries) ──────────────────────
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("Invalid token");

    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("role, status, email")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!platformUser) throw new Error("Not a platform user");

    // ── Parse request ────────────────────────────────────────────
    const body = await req.json();
    const { intent, advisor_payload, context } = body;

    // ── Cache check (tenant-scoped) ──────────────────────────────
    const tenantScope = String(context?.tenant_id ?? user.id);
    const extraKey = intent === "suggest-permissions"
      ? String(context?.role_name ?? "")
      : "";
    const ck = cacheKey(tenantScope, intent, extraKey);

    const cached = getCached(ck);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Cognitive-Cache": "HIT",
        },
      });
    }

    // ── Build prompts (async but non-blocking to main API) ───────
    let systemPrompt: string;
    let userPrompt: string;

    if (advisor_payload?.system_prompt && advisor_payload?.user_prompt) {
      systemPrompt = advisor_payload.system_prompt;
      userPrompt = advisor_payload.user_prompt;
    } else {
      const serverCtx = await gatherServerContext(supabase, intent, context);
      systemPrompt = buildFallbackSystem(intent, serverCtx, platformUser.role);
      userPrompt = buildFallbackUser(intent, context);
    }

    // ── AI call (with timeout to avoid blocking) ─────────────────
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000); // 25s max

    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "cognitive_response",
                description: "Return structured cognitive suggestions for the platform.",
                parameters: {
                  type: "object",
                  properties: {
                    suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          type: { type: "string", enum: ["permission", "dashboard", "shortcut", "pattern", "setup", "role-simplification", "redundant-permission"] },
                          title: { type: "string" },
                          description: { type: "string" },
                          confidence: { type: "number" },
                          action_label: { type: "string" },
                          metadata: { type: "object" },
                        },
                        required: ["id", "type", "title", "description", "confidence"],
                        additionalProperties: false,
                      },
                    },
                    summary: { type: "string" },
                  },
                  required: ["suggestions", "summary"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "cognitive_response" } },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em instantes." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de AI esgotados." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await aiResponse.text();
        console.error("AI gateway error:", status, errText);
        throw new Error("AI gateway error");
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let result: unknown;
      if (toolCall?.function?.arguments) {
        result = JSON.parse(toolCall.function.arguments);
      } else {
        result = { suggestions: [], summary: "Nenhuma sugestão disponível no momento." };
      }

      // ── Cache the result (tenant-scoped) ─────────────────────
      setCache(ck, result);

      return new Response(JSON.stringify(result), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Cognitive-Cache": "MISS",
        },
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
        return new Response(JSON.stringify({ error: "AI request timed out. Tente novamente." }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchErr;
    }
  } catch (e) {
    console.error("cognitive error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Fallback server-side context (when no advisor_payload is sent) ──

async function gatherServerContext(supabase: any, intent: string, context?: Record<string, unknown>) {
  const [tenantsRes, usersRes, permsRes, rpRes] = await Promise.all([
    supabase.from("tenants").select("id, name, status, created_at").limit(50),
    supabase.from("platform_users").select("id, role, status").limit(100),
    supabase.from("platform_permission_definitions").select("id, code, module, description"),
    supabase.from("platform_role_permissions").select("*"),
  ]);

  return {
    tenants: tenantsRes.data ?? [],
    users: usersRes.data ?? [],
    permissions: permsRes.data ?? [],
    role_permissions: rpRes.data ?? [],
    intent,
    context,
  };
}

function buildFallbackSystem(intent: string, ctx: Record<string, unknown>, callerRole: string) {
  return `You are the Platform Cognitive Layer of "RH Gestão" SaaS.
You analyse platform data and provide NON-DESTRUCTIVE suggestions only.
Caller role: ${callerRole}
Platform context: ${JSON.stringify(ctx)}
Respond in pt-BR. Max 6 suggestions.`;
}

function buildFallbackUser(intent: string, context?: Record<string, unknown>) {
  const map: Record<string, string> = {
    "suggest-permissions": `Suggest ideal permissions for role "${context?.role_name ?? "new role"}".`,
    "audit-permissions": "Audit all role permissions for excessive access, rarely-used permissions, and security risks.",
    "recommend-dashboards": "Recommend relevant dashboards for the caller.",
    "suggest-shortcuts": "Suggest time-saving navigation shortcuts.",
    "detect-patterns": "Detect operational patterns and anomalies.",
    "quick-setup": "Guide through optimal platform configuration.",
    "uge-simplify-roles": buildUGESimplifyPrompt(context),
    "uge-remove-redundant-permissions": buildUGERedundantPrompt(context),
  };
  return map[intent] ?? "Provide general platform optimization suggestions.";
}

// ══════════════════════════════════════════════════════════════════
// UGE-SPECIFIC PROMPTS
// ══════════════════════════════════════════════════════════════════

function buildUGESimplifyPrompt(context?: Record<string, unknown>): string {
  const graphData = context?.uge_graph_data ?? {};
  return `Analyse the following Unified Graph Engine data and suggest role simplification:

ROLE OVERLAPS (roles sharing permissions):
${JSON.stringify((graphData as any).roleOverlaps ?? [], null, 2)}

ROLE LIST:
${JSON.stringify((graphData as any).roles ?? [], null, 2)}

ANALYSIS STATS:
${JSON.stringify((graphData as any).analysisStats ?? {}, null, 2)}

For each suggestion:
- type MUST be "role-simplification"
- Explain which roles can be merged or eliminated
- Estimate impact (users affected)
- Confidence 0–1 based on overlap ratio
- In metadata include: { merge_candidates: string[], overlap_pct: number }`;
}

function buildUGERedundantPrompt(context?: Record<string, unknown>): string {
  const graphData = context?.uge_graph_data ?? {};
  return `Analyse the following Unified Graph Engine data and identify redundant permissions:

PERMISSION USAGE (permissions granted by multiple roles or unused):
${JSON.stringify((graphData as any).permissionUsage ?? [], null, 2)}

EXCESSIVE PERMISSIONS:
${JSON.stringify((graphData as any).excessivePermissions ?? [], null, 2)}

ORPHAN NODES:
${JSON.stringify((graphData as any).orphanNodes ?? [], null, 2)}

For each suggestion:
- type MUST be "redundant-permission"
- Explain why the permission is redundant or unused
- Recommend removal or consolidation
- Confidence 0–1 based on evidence strength
- In metadata include: { permission_code: string, granted_by_roles: string[], reason: "duplicate"|"unused"|"overly_broad" }`;
}
