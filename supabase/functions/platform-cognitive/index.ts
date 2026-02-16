import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Intent =
  | "suggest-permissions"
  | "recommend-dashboards"
  | "suggest-shortcuts"
  | "detect-patterns"
  | "quick-setup";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify caller is a platform user
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("Invalid token");

    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("role, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!platformUser) throw new Error("Not a platform user");

    const { intent, context } = (await req.json()) as { intent: Intent; context?: Record<string, unknown> };

    // Gather platform context for AI
    const platformContext = await gatherContext(supabase, intent, context);

    const systemPrompt = buildSystemPrompt(intent, platformContext, platformUser.role);

    const userPrompt = buildUserPrompt(intent, context);

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
                        id: { type: "string", description: "Unique suggestion ID" },
                        type: { type: "string", enum: ["permission", "dashboard", "shortcut", "pattern", "setup"] },
                        title: { type: "string", description: "Short title (max 60 chars)" },
                        description: { type: "string", description: "Explanation (max 200 chars)" },
                        confidence: { type: "number", description: "0 to 1 confidence score" },
                        action_label: { type: "string", description: "CTA button text (max 20 chars)" },
                        metadata: { type: "object", description: "Extra data for the frontend" },
                      },
                      required: ["id", "type", "title", "description", "confidence"],
                      additionalProperties: false,
                    },
                  },
                  summary: { type: "string", description: "One sentence summary of the analysis" },
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
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();

    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result: unknown;
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      result = { suggestions: [], summary: "Não foi possível gerar sugestões no momento." };
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

// ── Context gathering ──────────────────────────────────────────────

async function gatherContext(supabase: any, intent: Intent, context?: Record<string, unknown>) {
  const data: Record<string, unknown> = {};

  // Always fetch high-level stats
  const [tenantsRes, usersRes, permsRes] = await Promise.all([
    supabase.from("tenants").select("id, name, status, created_at").limit(50),
    supabase.from("platform_users").select("id, role, status, email").limit(100),
    supabase.from("platform_permission_definitions").select("id, code, module, description"),
  ]);

  data.tenants_count = tenantsRes.data?.length ?? 0;
  data.tenants_sample = (tenantsRes.data ?? []).slice(0, 10);
  data.users = usersRes.data ?? [];
  data.permissions = permsRes.data ?? [];

  if (intent === "suggest-permissions") {
    const rpRes = await supabase.from("platform_role_permissions").select("*");
    data.role_permissions = rpRes.data ?? [];
    if (context?.role_name) data.target_role = context.role_name;
  }

  if (intent === "recommend-dashboards" || intent === "suggest-shortcuts") {
    // Pass current user's role context
    data.current_role = context?.current_role ?? "unknown";
    data.available_modules = [
      "dashboard", "tenants", "modules", "users", "security", "audit",
    ];
  }

  return data;
}

// ── Prompt builders ────────────────────────────────────────────────

function buildSystemPrompt(intent: Intent, ctx: Record<string, unknown>, callerRole: string) {
  return `You are the Platform Cognitive Layer of an HR SaaS called "RH Gestão".
You analyse platform data and provide contextual, NON-DESTRUCTIVE suggestions.
You NEVER execute actions — you only recommend.

Caller role: ${callerRole}
Platform context (JSON): ${JSON.stringify(ctx)}

Guidelines:
- Respond ONLY through the cognitive_response tool call.
- Each suggestion must have a clear, actionable title in Portuguese (pt-BR).
- Confidence score: 0.0 (low) to 1.0 (high).
- Keep descriptions concise and professional.
- Provide 3-6 suggestions max.
- For permissions: suggest based on the role's purpose and existing permission patterns.
- For dashboards: recommend based on role relevance.
- For shortcuts: suggest most useful navigation paths.
- For patterns: detect anomalies or optimization opportunities.
- For setup: guide the admin through the best configuration steps.`;
}

function buildUserPrompt(intent: Intent, context?: Record<string, unknown>) {
  const map: Record<Intent, string> = {
    "suggest-permissions": `Suggest the ideal permissions for the role "${context?.role_name ?? "new role"}". Consider what this role typically needs and what permissions are already assigned to similar roles.`,
    "recommend-dashboards": `Based on the caller's role and platform data, recommend which dashboards and data views would be most useful for them right now.`,
    "suggest-shortcuts": `Suggest navigation shortcuts and quick actions that would save time for the current user based on their role and the platform's current state.`,
    "detect-patterns": `Analyze the platform data and detect any operational patterns, anomalies, or optimization opportunities. Focus on user activity, tenant health, and permission configurations.`,
    "quick-setup": `The admin is setting up the platform. Provide step-by-step recommendations for optimal configuration, including roles, permissions, modules, and tenant setup.`,
  };
  return map[intent] ?? "Provide general platform optimization suggestions.";
}
