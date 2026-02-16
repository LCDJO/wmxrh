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
import type { SimulationInput, PayrollSimulationOutput, EncargoEstimate } from './types';
import {
  payrollSimulationEventBus,
  detectSimulationRisks,
  type PayrollSimulationCreatedPayload,
  type EncargoEstimateUpdatedPayload,
} from './payroll-simulation.events';
/**
 * Run a full payroll simulation.
 *
 * @param input - Employee work/salary data
 * @param rules - Effective labor rules (from laborRulesService.getEffectiveRules)
 * @param meta  - Optional metadata for event emission (tenantId, employeeId)
 * @returns Complete simulation with rubrics, taxes, reflections, and employer cost
 */
export function simulatePayroll(
  input: SimulationInput,
  rules: LaborRuleDefinition[],
  meta?: { tenantId?: string; employeeId?: string },
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

  // 3. Auto-reflect DSR over rubrics with integra_dsr
  //    DSR = (soma verbas variáveis / dias úteis) * domingos+feriados
  const dsrRubrics = rubrics.filter(r => r.integra_dsr && r.valor > 0);
  const dsrBase = dsrRubrics.reduce((s, r) => s + r.valor, 0);
  let dsrReflexo = 0;

  if (dsrBase > 0) {
    const diasUteis = input.dias_trabalhados ?? 22;
    const domingos = input.domingos_feriados_trabalhados ?? 4;
    dsrReflexo = round((dsrBase / diasUteis) * domingos);

    // Check if DSR was already calculated by the rules engine to avoid duplication
    const existingDsr = rubrics.find(r => r.category === 'dsr');
    if (!existingDsr) {
      rubrics.push({
        rule_id: '__dsr_reflexo',
        rule_name: 'DSR sobre Verbas Variáveis (reflexo automático)',
        category: 'dsr' as any,
        codigo_rubrica: null,
        valor: dsrReflexo,
        base_calculo: 'soma verbas com integra_dsr',
        percentual_aplicado: null,
        quantidade: null,
        legal_basis: 'CLT Art. 67 / Súmula 172 TST',
        integra_inss: true,
        integra_irrf: true,
        integra_fgts: true,
        integra_ferias: true,
        integra_13: true,
        integra_dsr: false,
        aplica_reflexos: true,
      });
    }
  }

  // 4. Summarize into bases (after DSR reflexo injection)
  const summary = summarizeRubrics(rubrics);

  // Add base salary to proventos (engine only calculates additionals)
  const totalProventos = summary.totalProventos + input.salario_base;
  let baseInss = summary.baseInss + input.salario_base;
  let baseIrrf = summary.baseIrrf + input.salario_base;
  let baseFgts = summary.baseFgts + input.salario_base;

  // Benefits marked as salarial integrate encargos bases
  // (default: indenizatório = NÃO integra INSS/FGTS/IRRF)
  if (input.vale_alimentacao_salarial && input.vale_alimentacao) {
    baseInss += input.vale_alimentacao;
    baseIrrf += input.vale_alimentacao;
    baseFgts += input.vale_alimentacao;
  }
  if (input.vale_refeicao_salarial && input.vale_refeicao) {
    baseInss += input.vale_refeicao;
    baseIrrf += input.vale_refeicao;
    baseFgts += input.vale_refeicao;
  }
  if (input.vale_transporte_salarial && input.vale_transporte_valor) {
    baseInss += input.vale_transporte_valor;
    baseIrrf += input.vale_transporte_valor;
    baseFgts += input.vale_transporte_valor;
  }

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

  // 7. Build EncargoEstimate (SIMULAÇÃO)
  const encargos: EncargoEstimate = {
    is_simulacao: true,
    disclaimer: 'SIMULAÇÃO — valores estimados para análise financeira. NÃO substitui cálculos oficiais de folha de pagamento.',
    base_inss: fullSummary.baseInss,
    valor_inss_estimado: taxes.inss,
    base_irrf: fullSummary.baseIrrf,
    valor_irrf_estimado: taxes.irrf,
    base_fgts: fullSummary.baseFgts,
    valor_fgts_estimado: taxes.fgts,
    total_encargos_estimados: round(taxes.inss + taxes.irrf + taxes.fgts),
  };

  const result: PayrollSimulationOutput = {
    input,
    rubrics,
    summary: fullSummary,
    taxes,
    encargos,
    reflections,
    employerCost,
    simulated_at: new Date().toISOString(),
  };

  // ── Emit domain events ──
  const tenantId = meta?.tenantId ?? 'unknown';

  payrollSimulationEventBus.emit<PayrollSimulationCreatedPayload>('PayrollSimulationCreated', {
    tenant_id: tenantId,
    employee_id: meta?.employeeId,
    salario_base: input.salario_base,
    custo_total_empregador: employerCost.custo_total_empregador,
    fator_custo: employerCost.fator_custo,
    is_adhoc: !meta?.employeeId,
  });

  payrollSimulationEventBus.emit<EncargoEstimateUpdatedPayload>('EncargoEstimateUpdated', {
    tenant_id: tenantId,
    employee_id: meta?.employeeId,
    base_inss: encargos.base_inss,
    valor_inss_estimado: encargos.valor_inss_estimado,
    valor_irrf_estimado: encargos.valor_irrf_estimado,
    valor_fgts_estimado: encargos.valor_fgts_estimado,
    total_encargos_estimados: encargos.total_encargos_estimados,
  });

  // Risk detection
  const risks = detectSimulationRisks(
    tenantId,
    meta?.employeeId,
    employerCost.fator_custo,
    fullSummary.baseInss,
    input.salario_base,
  );
  for (const risk of risks) {
    payrollSimulationEventBus.emit('SimulationRiskDetected', risk);
  }

  return result;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
