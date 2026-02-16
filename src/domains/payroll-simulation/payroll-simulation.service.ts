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

import { employeeService } from '@/domains/employee/employee.service';
import { salaryContractService } from '@/domains/compensation/salary-contract.service';
import { laborRulesService } from '@/domains/labor-rules/labor-rules.service';
import { benefitPlanService } from '@/domains/compliance/benefit-plan.service';
import { riskExposureService } from '@/domains/compliance/risk-exposure.service';
import { simulatePayroll } from './payroll-simulation.engine';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { SimulationInput, PayrollSimulationOutput } from './types';
import type { LaborRuleDefinition } from '@/domains/labor-rules';

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
   *
   * @param employeeId - Target employee
   * @param scope - Tenant/company scope for data access
   * @param overrides - Optional variable work data (hours, shifts, etc.)
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

    // Map insalubridade percentage to grade
    let insalubridade_grau: 'minimo' | 'medio' | 'maximo' | null = null;
    if (hasInsalubridade) {
      const pct = hasInsalubridade.hazard_pay_percentage ?? 20;
      if (pct <= 10) insalubridade_grau = 'minimo';
      else if (pct <= 20) insalubridade_grau = 'medio';
      else insalubridade_grau = 'maximo';
    }

    // 5. Derive benefit costs
    const activeBenefits = employeeBenefits.filter(
      (b: any) => b.is_active && !b.deleted_at
    );
    let vale_alimentacao = 0;
    let vale_refeicao = 0;
    let vale_transporte_valor = 0;

    for (const eb of activeBenefits) {
      const plan = (eb as any).benefit_plans;
      if (!plan) continue;
      const value = (eb as any).monthly_value ?? (eb as any).custom_value ?? plan.base_value ?? 0;

      switch (plan.benefit_type) {
        case 'vale_alimentacao':
          vale_alimentacao += value;
          break;
        case 'vale_refeicao':
          vale_refeicao += value;
          break;
        case 'vale_transporte':
          vale_transporte_valor += value;
          break;
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
      // Merge user overrides
      ...overrides,
    };

    // 7. Run pure simulation engine
    return simulatePayroll(input, rules);
  },

  /**
   * Ad-hoc simulation with manual input — no DB lookups.
   * Useful for "what-if" scenarios or prospective hires.
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
   * Useful for batch simulations or testing.
   */
  simulateOffline(
    input: SimulationInput,
    rules: LaborRuleDefinition[],
  ): PayrollSimulationOutput {
    return simulatePayroll(input, rules);
  },
};
