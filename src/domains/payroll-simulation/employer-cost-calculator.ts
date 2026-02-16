/**
 * Employer Cost Calculator
 *
 * Calculates the total employer cost (custo total do empregador)
 * including patronal contributions, provisions, and benefits.
 *
 * Standard Brazilian employer charges:
 * - INSS Patronal: 20% (general rule)
 * - RAT: 1-3% (risk activity, default 2%)
 * - Terceiros (Sistema S): ~5.8% (SESI/SENAI/SEBRAE/INCRA)
 */

import type { EmployerCostResult, ReflectionResult } from './types';

const INSS_PATRONAL_RATE = 0.20;
const RAT_DEFAULT_RATE = 0.02;
const TERCEIROS_RATE = 0.058;

/**
 * Calculate total employer cost.
 */
export function calculateEmployerCost(params: {
  salario_bruto: number;
  total_descontos_empregado: number;
  baseFgts: number;
  fgts: number;
  provisoes: ReflectionResult;
  vale_alimentacao?: number;
  vale_refeicao?: number;
  vale_transporte_valor?: number;
  salario_base: number;
}): EmployerCostResult {
  const {
    salario_bruto,
    total_descontos_empregado,
    baseFgts,
    fgts,
    provisoes,
    vale_alimentacao = 0,
    vale_refeicao = 0,
    vale_transporte_valor = 0,
    salario_base,
  } = params;

  const salario_liquido = round(salario_bruto - total_descontos_empregado);

  // Patronal contributions (over gross pay)
  const inss_patronal = round(salario_bruto * INSS_PATRONAL_RATE);
  const rat = round(salario_bruto * RAT_DEFAULT_RATE);
  const terceiros = round(salario_bruto * TERCEIROS_RATE);

  // Benefits
  const beneficios = round(vale_alimentacao + vale_refeicao + vale_transporte_valor);

  // Total employer cost
  const custo_total_empregador = round(
    salario_bruto +
    fgts +
    inss_patronal +
    rat +
    terceiros +
    provisoes.total_provisoes +
    beneficios
  );

  const fator_custo = salario_base > 0
    ? round(custo_total_empregador / salario_base * 100) / 100
    : 0;

  return {
    salario_bruto,
    salario_liquido,
    total_descontos_empregado,
    fgts,
    inss_patronal,
    rat,
    terceiros,
    provisoes,
    beneficios,
    custo_total_empregador,
    fator_custo,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
