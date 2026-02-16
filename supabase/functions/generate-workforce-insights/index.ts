import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Accept tenant_id from body or run for all tenants
    let tenantIds: string[] = [];

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.tenant_id) {
        tenantIds = [body.tenant_id];
      }
    }

    // If no specific tenant, fetch all active tenants
    if (tenantIds.length === 0) {
      const { data: tenants, error } = await supabase
        .from("tenants")
        .select("id")
        .eq("status", "active");
      if (error) throw error;
      tenantIds = (tenants ?? []).map((t: any) => t.id);
    }

    const results: Record<string, any> = {};

    for (const tenantId of tenantIds) {
      try {
        // 1. Load dataset
        const dataset = await loadDataset(supabase, tenantId);

        // 2. Run pure engines inline (no import from src/)
        const riskDetection = detectRisks(dataset);
        const healthScore = computeHealthScore(riskDetection);

        // 3. Persist insights
        const risks = riskDetection.risks;
        const rows = risks.map((risk: any) => ({
          tenant_id: tenantId,
          insight_type: risk.insight_type,
          severity: risk.severity === "critical" || risk.severity === "high" ? "critical" : risk.severity === "medium" ? "warning" : "info",
          descricao: `${risk.title}: ${risk.description}`,
          dados_origem_json: {
            risk_id: risk.risk_id,
            category: risk.category,
            affected_count: risk.affected_count,
            financial_exposure: risk.financial_exposure,
            legal_basis: risk.legal_basis,
            recommended_action: risk.recommended_action,
            health_score: healthScore,
          },
        }));

        let insightsCreated = 0;
        if (rows.length > 0) {
          const { data, error } = await supabase
            .from("workforce_insights")
            .insert(rows)
            .select("id");
          if (error) throw error;
          insightsCreated = data?.length ?? 0;
        }

        results[tenantId] = {
          success: true,
          risks_detected: risks.length,
          insights_created: insightsCreated,
          health_score: healthScore,
        };
      } catch (tenantError: any) {
        console.error(`[generate-workforce-insights] tenant ${tenantId}:`, tenantError);
        results[tenantId] = { success: false, error: tenantError.message };
      }
    }

    return new Response(JSON.stringify({ tenants_processed: tenantIds.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[generate-workforce-insights] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Inline lightweight dataset loader (edge function can't import from src/) ──

async function loadDataset(supabase: any, tenantId: string) {
  const [employeesRes, exposuresRes, examsRes, benefitsRes, violationsRes] = await Promise.all([
    supabase.from("employees").select("id, name, status, hire_date, current_salary, company_id, position_id").eq("tenant_id", tenantId).eq("status", "active").is("deleted_at", null),
    supabase.from("employee_risk_exposures").select("employee_id, is_active, generates_hazard_pay, hazard_pay_type, risk_level").eq("tenant_id", tenantId).eq("is_active", true).is("deleted_at", null),
    supabase.from("pcmso_exam_alerts").select("employee_id, alert_status, days_until_due").eq("tenant_id", tenantId),
    supabase.from("employee_benefits").select("employee_id, is_active").eq("tenant_id", tenantId).eq("is_active", true).is("deleted_at", null),
    supabase.from("compliance_violations").select("employee_id, severity, is_resolved").eq("tenant_id", tenantId).eq("is_resolved", false),
  ]);

  const employees = (employeesRes.data ?? []).map((e: any) => ({
    id: e.id, name: e.name, status: e.status, hire_date: e.hire_date,
    current_salary: e.current_salary ?? 0, company_id: e.company_id,
  }));

  // Build compliance snapshots
  const exposuresByEmp = new Map<string, any[]>();
  for (const exp of (exposuresRes.data ?? [])) {
    const list = exposuresByEmp.get(exp.employee_id) ?? [];
    list.push(exp);
    exposuresByEmp.set(exp.employee_id, list);
  }

  const examsByEmp = new Map<string, any>();
  for (const exam of (examsRes.data ?? [])) {
    examsByEmp.set(exam.employee_id, exam);
  }

  const violationsByEmp = new Map<string, any[]>();
  for (const v of (violationsRes.data ?? [])) {
    const list = violationsByEmp.get(v.employee_id) ?? [];
    list.push(v);
    violationsByEmp.set(v.employee_id, list);
  }

  const benefitSet = new Set((benefitsRes.data ?? []).map((b: any) => b.employee_id));

  const compliance = employees.map((emp: any) => {
    const exam = examsByEmp.get(emp.id);
    const exposures = exposuresByEmp.get(emp.id) ?? [];
    const violations = violationsByEmp.get(emp.id) ?? [];
    const hasHazardPay = exposures.some((e: any) => e.generates_hazard_pay);

    return {
      employee_id: emp.id,
      has_active_exam: exam ? exam.alert_status !== "overdue" : false,
      exam_overdue: exam?.alert_status === "overdue",
      has_risk_exposure: exposures.length > 0,
      risk_level: exposures[0]?.risk_level,
      has_hazard_pay: hasHazardPay,
      open_violations: violations.length,
      violation_severities: violations.map((v: any) => v.severity),
    };
  });

  const benefits = (benefitsRes.data ?? []).map((b: any) => ({
    employee_id: b.employee_id, is_active: b.is_active,
  }));

  return {
    tenant_id: tenantId,
    analysis_date: new Date().toISOString().slice(0, 10),
    employees,
    simulations: [], // not needed for risk detection
    compliance,
    benefits,
  };
}

// ── Inline risk detection (subset of rules for edge function) ──

function detectRisks(dataset: any) {
  const risks: any[] = [];
  let counter = 0;
  const rid = () => `WIR-${String(++counter).padStart(3, "0")}`;
  const now = dataset.analysis_date;

  // Overdue exams
  const overdue = dataset.compliance.filter((c: any) => c.exam_overdue);
  if (overdue.length > 0) {
    risks.push({
      risk_id: rid(), category: "health_safety", insight_type: "COMPLIANCE_WARNING",
      severity: "high", title: "Exames ocupacionais vencidos",
      description: `${overdue.length} colaborador(es) com exames PCMSO vencidos.`,
      affected_count: overdue.length, financial_exposure: overdue.length * 3000,
      legal_basis: "NR-7 / CLT Art. 168",
      recommended_action: "Agendar exames periódicos com urgência.",
    });
  }

  // Risk exposure without hazard pay
  const missingHazard = dataset.compliance.filter((c: any) => c.has_risk_exposure && !c.has_hazard_pay);
  if (missingHazard.length > 0) {
    risks.push({
      risk_id: rid(), category: "health_safety", insight_type: "LEGAL_RISK",
      severity: "critical", title: "Exposição a risco sem adicional",
      description: `${missingHazard.length} colaborador(es) sem adicional de insalubridade/periculosidade.`,
      affected_count: missingHazard.length, financial_exposure: missingHazard.length * 60000,
      legal_basis: "CLT Art. 189-197",
      recommended_action: "Avaliar GHE e conceder adicional.",
    });
  }

  // Critical violations
  const critViolations = dataset.compliance.filter((c: any) => c.violation_severities.includes("critical"));
  if (critViolations.length > 0) {
    risks.push({
      risk_id: rid(), category: "contract_irregularity", insight_type: "LEGAL_RISK",
      severity: "critical", title: "Violações trabalhistas críticas",
      description: `${critViolations.length} colaborador(es) com violações críticas.`,
      affected_count: critViolations.length, financial_exposure: critViolations.length * 10000,
      recommended_action: "Resolver violações e documentar ações corretivas.",
    });
  }

  // Employees without benefits (>20%)
  const active = dataset.employees.filter((e: any) => e.status === "active");
  const benefitSet = new Set(dataset.benefits.filter((b: any) => b.is_active).map((b: any) => b.employee_id));
  const noBenefits = active.filter((e: any) => !benefitSet.has(e.id));
  if (noBenefits.length > 0 && active.length > 0 && noBenefits.length / active.length > 0.2) {
    risks.push({
      risk_id: rid(), category: "benefit_gap", insight_type: "FINANCIAL_RISK",
      severity: "medium", title: "Colaboradores sem benefícios",
      description: `${noBenefits.length} ativos sem benefícios.`,
      affected_count: noBenefits.length, financial_exposure: 0,
      recommended_action: "Incluir nos planos de benefícios.",
    });
  }

  const severityWeight: Record<string, number> = { critical: 25, high: 15, medium: 8, low: 3 };
  const rawScore = risks.reduce((s: number, r: any) => s + (severityWeight[r.severity] ?? 0), 0);

  return {
    total_risks: risks.length,
    critical_count: risks.filter((r: any) => r.severity === "critical").length,
    risk_score: Math.min(100, rawScore),
    total_financial_exposure: risks.reduce((s: number, r: any) => s + r.financial_exposure, 0),
    risks,
  };
}

function computeHealthScore(riskDetection: any) {
  return {
    overall_score: Math.max(0, 100 - riskDetection.risk_score),
    risk_score: riskDetection.risk_score,
    total_risks: riskDetection.total_risks,
    critical_count: riskDetection.critical_count,
  };
}
