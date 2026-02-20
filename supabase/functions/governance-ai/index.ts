import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, tenant_id, trend_data, compliance_data, audit_data, coupon_data, landing_data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = "";
    let tools: any[] | undefined;
    let tool_choice: any | undefined;

    switch (action) {
      // ═══════════════════════════════════
      // PREDICTIVE RISK ANALYSIS
      // ═══════════════════════════════════
      case "predict_risk": {
        systemPrompt = `You are a security governance AI analyst for a multi-tenant HR platform.
Analyze historical risk trend data and predict future risk trajectory.
Be specific, quantitative, and actionable. Use Portuguese (BR) for all text.`;

        userPrompt = `Analise os seguintes dados de tendência de risco e forneça uma previsão:

SCORE ATUAL: ${trend_data.current_score}/100
TENDÊNCIA: ${JSON.stringify(trend_data.trend)}

HISTÓRICO (últimos snapshots):
${JSON.stringify(trend_data.snapshots.map((s: any) => ({
  date: s.snapshot_at,
  score: s.risk_score,
  level: s.risk_level,
  signals: s.signal_count,
  critical: s.critical_count,
  high_risk_users: s.high_risk_users,
})), null, 2)}

Preveja o nível de risco para os próximos 7 dias.`;

        tools = [{
          type: "function",
          function: {
            name: "risk_forecast",
            description: "Return structured risk forecast data",
            parameters: {
              type: "object",
              properties: {
                predicted_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
                predicted_score: { type: "number" },
                confidence: { type: "number" },
                horizon_days: { type: "number" },
                contributing_factors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      factor: { type: "string" },
                      impact: { type: "string", enum: ["positive", "negative"] },
                      weight: { type: "number" },
                    },
                    required: ["factor", "impact", "weight"],
                    additionalProperties: false,
                  },
                },
                recommendations: { type: "array", items: { type: "string" } },
                ai_narrative: { type: "string" },
              },
              required: ["predicted_level", "predicted_score", "confidence", "horizon_days", "contributing_factors", "recommendations", "ai_narrative"],
              additionalProperties: false,
            },
          },
        }];
        tool_choice = { type: "function", function: { name: "risk_forecast" } };
        break;
      }

      // ═══════════════════════════════════
      // COMPLIANCE ANALYSIS
      // ═══════════════════════════════════
      case "analyze_compliance": {
        systemPrompt = `You are a compliance automation AI for a multi-tenant HR platform.
Analyze compliance evaluation results and suggest remediation actions.
Be specific and actionable. Use Portuguese (BR).`;

        userPrompt = `Analise o relatório de compliance e sugira remediações:

SCORE GERAL: ${compliance_data.overall_score}/100
REGRAS APROVADAS: ${compliance_data.passed_count}/${compliance_data.total_rules}
VIOLAÇÕES CRÍTICAS: ${compliance_data.critical_violations}

VIOLAÇÕES DETALHADAS:
${JSON.stringify(compliance_data.evaluations?.filter((e: any) => !e.passed).map((e: any) => ({
  rule: e.rule_id,
  violations: e.violations,
})), null, 2)}`;

        tools = [{
          type: "function",
          function: {
            name: "compliance_analysis",
            description: "Return compliance analysis with remediation suggestions",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                priority_actions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      action: { type: "string" },
                      severity: { type: "string", enum: ["info", "warning", "critical"] },
                      description: { type: "string" },
                      estimated_impact: { type: "string" },
                    },
                    required: ["action", "severity", "description", "estimated_impact"],
                    additionalProperties: false,
                  },
                },
                risk_assessment: { type: "string" },
              },
              required: ["summary", "priority_actions", "risk_assessment"],
              additionalProperties: false,
            },
          },
        }];
        tool_choice = { type: "function", function: { name: "compliance_analysis" } };
        break;
      }

      // ═══════════════════════════════════
      // AUDIT COMPARISON ANALYSIS
      // ═══════════════════════════════════
      case "analyze_audit": {
        systemPrompt = `You are a governance audit AI for a multi-tenant HR platform.
Compare audit snapshots and highlight significant changes. Use Portuguese (BR).`;

        userPrompt = `Compare os seguintes snapshots de auditoria e analise as mudanças:

SNAPSHOT ANTERIOR: ${JSON.stringify(audit_data.previous, null, 2)}
SNAPSHOT ATUAL: ${JSON.stringify(audit_data.current, null, 2)}
DELTAS: ${JSON.stringify(audit_data.deltas, null, 2)}`;

        tools = [{
          type: "function",
          function: {
            name: "audit_analysis",
            description: "Return audit comparison analysis",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                significant_changes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      description: { type: "string" },
                      severity: { type: "string", enum: ["info", "warning", "critical"] },
                    },
                    required: ["category", "description", "severity"],
                    additionalProperties: false,
                  },
                },
                recommendations: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "significant_changes", "recommendations"],
              additionalProperties: false,
            },
          },
        }];
        tool_choice = { type: "function", function: { name: "audit_analysis" } };
        break;
      }

      // ═══════════════════════════════════
      // COUPON ABUSE DETECTION
      // ═══════════════════════════════════
      case "analyze_coupon_abuse": {
        systemPrompt = `You are a financial governance AI for a multi-tenant SaaS platform.
Analyze coupon usage data and detect abusive patterns. Respond in Portuguese (BR).

Patterns to detect:
1. Cupons com taxa de uso anormalmente alta (uso/max > 80%)
2. Tenants acumulando múltiplos cupons simultaneamente
3. Descontos excessivos (>50% do valor do plano)
4. Cupons sendo usados repetidamente pelo mesmo tenant
5. Padrões temporais suspeitos (muitos resgates em curto período)
6. Tenants cujo desconto total acumulado excede limites razoáveis`;

        userPrompt = `Analise os seguintes dados de cupons e resgates para detectar abusos:

CUPONS ATIVOS: ${JSON.stringify(coupon_data?.coupons ?? [], null, 2)}
RESGATES RECENTES: ${JSON.stringify(coupon_data?.redemptions ?? [], null, 2)}
RESUMO POR TENANT: ${JSON.stringify(coupon_data?.tenant_summary ?? [], null, 2)}
ENTRADAS FINANCEIRAS (coupon_discount): ${JSON.stringify(coupon_data?.financial_entries ?? [], null, 2)}`;

        tools = [{
          type: "function",
          function: {
            name: "coupon_abuse_analysis",
            description: "Return coupon abuse detection results",
            parameters: {
              type: "object",
              properties: {
                risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
                summary: { type: "string" },
                abusive_coupons: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      coupon_code: { type: "string" },
                      reason: { type: "string" },
                      severity: { type: "string", enum: ["warning", "critical"] },
                      recommendation: { type: "string" },
                    },
                    required: ["coupon_code", "reason", "severity", "recommendation"],
                    additionalProperties: false,
                  },
                },
                excessive_discount_tenants: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tenant_id: { type: "string" },
                      tenant_name: { type: "string" },
                      total_discount_brl: { type: "number" },
                      coupon_count: { type: "number" },
                      reason: { type: "string" },
                      severity: { type: "string", enum: ["warning", "critical"] },
                      recommendation: { type: "string" },
                    },
                    required: ["tenant_id", "total_discount_brl", "coupon_count", "reason", "severity", "recommendation"],
                    additionalProperties: false,
                  },
                },
                recommendations: { type: "array", items: { type: "string" } },
              },
              required: ["risk_level", "summary", "abusive_coupons", "excessive_discount_tenants", "recommendations"],
              additionalProperties: false,
            },
          },
        }];
        tool_choice = { type: "function", function: { name: "coupon_abuse_analysis" } };
        break;
      }

      // ═══════════════════════════════════
      // LANDING PAGE CONTENT ANALYSIS
      // ═══════════════════════════════════
      case "analyze_landing_content": {
        const ld = landing_data ?? { blocks: [], name: '', slug: '' };
        systemPrompt = `Você é um analista de Governance AI para landing pages de uma plataforma SaaS B2B de RH.
Analise o conteúdo da landing page e detecte os seguintes problemas:

1. LINGUAGEM INADEQUADA: Termos informais demais, erros gramaticais, linguagem ofensiva, promessas exageradas sem base ("garantimos 100%"), termos vagos sem dados.
2. FAB MAL ESTRUTURADO: Blocos sem Feature, Advantage ou Benefit preenchidos corretamente. Feature deve descrever "o que é", Advantage "por que importa", Benefit "resultado mensurável para o cliente".
3. CTA SEM TRACKING: Blocos CTA sem link configurado, sem UTM parameters, sem event tracking habilitado (gtm_container_id ausente).

Seja rigoroso mas justo. Responda em Português (BR).`;

        userPrompt = `Analise o conteúdo desta landing page:

NOME: ${ld.name ?? 'Sem nome'}
SLUG: ${ld.slug ?? 'Sem slug'}
GTM CONTAINER: ${ld.gtm_container_id ?? 'NÃO CONFIGURADO'}

BLOCOS (${(ld.blocks ?? []).length} total):
${JSON.stringify((ld.blocks ?? []).map((b: any, i: number) => ({
  index: i,
  type: b.type,
  fab_feature: b.fab?.feature || '[VAZIO]',
  fab_advantage: b.fab?.advantage || '[VAZIO]',
  fab_benefit: b.fab?.benefit || '[VAZIO]',
  content: b.content ?? {},
  has_cta_link: b.type === 'cta' ? !!(b.content?.ctaLink || b.content?.link) : 'N/A',
})), null, 2)}

Identifique todos os problemas encontrados.`;

        tools = [{
          type: "function",
          function: {
            name: "landing_content_analysis",
            description: "Return landing page content analysis findings",
            parameters: {
              type: "object",
              properties: {
                overall_risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
                summary: { type: "string" },
                findings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string", enum: ["linguagem_inadequada", "fab_mal_estruturado", "cta_sem_tracking"] },
                      severity: { type: "string", enum: ["info", "warning", "critical"] },
                      title: { type: "string" },
                      description: { type: "string" },
                      block_index: { type: "number" },
                      suggested_fix: { type: "string" },
                    },
                    required: ["category", "severity", "title", "description", "suggested_fix"],
                    additionalProperties: false,
                  },
                },
                approval_recommendation: { type: "string", enum: ["approve", "review_needed", "reject"] },
                approval_reasoning: { type: "string" },
              },
              required: ["overall_risk", "summary", "findings", "approval_recommendation", "approval_reasoning"],
              additionalProperties: false,
            },
          },
        }];
        tool_choice = { type: "function", function: { name: "landing_content_analysis" } };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const body: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
    if (tools) body.tools = tools;
    if (tool_choice) body.tool_choice = tool_choice;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    let result: any = {};
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        result = { raw: toolCall.function.arguments };
      }
    }

    // Wrap based on action
    const responseData: any = {};
    if (action === "predict_risk") {
      responseData.forecast = {
        current_level: trend_data.snapshots?.length > 0
          ? trend_data.snapshots[trend_data.snapshots.length - 1]?.risk_level ?? "low"
          : "low",
        current_score: trend_data.current_score ?? 0,
        ...result,
      };
    } else if (action === "analyze_compliance") {
      responseData.analysis = result;
    } else if (action === "analyze_audit") {
      responseData.analysis = result;
    } else if (action === "analyze_coupon_abuse") {
      responseData.analysis = result;
    } else if (action === "analyze_landing_content") {
      responseData.analysis = result;
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("governance-ai error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
