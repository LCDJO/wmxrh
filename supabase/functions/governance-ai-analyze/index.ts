import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Authentication ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // ── Validate tenant membership ──
    const body = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { analysis_type, context, tenant_id } = body;

    if (tenant_id) {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: membership } = await adminClient
        .from("tenant_memberships")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", tenant_id)
        .eq("status", "active")
        .maybeSingle();

      if (!membership) {
        // Check if platform super admin
        const { data: isPlatform } = await adminClient.rpc("has_platform_role", {
          _role: "platform_super_admin",
          _user_id: userId,
        });
        if (!isPlatform) {
          return new Response(JSON.stringify({ error: "Access denied" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const systemPrompt = `You are a Governance AI Analyst for an enterprise HR platform. 
You analyze security access graphs, risk scores, and compliance data.
Respond in Brazilian Portuguese. Be concise and actionable.

Analysis type: ${analysis_type}
${tenant_id ? `Tenant scope: ${tenant_id}` : 'Global scope'}

Context:
- Risk Score: ${context.risk_score}/100 (Level: ${context.risk_level})
- Graph: ${context.node_count} nodes, ${context.edge_count} edges
- SoD Conflicts: ${context.sod_conflicts}
- Users analyzed: ${context.user_scores?.length ?? 0}

Current insights detected by heuristic engine:
${context.insights?.slice(0, 10).map((i: any) => `- [${i.severity}] ${i.title}: ${i.description}`).join('\n')}

High-risk users:
${context.user_scores?.filter((u: any) => u.score >= 50).map((u: any) => `- ${u.label}: score ${u.score}`).join('\n') || 'None'}`;

    const userPrompt = analysis_type === 'deep_risk'
      ? 'Forneça uma análise profunda dos riscos de segurança, incluindo: 1) Avaliação geral, 2) Riscos prioritários, 3) Recomendações de remediação com prioridade, 4) Previsão de tendência para 30 e 90 dias.'
      : analysis_type === 'compliance_audit'
      ? 'Realize uma auditoria de compliance considerando LGPD, SOX e ISO 27001. Identifique gaps e sugira remediações.'
      : analysis_type === 'remediation_plan'
      ? 'Crie um plano detalhado de remediação para os insights detectados, ordenado por prioridade e estimativa de redução de risco.'
      : analysis_type === 'referral_fraud'
      ? `Analise os seguintes padrões de fraude em referral detectados pelo motor heurístico:

Tipos de fraude detectados:
- Abuso de indicações (referral_abuse): picos de volume, auto-referral, reward cap excedido
- Loops de referral (referral_loop): cadeias circulares A→B→A ou A→B→C→A
- Uso excessivo de cupons via referral (referral_coupon_abuse): múltiplos resgates, acúmulo de recompensas

Para cada insight, forneça:
1) Confirmação ou refutação do padrão (com grau de confiança)
2) Impacto financeiro estimado
3) Recomendação de remediação específica
4) Se o padrão indica fraude organizada ou uso indevido acidental
5) Projeção de risco se não remediado em 30 e 90 dias`
      : 'Analise as tendências de risco e projete cenários para 30 e 90 dias, considerando os padrões atuais.';

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              name: "governance_analysis",
              description: "Return structured governance analysis result",
              parameters: {
                type: "object",
                properties: {
                  analysis: { type: "string", description: "Detailed analysis text in Portuguese" },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        action_type: { type: "string", enum: ["remove_role", "remove_permission", "merge_roles", "restrict_scope", "add_mfa", "custom"] },
                        estimated_risk_reduction: { type: "number", description: "0-100 percentage" },
                      },
                      required: ["priority", "title", "description", "action_type", "estimated_risk_reduction"],
                      additionalProperties: false,
                    },
                  },
                  risk_forecast: {
                    type: "object",
                    properties: {
                      current_score: { type: "number" },
                      projected_30d: { type: "number" },
                      projected_90d: { type: "number" },
                      trend: { type: "string", enum: ["improving", "stable", "worsening"] },
                      factors: { type: "array", items: { type: "string" } },
                    },
                    required: ["current_score", "projected_30d", "projected_90d", "trend", "factors"],
                    additionalProperties: false,
                  },
                  compliance_gaps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        regulation: { type: "string" },
                        requirement: { type: "string" },
                        current_status: { type: "string", enum: ["compliant", "partial", "non_compliant"] },
                        remediation_effort: { type: "string", enum: ["low", "medium", "high"] },
                      },
                      required: ["regulation", "requirement", "current_status", "remediation_effort"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["analysis", "recommendations"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "governance_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Add credits to your workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let result;
    if (toolCall?.function?.arguments) {
      result = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments) 
        : toolCall.function.arguments;
    } else {
      result = {
        analysis: aiData.choices?.[0]?.message?.content ?? "Analysis unavailable",
        recommendations: [],
      };
    }

    result.generated_at = Date.now();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("governance-ai-analyze error:", e);
    return new Response(JSON.stringify({ error: "Failed to analyze governance data" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
