import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Auth ─────────────────────────────────────────────────────
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

    // If the frontend sent a pre-built advisor payload, use it.
    // Otherwise fall back to server-side prompt building.
    let systemPrompt: string;
    let userPrompt: string;

    if (advisor_payload?.system_prompt && advisor_payload?.user_prompt) {
      systemPrompt = advisor_payload.system_prompt;
      userPrompt = advisor_payload.user_prompt;
    } else {
      // Fallback: gather context server-side
      const serverCtx = await gatherServerContext(supabase, intent, context);
      systemPrompt = buildFallbackSystem(intent, serverCtx, platformUser.role);
      userPrompt = buildFallbackUser(intent, context);
    }

    // ── AI call ──────────────────────────────────────────────────
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
                        type: { type: "string", enum: ["permission", "dashboard", "shortcut", "pattern", "setup"] },
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
    });

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

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
    supabase.from("platform_users").select("id, role, status, email").limit(100),
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
    "recommend-dashboards": "Recommend relevant dashboards for the caller.",
    "suggest-shortcuts": "Suggest time-saving navigation shortcuts.",
    "detect-patterns": "Detect operational patterns and anomalies.",
    "quick-setup": "Guide through optimal platform configuration.",
  };
  return map[intent] ?? "Provide general platform optimization suggestions.";
}
