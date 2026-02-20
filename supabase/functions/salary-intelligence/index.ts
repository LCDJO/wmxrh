import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, tenant_id, company_id } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load employee salary data
    let empQuery = supabase
      .from("employees")
      .select("id, name, current_salary, base_salary, hire_date, status, company_id, position_id")
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .is("deleted_at", null);

    if (company_id) empQuery = empQuery.eq("company_id", company_id);

    const { data: employees, error: empErr } = await empQuery;
    if (empErr) throw empErr;

    // Load salary adjustments history
    const { data: adjustments } = await supabase
      .from("salary_adjustments")
      .select("employee_id, adjustment_type, percentage, new_salary, effective_date")
      .eq("tenant_id", tenant_id)
      .order("effective_date", { ascending: false })
      .limit(500);

    // Load companies for benchmark
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .eq("tenant_id", tenant_id)
      .is("deleted_at", null);

    // Build context for AI
    const salaryStats = buildSalaryStats(employees || [], adjustments || [], companies || []);

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "predict") {
      systemPrompt = `Você é um analista de remuneração especializado em legislação trabalhista brasileira (CLT).
Analise os dados salariais e forneça:
1. Tendência salarial projetada para os próximos 6 meses
2. Faixas salariais recomendadas por cargo
3. Riscos de defasagem salarial
Responda SOMENTE com JSON válido usando o schema de tool calling.`;

      userPrompt = `Dados salariais do tenant:
${JSON.stringify(salaryStats, null, 2)}

Analise e retorne previsões salariais.`;

    } else if (action === "suggest_adjustments") {
      systemPrompt = `Você é um consultor de RH especializado em reajustes salariais (CLT/Brasil).
Baseado nos dados, sugira ajustes salariais considerando:
- Tempo de casa e defasagem
- Média salarial do cargo
- Convenção coletiva (se aplicável)
- Inflação acumulada (~4.5% a.a. estimado)
Responda SOMENTE com JSON válido usando o schema de tool calling.`;

      userPrompt = `Dados para análise de ajustes:
${JSON.stringify(salaryStats, null, 2)}

Sugira ajustes prioritários.`;

    } else if (action === "benchmark") {
      systemPrompt = `Você é um analista de inteligência de RH.
Compare métricas entre as empresas do tenant:
- Custo médio por colaborador
- Dispersão salarial (desvio padrão)
- Indicadores de competitividade salarial
Responda SOMENTE com JSON válido usando o schema de tool calling.`;

      userPrompt = `Dados para benchmark entre empresas:
${JSON.stringify(salaryStats, null, 2)}

Gere comparativo entre as empresas.`;

    } else {
      return new Response(JSON.stringify({ error: "action must be predict, suggest_adjustments, or benchmark" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Lovable AI with tool calling for structured output
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
        tools: [getToolSchema(action)],
        tool_choice: { type: "function", function: { name: getToolName(action) } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let result: any;
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        result = { raw: toolCall.function.arguments };
      }
    } else {
      // Fallback: parse content directly
      const content = aiData.choices?.[0]?.message?.content || "{}";
      try {
        result = JSON.parse(content);
      } catch {
        result = { summary: content };
      }
    }

    return new Response(JSON.stringify({ action, result, stats: salaryStats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("salary-intelligence error:", e);
    return new Response(
      JSON.stringify({ error: "Failed to process salary data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Helpers ──

function buildSalaryStats(employees: any[], adjustments: any[], companies: any[]) {
  const byCompany: Record<string, { name: string; employees: number; totalSalary: number; salaries: number[] }> = {};

  for (const c of companies) {
    byCompany[c.id] = { name: c.name, employees: 0, totalSalary: 0, salaries: [] };
  }

  for (const e of employees) {
    const sal = e.current_salary || 0;
    if (byCompany[e.company_id]) {
      byCompany[e.company_id].employees++;
      byCompany[e.company_id].totalSalary += sal;
      byCompany[e.company_id].salaries.push(sal);
    }
  }

  const companySummary = Object.entries(byCompany).map(([id, d]) => ({
    company_id: id,
    company_name: d.name,
    employee_count: d.employees,
    avg_salary: d.employees > 0 ? Math.round(d.totalSalary / d.employees) : 0,
    total_cost: d.totalSalary,
    min_salary: d.salaries.length > 0 ? Math.min(...d.salaries) : 0,
    max_salary: d.salaries.length > 0 ? Math.max(...d.salaries) : 0,
  }));

  const allSalaries = employees.map(e => e.current_salary || 0).filter(s => s > 0);
  const totalEmployees = employees.length;
  const avgSalary = totalEmployees > 0 ? Math.round(allSalaries.reduce((a, b) => a + b, 0) / totalEmployees) : 0;

  // Tenure info
  const now = new Date();
  const tenures = employees
    .filter(e => e.hire_date)
    .map(e => {
      const hd = new Date(e.hire_date);
      return { name: e.name, salary: e.current_salary, months: Math.round((now.getTime() - hd.getTime()) / (1000 * 60 * 60 * 24 * 30)), company_id: e.company_id };
    });

  // Recent adjustments summary
  const recentAdj = (adjustments || []).slice(0, 20).map(a => ({
    type: a.adjustment_type,
    percentage: a.percentage,
    new_salary: a.new_salary,
    date: a.effective_date,
  }));

  return {
    total_employees: totalEmployees,
    avg_salary: avgSalary,
    median_salary: allSalaries.length > 0 ? allSalaries.sort((a, b) => a - b)[Math.floor(allSalaries.length / 2)] : 0,
    companies: companySummary,
    tenures: tenures.slice(0, 30),
    recent_adjustments: recentAdj,
  };
}

function getToolName(action: string) {
  switch (action) {
    case "predict": return "salary_predictions";
    case "suggest_adjustments": return "adjustment_suggestions";
    case "benchmark": return "company_benchmark";
    default: return "salary_predictions";
  }
}

function getToolSchema(action: string) {
  if (action === "predict") {
    return {
      type: "function",
      function: {
        name: "salary_predictions",
        description: "Return salary trend predictions and recommendations.",
        parameters: {
          type: "object",
          properties: {
            trend_summary: { type: "string", description: "Resumo da tendência salarial" },
            projected_avg_6m: { type: "number", description: "Média salarial projetada em 6 meses" },
            risk_level: { type: "string", enum: ["low", "medium", "high"] },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                  estimated_impact: { type: "string" },
                },
                required: ["description", "priority"],
                additionalProperties: false,
              },
            },
            salary_ranges: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  min: { type: "number" },
                  max: { type: "number" },
                  recommended: { type: "number" },
                },
                required: ["role", "min", "max", "recommended"],
                additionalProperties: false,
              },
            },
          },
          required: ["trend_summary", "projected_avg_6m", "risk_level", "recommendations"],
          additionalProperties: false,
        },
      },
    };
  }

  if (action === "suggest_adjustments") {
    return {
      type: "function",
      function: {
        name: "adjustment_suggestions",
        description: "Suggest salary adjustments with justifications.",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string" },
            total_estimated_cost: { type: "number" },
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  employee_name: { type: "string" },
                  current_salary: { type: "number" },
                  suggested_salary: { type: "number" },
                  percentage: { type: "number" },
                  justification: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                },
                required: ["employee_name", "current_salary", "suggested_salary", "percentage", "justification", "priority"],
                additionalProperties: false,
              },
            },
          },
          required: ["summary", "suggestions"],
          additionalProperties: false,
        },
      },
    };
  }

  // benchmark
  return {
    type: "function",
    function: {
      name: "company_benchmark",
      description: "Compare salary metrics across companies in the tenant.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          rankings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                company_name: { type: "string" },
                avg_salary: { type: "number" },
                competitiveness_score: { type: "number", description: "0-100" },
                observation: { type: "string" },
              },
              required: ["company_name", "avg_salary", "competitiveness_score", "observation"],
              additionalProperties: false,
            },
          },
          recommendations: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["summary", "rankings", "recommendations"],
        additionalProperties: false,
      },
    },
  };
}
