/**
 * Reflection Calculator — Provisões Trabalhistas
 *
 * Projects monthly provisions for:
 * - Férias + 1/3 constitucional
 * - 13º salário
 * - FGTS sobre férias e 13º
 * - Provisão de multa rescisória FGTS (40%)
 *
 * All values are monthly projections (1/12 of annual cost).
 */

import type { ReflectionResult } from './types';

/**
 * Calculate monthly labor provisions (reflexos).
 *
 * @param remuneracaoTotal - Total gross pay (proventos with integra_ferias/integra_13)
 * @param baseFgts - FGTS base for the month
 * @param mesesTrabalhados - Months worked in year (affects 13º proportionality)
 */
export function calculateReflections(
  remuneracaoTotal: number,
  baseFgts: number,
  mesesTrabalhados: number = 12,
): ReflectionResult {
  // Férias: 1/12 of annual salary + 1/3 constitutional bonus
  // Monthly provision = salary / 12 * (1 + 1/3) = salary / 12 * 4/3
  const feriasBase = remuneracaoTotal / 12;
  const ferias_terco = round(feriasBase * (4 / 3));

  // 13º salário: proportional to months worked
  // Monthly provision = salary * meses / 12 / 12
  const decimo_terceiro = round((remuneracaoTotal * mesesTrabalhados / 12) / 12);

  // FGTS (8%) over férias provision
  const fgts_sobre_ferias = round(ferias_terco * 0.08);

  // FGTS (8%) over 13º provision
  const fgts_sobre_13 = round(decimo_terceiro * 0.08);

  // Multa rescisória FGTS: 40% of accumulated FGTS
  // Monthly provision = total FGTS monthly * 40%
  const fgts_mensal = round(baseFgts * 0.08);
  const provisao_multa_fgts = round(fgts_mensal * 0.40);

  const total_provisoes = round(
    ferias_terco + decimo_terceiro + fgts_sobre_ferias + fgts_sobre_13 + provisao_multa_fgts
  );

  return {
    ferias_terco,
    decimo_terceiro,
    fgts_sobre_ferias,
    fgts_sobre_13,
    provisao_multa_fgts,
    total_provisoes,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
