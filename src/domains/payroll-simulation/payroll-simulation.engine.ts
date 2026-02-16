/**
 * Payroll Simulation Engine — Core Orchestrator
 *
 * Simulates full CLT compensation without generating official payroll.
 * Uses LaborRulesEngine for rubric evaluation, then layers tax,
 * reflection, and employer cost calculations.
 *
 * Flow:
 *   SimulationInput
 *     → evaluateLaborRules() → CalculatedRubric[]
 *     → summarizeRubrics() → bases (INSS/IRRF/FGTS)
 *     → calculateTaxes() → TaxResult
 *     → calculateReflections() → ReflectionResult
 *     → calculateEmployerCost() → EmployerCostResult
 *     → PayrollSimulationOutput
 */

import {
  evaluateLaborRules,
  summarizeRubrics,
  type WorkContext,
  type LaborRuleDefinition,
} from '@/domains/labor-rules';
import { calculateTaxes } from './tax-calculator';
import { calculateReflections } from './reflection-calculator';
import { calculateEmployerCost } from './employer-cost-calculator';
import type { SimulationInput, PayrollSimulationOutput } from './types';

/**
 * Run a full payroll simulation.
 *
 * @param input - Employee work/salary data
 * @param rules - Effective labor rules (from laborRulesService.getEffectiveRules)
 * @returns Complete simulation with rubrics, taxes, reflections, and employer cost
 */
export function simulatePayroll(
  input: SimulationInput,
  rules: LaborRuleDefinition[],
): PayrollSimulationOutput {
  // 1. Build WorkContext for LaborRulesEngine
  const workContext: WorkContext = {
    salario_base: input.salario_base,
    jornada_mensal_horas: input.jornada_mensal_horas ?? 220,
    horas_extras_50: input.horas_extras_50,
    horas_extras_100: input.horas_extras_100,
    horas_noturnas: input.horas_noturnas,
    plantao: input.plantao,
    plantao_horas: input.plantao_horas,
    sobreaviso: input.sobreaviso,
    sobreaviso_horas: input.sobreaviso_horas,
    insalubridade_grau: input.insalubridade_grau,
    periculosidade: input.periculosidade,
    dias_trabalhados: input.dias_trabalhados,
    domingos_feriados_trabalhados: input.domingos_feriados_trabalhados,
    faltas: input.faltas,
    bonus_variavel: input.bonus_variavel,
  };

  // 2. Evaluate rubrics via LaborRulesEngine
  const rubrics = evaluateLaborRules(workContext, rules);

  // 3. Summarize into bases
  const summary = summarizeRubrics(rubrics);

  // Add base salary to proventos (engine only calculates additionals)
  const totalProventos = summary.totalProventos + input.salario_base;
  const baseInss = summary.baseInss + input.salario_base;
  const baseIrrf = summary.baseIrrf + input.salario_base;
  const baseFgts = summary.baseFgts + input.salario_base;

  const fullSummary = {
    totalProventos: round(totalProventos),
    totalDescontos: summary.totalDescontos,
    liquido: round(totalProventos - summary.totalDescontos),
    baseInss: round(baseInss),
    baseFgts: round(baseFgts),
    baseIrrf: round(baseIrrf),
  };

  // 4. Calculate taxes
  const taxes = calculateTaxes(
    fullSummary.baseInss,
    fullSummary.baseIrrf,
    fullSummary.baseFgts,
    input.dependentes_irrf ?? 0,
    input.outras_deducoes_irrf ?? 0,
  );

  // 5. Calculate reflections (provisions)
  const reflections = calculateReflections(
    totalProventos,
    baseFgts,
    input.meses_trabalhados_ano ?? 12,
  );

  // 6. Calculate employer cost
  const totalDescontosEmpregado = round(
    summary.totalDescontos + taxes.inss + taxes.irrf
  );

  const employerCost = calculateEmployerCost({
    salario_bruto: fullSummary.totalProventos,
    total_descontos_empregado: totalDescontosEmpregado,
    baseFgts,
    fgts: taxes.fgts,
    provisoes: reflections,
    vale_alimentacao: input.vale_alimentacao,
    vale_refeicao: input.vale_refeicao,
    vale_transporte_valor: input.vale_transporte_valor,
    salario_base: input.salario_base,
  });

  return {
    input,
    rubrics,
    summary: fullSummary,
    taxes,
    reflections,
    employerCost,
    simulated_at: new Date().toISOString(),
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
