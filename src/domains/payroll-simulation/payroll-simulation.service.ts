/**
 * Payroll Simulation Service — Domain Orchestrator
 *
 * Consumes all bounded contexts to build a complete SimulationInput
 * from real employee data, then delegates to the pure engine.
 *
 * Dependencies:
 * - HR Core → Employee (base salary, company, status)
 * - Compensation Engine → SalaryContract (contractual salary, jornada)
 * - Labor Rules Engine → Effective rules for the employee's company
 * - Benefits Engine → Active employee benefits (VA/VR/VT costs)
 * - Risk Programs → Active risk exposures (insalubridade/periculosidade)
 */

import { supabase } from '@/integrations/supabase/client';
import { employeeService } from '@/domains/employee/employee.service';
import { salaryContractService } from '@/domains/compensation/salary-contract.service';
import { laborRulesService } from '@/domains/labor-rules/labor-rules.service';
import { benefitPlanService } from '@/domains/compliance/benefit-plan.service';
import { riskExposureService } from '@/domains/compliance/risk-exposure.service';
import { simulatePayroll } from './payroll-simulation.engine';
import { applyScope } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { SimulationInput, PayrollSimulationOutput } from './types';
import type { LaborRuleDefinition } from '@/domains/labor-rules';

// ── Persisted simulation record ──

export interface PayrollSimulationRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  company_id: string | null;
  company_group_id: string | null;
  competencia: string;
  salario_base: number;
  total_proventos: number;
  total_descontos: number;
  salario_liquido: number;
  inss_empregado: number;
  irrf: number;
  fgts: number;
  inss_patronal: number;
  rat: number;
  terceiros: number;
  provisao_ferias: number;
  provisao_13: number;
  provisao_multa_fgts: number;
  encargos_estimados: number;
  beneficios: number;
  custo_total_empresa: number;
  fator_custo: number;
  input_snapshot: SimulationInput;
  rubrics_snapshot: unknown[];
  created_at: string;
  created_by: string | null;
}

// ── Work data overrides (user-provided variable data) ──

export interface WorkDataOverrides {
  horas_extras_50?: number;
  horas_extras_100?: number;
  horas_noturnas?: number;
  plantao?: boolean;
  plantao_horas?: number;
  sobreaviso?: boolean;
  sobreaviso_horas?: number;
  dias_trabalhados?: number;
  domingos_feriados_trabalhados?: number;
  dependentes_irrf?: number;
  outras_deducoes_irrf?: number;
  meses_trabalhados_ano?: number;
}

// ── Orchestrator ──

