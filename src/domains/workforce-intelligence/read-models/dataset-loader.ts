/**
 * Dataset Loader
 *
 * Hydrates a WorkforceDataset by querying the database and mapping
 * results through the read model views. This is the ONLY file in
 * the Workforce Intelligence context that performs I/O.
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type {
  WorkforceDataset,
  EmployeeSnapshot,
  SimulationSnapshot,
  ComplianceSnapshot,
  BenefitSnapshot,
} from '../types';
import { toRiskExposureView } from './risk-exposure.view';
import { toMedicalExamStatusView } from './medical-exam-status.view';

/**
 * Load and assemble a full WorkforceDataset from the database.
 * This is the single I/O entry point for all intelligence engines.
 */
export async function loadWorkforceDataset(scope: QueryScope): Promise<WorkforceDataset> {
  const tenantId = scope.tenantId;

  // Parallel data fetching
  const [employeesRes, simulationsRes, examsRes, exposuresRes, benefitsRes] = await Promise.all([
    fetchEmployees(scope),
    fetchSimulations(scope),
    fetchExamAlerts(tenantId),
    fetchRiskExposures(scope),
    fetchBenefits(scope),
  ]);

  // Build compliance snapshot by merging exams + exposures
  const examMap = new Map(examsRes.map(e => [e.employee_id, e]));
  const exposureMap = new Map<string, typeof exposuresRes>();
  for (const exp of exposuresRes) {
    const list = exposureMap.get(exp.employee_id) ?? [];
    list.push(exp);
    exposureMap.set(exp.employee_id, list);
  }

  const compliance: ComplianceSnapshot[] = employeesRes.map(emp => {
    const exam = examMap.get(emp.id);
    const exposures = exposureMap.get(emp.id) ?? [];
    const activeExposures = exposures.filter(e => e.is_active);
    const hasHazardPay = activeExposures.some(e => e.generates_hazard_pay);

    return {
      employee_id: emp.id,
      has_active_exam: exam?.has_valid_exam ?? false,
      exam_overdue: exam?.is_overdue ?? false,
      days_until_exam_expiry: exam?.days_until_due ?? undefined,
      has_risk_exposure: activeExposures.length > 0,
      risk_level: activeExposures[0]?.risk_level,
      has_hazard_pay: hasHazardPay,
      hazard_pay_type: activeExposures.find(e => e.generates_hazard_pay)?.hazard_pay_type ?? undefined,
      open_violations: 0, // populated separately if needed
      violation_severities: [],
    };
  });

  return {
    tenant_id: tenantId,
    analysis_date: new Date().toISOString().slice(0, 10),
    employees: employeesRes,
    simulations: simulationsRes,
    compliance,
    benefits: benefitsRes,
  };
}

// ── Private fetchers ──

async function fetchEmployees(scope: QueryScope): Promise<EmployeeSnapshot[]> {
  const q = applyScope(
    supabase.from('employees').select('id, name, department_id, position_id, company_id, company_group_id, status, hire_date, base_salary, current_salary, departments(name), positions(title)'),
    scope,
  ).eq('status', 'active').is('deleted_at', null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((e: any) => ({
    id: e.id,
    name: e.name,
    department: e.departments?.name,
    department_id: e.department_id,
    position: e.positions?.title,
    position_id: e.position_id,
    company_id: e.company_id,
    company_group_id: e.company_group_id,
    status: e.status,
    hire_date: e.hire_date,
    base_salary: e.base_salary ?? 0,
    current_salary: e.current_salary ?? 0,
  }));
}

async function fetchSimulations(scope: QueryScope): Promise<SimulationSnapshot[]> {
  const q = applyScope(
    supabase.from('payroll_simulations').select('*'),
    scope,
  ).order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;

  // Deduplicate: keep latest simulation per employee
  const seen = new Set<string>();
  const unique: SimulationSnapshot[] = [];
  for (const row of (data ?? []) as any[]) {
    if (seen.has(row.employee_id)) continue;
    seen.add(row.employee_id);
    unique.push({
      employee_id: row.employee_id,
      salario_base: row.salario_base,
      total_proventos: row.total_proventos,
      total_descontos: row.total_descontos,
      salario_liquido: row.salario_liquido,
      custo_total_empregador: row.custo_total_empresa,
      fator_custo: row.fator_custo,
      encargos_total: row.encargos_estimados,
      inss_estimado: row.inss_empregado,
      irrf_estimado: row.irrf,
      fgts_estimado: row.fgts,
      provisoes_total: row.provisao_13 + row.provisao_ferias + row.provisao_multa_fgts,
      beneficios_total: row.beneficios,
      rubrics_count: Array.isArray(row.rubrics_snapshot) ? row.rubrics_snapshot.length : 0,
    });
  }
  return unique;
}

async function fetchExamAlerts(tenantId: string) {
  const { data, error } = await supabase
    .from('pcmso_exam_alerts' as any)
    .select('*')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  return (data ?? []).map((r: any) => toMedicalExamStatusView({
    employee_id: r.employee_id,
    employee_name: r.employee_name,
    company_id: r.company_id,
    exam_date: r.exam_date,
    exam_type: r.exam_type,
    result: r.result,
    next_exam_date: r.next_exam_date,
    days_until_due: r.days_until_due,
    alert_status: r.alert_status,
    program_name: r.program_name,
  }));
}

async function fetchRiskExposures(scope: QueryScope) {
  const q = applyScope(
    supabase.from('employee_risk_exposures').select('*, occupational_risk_factors(name, category), exposure_groups(name), employees(name)'),
    scope,
    { skipScopeFilter: true },
  ).is('deleted_at', null).eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => toRiskExposureView(r));
}

async function fetchBenefits(scope: QueryScope): Promise<BenefitSnapshot[]> {
  const q = applyScope(
    supabase.from('employee_benefits').select('employee_id, is_active, monthly_value, employer_pays_pct, benefit_plans(name, benefit_type, base_value)'),
    scope,
  ).eq('is_active', true).is('deleted_at', null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    employee_id: r.employee_id,
    plan_name: r.benefit_plans?.name ?? 'Plano',
    benefit_type: r.benefit_plans?.benefit_type ?? 'other',
    monthly_value: r.monthly_value ?? r.benefit_plans?.base_value ?? 0,
    employer_cost: (r.monthly_value ?? 0) * ((r.employer_pays_pct ?? 100) / 100),
    is_active: r.is_active,
  }));
}
