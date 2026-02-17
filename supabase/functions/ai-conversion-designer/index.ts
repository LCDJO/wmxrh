import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type ActionType = "suggest_headlines" | "organize_fab" | "optimize_cta" | "suggest_layout";

const SYSTEM_PROMPTS: Record<ActionType, string> = {
  suggest_headlines: `You are an expert conversion copywriter for B2B SaaS landing pages (HR / People Management platform).
Generate headline variants that are clear, benefit-driven, and under 12 words.
Always respond using the suggest_headlines tool.`,

  organize_fab: `You are a conversion architect specializing in Feature-Advantage-Benefit (FAB) frameworks for SaaS.
Given raw features, organize them into structured FAB blocks ordered by conversion impact.
Always respond using the organize_fab tool.`,

  optimize_cta: `You are a CTA optimization expert for B2B SaaS.
Generate high-converting CTA variants with urgency elements, clear value propositions, and action verbs.
Always respond using the optimize_cta tool.`,

  suggest_layout: `You are a landing page layout strategist who optimizes section order for maximum conversion.
Given sections and industry context, suggest the optimal order with reasoning.
Always respond using the suggest_layout tool.`,
};

const TOOLS: Record<ActionType, unknown[]> = {
  suggest_headlines: [
    {
      type: "function",
      function: {
        name: "suggest_headlines",
        description: "Return 5 headline variants with estimated conversion impact.",
        parameters: {
          type: "object",
          properties: {
            headlines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string", description: "The headline text" },
                  style: { type: "string", enum: ["direct", "question", "statistic", "emotional", "social_proof"] },
                  estimated_impact: { type: "string", description: "Expected conversion impact e.g. +15%" },
                  reasoning: { type: "string", description: "Why this headline works" },
                },
                required: ["text", "style", "estimated_impact", "reasoning"],
                additionalProperties: false,
              },
            },
          },
          required: ["headlines"],
          additionalProperties: false,
        },
      },
    },
  ],

  organize_fab: [
    {
      type: "function",
      function: {
        name: "organize_fab",
        description: "Organize features into FAB blocks sorted by conversion impact.",
        parameters: {
          type: "object",
          properties: {
            blocks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  order: { type: "number" },
                  feature: { type: "string" },
                  advantage: { type: "string" },
                  benefit: { type: "string" },
                  section_type: { type: "string", enum: ["hero", "features", "pricing", "testimonials", "cta", "faq", "stats"] },
                  impact_score: { type: "number", description: "1-10 conversion impact" },
                },
                required: ["order", "feature", "advantage", "benefit", "section_type", "impact_score"],
                additionalProperties: false,
              },
            },
            strategy_notes: { type: "string", description: "Overall FAB organization strategy" },
          },
          required: ["blocks", "strategy_notes"],
          additionalProperties: false,
        },
      },
    },
  ],

  optimize_cta: [
    {
      type: "function",
      function: {
        name: "optimize_cta",
        description: "Generate optimized CTA variants.",
        parameters: {
          type: "object",
          properties: {
            ctas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  headline: { type: "string" },
                  button_text: { type: "string" },
                  subtext: { type: "string" },
                  urgency_element: { type: "string" },
                  placement: { type: "string", enum: ["hero", "mid_page", "footer", "sticky"] },
                  estimated_ctr: { type: "string" },
                },
                required: ["headline", "button_text", "subtext", "urgency_element", "placement", "estimated_ctr"],
                additionalProperties: false,
              },
            },
          },
          required: ["ctas"],
          additionalProperties: false,
        },
      },
    },
  ],

  suggest_layout: [
    {
      type: "function",
      function: {
        name: "suggest_layout",
        description: "Suggest optimal section order for a landing page.",
        parameters: {
          type: "object",
          properties: {
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  order: { type: "number" },
                  section_type: { type: "string" },
                  title: { type: "string" },
                  reasoning: { type: "string" },
                  conversion_role: { type: "string", description: "Role in the conversion funnel" },
                },
                required: ["order", "section_type", "title", "reasoning", "conversion_role"],
                additionalProperties: false,
              },
            },
            layout_strategy: { type: "string" },
            expected_improvement: { type: "string" },
          },
          required: ["sections", "layout_strategy", "expected_improvement"],
          additionalProperties: false,
        },
      },
    },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, context } = (await req.json()) as {
      action: ActionType;
      context: Record<string, unknown>;
    };

    if (!SYSTEM_PROMPTS[action]) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userPrompt = buildUserPrompt(action, context);

    const response = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[action] },
          { role: "user", content: userPrompt },
        ],
        tools: TOOLS[action],
        tool_choice: { type: "function", function: { name: action } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No structured response from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ action, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-conversion-designer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildUserPrompt(action: ActionType, ctx: Record<string, unknown>): string {
  const industry = (ctx.industry as string) || "HR / People Management SaaS";
  const modules = (ctx.modules as string[]) || [];
  const currentContent = ctx.currentContent ? JSON.stringify(ctx.currentContent) : "";

  // ── AI Inputs: Real ecosystem data ──
  const revenueBlock = ctx.revenueIntelligence
    ? `\n\n📊 REVENUE INTELLIGENCE:\n${JSON.stringify(ctx.revenueIntelligence)}`
    : "";
  const referralBlock = ctx.referralData
    ? `\n\n🔗 REFERRAL CONVERSION DATA:\n${JSON.stringify(ctx.referralData)}`
    : "";
  const fabBlock = ctx.fabPerformance
    ? `\n\n⚡ FAB PERFORMANCE:\n${JSON.stringify(ctx.fabPerformance)}`
    : "";
  const analyticsBlock = ctx.landingAnalytics
    ? `\n\n📈 LANDING ANALYTICS:\n${JSON.stringify(ctx.landingAnalytics)}`
    : "";

  const dataContext = `${revenueBlock}${referralBlock}${fabBlock}${analyticsBlock}`;

  switch (action) {
    case "suggest_headlines":
      return `Industry: ${industry}
Modules: ${modules.join(", ") || "general"}
Current headline: ${ctx.currentHeadline || "none"}
Target audience: ${ctx.audience || "HR directors, People Ops managers"}
${currentContent ? `Current page content:\n${currentContent}` : ""}${dataContext}

Use the data above to craft headlines that address real conversion gaps and leverage proven revenue patterns.
Generate 5 high-converting headline variants in Portuguese (Brazil).`;

    case "organize_fab":
      return `Industry: ${industry}
Raw features to organize:\n${JSON.stringify(ctx.features || modules)}
Target audience: ${ctx.audience || "HR directors"}${dataContext}

Prioritize FAB blocks based on actual conversion performance and revenue impact data.
Organize into FAB blocks in Portuguese (Brazil), sorted by conversion impact.`;

    case "optimize_cta":
      return `Industry: ${industry}
Current CTA: ${ctx.currentCTA || "Começar grátis"}
Page goal: ${ctx.goal || "free trial signup"}
Target audience: ${ctx.audience || "HR directors"}${dataContext}

Use funnel drop-off data and referral performance to craft CTAs that address the biggest conversion gaps.
Generate 4 optimized CTA variants in Portuguese (Brazil).`;

    case "suggest_layout":
      return `Industry: ${industry}
Available sections: ${JSON.stringify(ctx.sections || ["hero", "features", "pricing", "testimonials", "cta", "faq"])}
Page goal: ${ctx.goal || "conversion to free trial"}${dataContext}

Use landing analytics (bounce rate, avg time, conversion rate) and FAB performance to determine optimal section ordering.
Suggest optimal section order for maximum conversion. Respond in Portuguese (Brazil).`;

    default:
      return JSON.stringify(ctx);
  }
}
