/**
 * Payroll Simulation Engine — Types
 *
 * Defines all input/output contracts for the simulation engine.
 * This engine does NOT generate official payroll — it projects
 * compensation, taxes, and employer costs for financial analysis.
 */

import type { CalculatedRubric } from '@/domains/labor-rules';

// ── Input ──

export interface SimulationInput {
  /** Base salary (salário base contratual) */
  salario_base: number;
  /** Monthly work hours (default 220) */
  jornada_mensal_horas?: number;

  // Variable work data
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
  faltas?: number;
  bonus_variavel?: number;

  /** Number of dependents for IRRF deduction */
  dependentes_irrf?: number;
  /** Other IRRF deductions (pension, etc.) */
  outras_deducoes_irrf?: number;
  /** Months worked in year (for 13º projection) */
  meses_trabalhados_ano?: number;
  /** Include meal/transport benefits in cost projection */
  vale_alimentacao?: number;
  vale_refeicao?: number;
  vale_transporte_valor?: number;
}

// ── Tax Breakdown ──

export interface InssBreakdown {
  faixa: number;
  base: number;
  aliquota: number;
  valor: number;
}

export interface TaxResult {
  /** INSS employee contribution */
  inss: number;
  inss_faixas: InssBreakdown[];
  /** IRRF withholding */
  irrf: number;
  irrf_base: number;
  irrf_aliquota: number;
  irrf_deducao: number;
  /** FGTS employer deposit (8%) */
  fgts: number;
}

// ── Reflection (Reflexos) ──

export interface ReflectionResult {
  /** 1/3 férias projection */
  ferias_terco: number;
  /** 13º salário projection */
  decimo_terceiro: number;
  /** FGTS over férias + 13º */
  fgts_sobre_ferias: number;
  fgts_sobre_13: number;
  /** Multa rescisória FGTS (40%) provision */
  provisao_multa_fgts: number;
  /** Total monthly provision */
  total_provisoes: number;
}

// ── Employer Cost ──

export interface EmployerCostResult {
  /** Gross salary (proventos - descontos empregado) */
  salario_bruto: number;
  /** Net salary after INSS + IRRF */
  salario_liquido: number;
  /** Total employee deductions */
  total_descontos_empregado: number;
  /** FGTS deposit */
  fgts: number;
  /** INSS patronal estimate (usually ~28.8% for general) */
  inss_patronal: number;
  /** RAT (risk contribution) estimate */
  rat: number;
  /** Sistema S / Terceiros estimate */
  terceiros: number;
  /** Monthly provisions (férias, 13º, multa FGTS) */
  provisoes: ReflectionResult;
  /** Benefits cost */
  beneficios: number;
  /** Total employer cost per month */
  custo_total_empregador: number;
  /** Cost multiplier over base salary */
  fator_custo: number;
}

// ── Encargo Estimate (SIMULAÇÃO) ──

/**
 * Estimated tax/charges summary.
 * ⚠️ SIMULAÇÃO — valores estimados, NÃO substitui cálculos oficiais de folha.
 */
export interface EncargoEstimate {
  /** ⚠️ Always true — marks this as simulation, not official payroll */
  is_simulacao: true;
  disclaimer: string;
  base_inss: number;
  valor_inss_estimado: number;
  base_irrf: number;
  valor_irrf_estimado: number;
  base_fgts: number;
  valor_fgts_estimado: number;
  /** Total estimated charges (INSS + IRRF + FGTS) */
  total_encargos_estimados: number;
}

// ── Full Simulation Output ──

export interface PayrollSimulationOutput {
  input: SimulationInput;
  rubrics: CalculatedRubric[];
  summary: {
    totalProventos: number;
    totalDescontos: number;
    liquido: number;
    baseInss: number;
    baseFgts: number;
    baseIrrf: number;
  };
  taxes: TaxResult;
  /** ⚠️ SIMULAÇÃO — estimated charges, not official */
  encargos: EncargoEstimate;
  reflections: ReflectionResult;
  employerCost: EmployerCostResult;
  /** Timestamp of simulation */
  simulated_at: string;
}