export const payrollSimulationService = {
  /**
   * Full simulation for an employee — fetches all domain data automatically.
   */
  async simulateForEmployee(
    employeeId: string,
    scope: QueryScope,
    overrides: WorkDataOverrides = {},
  ): Promise<PayrollSimulationOutput> {
    // 1. Fetch all domain data in parallel
    const [employee, contract, riskExposures, employeeBenefits] = await Promise.all([
      employeeService.getById(employeeId, scope),
      salaryContractService.getActive(employeeId, scope),
      riskExposureService.listByEmployee(employeeId, scope),
      benefitPlanService.listEmployeeBenefits(employeeId, scope),
    ]);

    if (!employee) {
      throw new Error(`Employee ${employeeId} not found`);
    }

    // 2. Fetch effective labor rules for the employee's company
    const rules = await laborRulesService.getEffectiveRules(employee.company_id, scope);

    // 3. Derive salary from contract or employee record
    const baseSalary = contract?.base_salary ?? employee.base_salary ?? employee.current_salary ?? 0;

    // 4. Derive risk exposure flags
    const activeExposures = riskExposures.filter(e => e.is_active && !e.deleted_at);
    const hasInsalubridade = activeExposures.find(
      e => e.hazard_pay_type === 'insalubridade' && e.generates_hazard_pay
    );
    const hasPericulosidade = activeExposures.some(
      e => e.hazard_pay_type === 'periculosidade' && e.generates_hazard_pay
    );

    let insalubridade_grau: 'minimo' | 'medio' | 'maximo' | null = null;
    if (hasInsalubridade) {
      const pct = hasInsalubridade.hazard_pay_percentage ?? 20;
      if (pct <= 10) insalubridade_grau = 'minimo';
      else if (pct <= 20) insalubridade_grau = 'medio';
      else insalubridade_grau = 'maximo';
    }

    // 5. Derive benefit costs
    const activeBenefits = employeeBenefits.filter((b: any) => b.is_active && !b.deleted_at);
    let vale_alimentacao = 0;
    let vale_refeicao = 0;
    let vale_transporte_valor = 0;

    for (const eb of activeBenefits) {
      const plan = (eb as any).benefit_plans;
      if (!plan) continue;
      const value = (eb as any).monthly_value ?? (eb as any).custom_value ?? plan.base_value ?? 0;
      switch (plan.benefit_type) {
        case 'vale_alimentacao': vale_alimentacao += value; break;
        case 'vale_refeicao': vale_refeicao += value; break;
        case 'vale_transporte': vale_transporte_valor += value; break;
      }
    }

    // 6. Build SimulationInput
    const input: SimulationInput = {
      salario_base: baseSalary,
      jornada_mensal_horas: (contract as any)?.jornada_mensal ?? 220,
      insalubridade_grau,
      periculosidade: hasPericulosidade,
      vale_alimentacao,
      vale_refeicao,
      vale_transporte_valor,
      ...overrides,
    };

    // 7. Run pure simulation engine
    return simulatePayroll(input, rules);
  },

  /**
   * Ad-hoc simulation with manual input — no DB lookups.
   */
  async simulateAdHoc(
    input: SimulationInput,
    companyId: string,
    scope: QueryScope,
  ): Promise<PayrollSimulationOutput> {
    const rules = await laborRulesService.getEffectiveRules(companyId, scope);
    return simulatePayroll(input, rules);
  },

  /**
   * Simulate with pre-loaded rules — fully offline, no DB calls.
   */
  simulateOffline(
    input: SimulationInput,
    rules: LaborRuleDefinition[],
  ): PayrollSimulationOutput {
    return simulatePayroll(input, rules);
  },

  // ── Persistence ──

  /**
   * Save a simulation result as an immutable snapshot.
   */
  async save(
    employeeId: string,
    competencia: string,
    output: PayrollSimulationOutput,
    scope: QueryScope,
  ): Promise<PayrollSimulationRecord> {
    const employee = await employeeService.getById(employeeId, scope);
    const { data, error } = await supabase
      .from('payroll_simulations' as any)
      .insert({
        tenant_id: scope.tenantId,
        employee_id: employeeId,
        company_id: employee?.company_id ?? scope.companyId ?? null,
        company_group_id: employee?.company_group_id ?? null,
        competencia,
        salario_base: output.input.salario_base,
        total_proventos: output.summary.totalProventos,
        total_descontos: output.summary.totalDescontos,
        salario_liquido: output.employerCost.salario_liquido,
        inss_empregado: output.taxes.inss,
        irrf: output.taxes.irrf,
        fgts: output.taxes.fgts,
        inss_patronal: output.employerCost.inss_patronal,
        rat: output.employerCost.rat,
        terceiros: output.employerCost.terceiros,
        provisao_ferias: output.reflections.ferias_terco,
        provisao_13: output.reflections.decimo_terceiro,
        provisao_multa_fgts: output.reflections.provisao_multa_fgts,
        encargos_estimados: output.employerCost.inss_patronal + output.employerCost.rat + output.employerCost.terceiros,
        beneficios: output.employerCost.beneficios,
        custo_total_empresa: output.employerCost.custo_total_empregador,
        fator_custo: output.employerCost.fator_custo,
        input_snapshot: output.input,
        rubrics_snapshot: output.rubrics,
      })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as PayrollSimulationRecord;
  },

  /**
   * List saved simulations for an employee.
   */
  async listByEmployee(employeeId: string, scope: QueryScope): Promise<PayrollSimulationRecord[]> {
    const q = applyScope(
      supabase.from('payroll_simulations' as any).select('*'),
      scope,
    ).eq('employee_id', employeeId).order('competencia', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as PayrollSimulationRecord[];
  },

  /**
   * List all simulations for a competência across the tenant.
   */
  async listByCompetencia(competencia: string, scope: QueryScope): Promise<PayrollSimulationRecord[]> {
    const q = applyScope(
      supabase.from('payroll_simulations' as any).select('*, employees(name, company_id)'),
      scope,
      { skipScopeFilter: true },
    ).eq('competencia', competencia).order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as PayrollSimulationRecord[];
  },

  /**
   * Delete a simulation.
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('payroll_simulations' as any)
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
