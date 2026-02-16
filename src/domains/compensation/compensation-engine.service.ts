/**
 * Compensation Engine Service
 *
 * CRITICAL: This module does NOT create rubrics manually.
 * All rubric calculations are delegated to LaborRulesEngine.evaluateLaborRules().
 *
 * Flow:
 *   1. Load employee's active contract (base salary, jornada)
 *   2. Build WorkContext from contract + work data
 *   3. Fetch effective rules via laborRulesService.getEffectiveRules()
 *   4. Delegate to evaluateLaborRules() → CalculatedRubric[]
 *   5. Run validateLaborCompliance() → ComplianceResult
 *   6. Return unified CompensationResult
 */

import { laborRulesService } from '@/domains/labor-rules/labor-rules.service';
import {
  evaluateLaborRules,
  summarizeRubrics,
  validateLaborCompliance,
  type WorkContext,
  type CalculatedRubric,
  type ComplianceResult,
} from '@/domains/labor-rules';
import { salaryContractService } from './salary-contract.service';
import type { QueryScope } from '@/domains/shared/scoped-query';

// ── Input ──

export interface WorkData {
  horas_extras_50?: number;
  horas_extras_100?: number;
  horas_noturnas?: number;
  plantao?: boolean;
  plantao_horas?: number;
  sobreaviso?: boolean;
  sobreaviso_horas?: number;
  insalubridade_grau?: 'minimo' | 'medio' | 'maximo' | null;
  periculosidade?: boolean;
  dias_trabalhados?: number;
  domingos_feriados_trabalhados?: number;
}

export interface CompensationInput {
  employeeId: string;
  companyId: string;
  employeeStatus?: string;
  workData: WorkData;
  /** Override jornada mensal (default from contract or 220h) */
  jornadaMensalHoras?: number;
  /** CCT weekly hours for compliance check */
  jornadaSemanal?: number;
  /** Contractual flags for compliance */
  hasNightShiftContract?: boolean;
  hasOnCallContract?: boolean;
}

// ── Output ──

export interface CompensationResult {
  rubrics: CalculatedRubric[];
  summary: {
    totalProventos: number;
    totalDescontos: number;
    liquido: number;
    baseInss: number;
    baseFgts: number;
    baseIrrf: number;
  };
  compliance: ComplianceResult;
  workContext: WorkContext;
}

// ── Engine ──

export const compensationEngineService = {
  /**
   * Calculate compensation for an employee by delegating entirely
   * to the Labor Rules Engine. No manual rubric creation.
   */
  async calculate(input: CompensationInput, scope: QueryScope): Promise<CompensationResult> {
    // 1. Get active contract for base salary
    const contract = await salaryContractService.getActive(input.employeeId, scope);
    const baseSalary = contract?.base_salary ?? 0;

    // 2. Build WorkContext
    const workContext: WorkContext = {
      salario_base: baseSalary,
      jornada_mensal_horas: input.jornadaMensalHoras ?? 220,
      horas_extras_50: input.workData.horas_extras_50,
      horas_extras_100: input.workData.horas_extras_100,
      horas_noturnas: input.workData.horas_noturnas,
      plantao: input.workData.plantao,
      plantao_horas: input.workData.plantao_horas,
      sobreaviso: input.workData.sobreaviso,
      sobreaviso_horas: input.workData.sobreaviso_horas,
      insalubridade_grau: input.workData.insalubridade_grau,
      periculosidade: input.workData.periculosidade,
      dias_trabalhados: input.workData.dias_trabalhados,
      domingos_feriados_trabalhados: input.workData.domingos_feriados_trabalhados,
    };

    // 3. Fetch effective rules for the company
    const rules = await laborRulesService.getEffectiveRules(input.companyId, scope);

    // 4. Delegate calculation to Labor Rules Engine
    const rubrics = evaluateLaborRules(workContext, rules);

    // 5. Summarize
    const summary = summarizeRubrics(rubrics);

    // 6. Validate compliance
    const compliance = validateLaborCompliance(workContext, rubrics, {
      jornada_semanal: input.jornadaSemanal,
      employee_status: input.employeeStatus,
      has_night_shift_contract: input.hasNightShiftContract,
      has_oncall_contract: input.hasOnCallContract,
    });

    return {
      rubrics,
      summary: {
        totalProventos: summary.totalProventos,
        totalDescontos: summary.totalDescontos,
        liquido: summary.liquido,
        baseInss: summary.baseInss,
        baseFgts: summary.baseFgts,
        baseIrrf: summary.baseIrrf,
      },
      compliance,
      workContext,
    };
  },
};
