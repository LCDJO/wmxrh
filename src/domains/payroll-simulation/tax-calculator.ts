/**
 * Tax Calculator — INSS, IRRF, FGTS
 *
 * Implements progressive Brazilian tax tables (2024+).
 * Pure functions, no DB dependency.
 */

import type { TaxResult, InssBreakdown } from './types';

// ── INSS 2024 Progressive Table ──

const INSS_TABLE = [
  { min: 0,       max: 1412.00,  rate: 7.5  },
  { min: 1412.00, max: 2666.68,  rate: 9.0  },
  { min: 2666.68, max: 4000.03,  rate: 12.0 },
  { min: 4000.03, max: 7786.02,  rate: 14.0 },
];

const INSS_CEILING = 7786.02;

// ── IRRF 2024 Table ──

const IRRF_TABLE = [
  { min: 0,       max: 2259.20, rate: 0,    deduction: 0       },
  { min: 2259.21, max: 2826.65, rate: 7.5,  deduction: 169.44  },
  { min: 2826.66, max: 3751.05, rate: 15.0, deduction: 381.44  },
  { min: 3751.06, max: 4664.68, rate: 22.5, deduction: 662.77  },
  { min: 4664.69, max: Infinity, rate: 27.5, deduction: 896.00 },
];

const IRRF_DEDUCTION_PER_DEPENDENT = 189.59;

/**
 * Calculate INSS (employee contribution) progressively.
 */
export function calculateInss(baseInss: number): { total: number; faixas: InssBreakdown[] } {
  const faixas: InssBreakdown[] = [];
  let remaining = Math.min(baseInss, INSS_CEILING);
  let total = 0;

  for (let i = 0; i < INSS_TABLE.length; i++) {
    if (remaining <= 0) break;
    const bracket = INSS_TABLE[i];
    const bracketSize = bracket.max - bracket.min;
    const taxable = Math.min(remaining, bracketSize);

    if (taxable > 0) {
      const valor = round(taxable * bracket.rate / 100);
      total += valor;
      faixas.push({
        faixa: i + 1,
        base: round(taxable),
        aliquota: bracket.rate,
        valor,
      });
      remaining -= taxable;
    }
  }

  return { total: round(total), faixas };
}

/**
 * Calculate IRRF (withholding tax).
 */
export function calculateIrrf(
  baseIrrf: number,
  inssDeducted: number,
  dependentes: number = 0,
  outrasDeducoes: number = 0,
): { irrf: number; base: number; aliquota: number; deducao: number } {
  const deducaoDependentes = dependentes * IRRF_DEDUCTION_PER_DEPENDENT;
  const base = round(baseIrrf - inssDeducted - deducaoDependentes - outrasDeducoes);

  if (base <= 0) {
    return { irrf: 0, base: 0, aliquota: 0, deducao: 0 };
  }

  // Find applicable bracket
  let applicable = IRRF_TABLE[0];
  for (const bracket of IRRF_TABLE) {
    if (base >= bracket.min) {
      applicable = bracket;
    }
  }

  const irrf = Math.max(0, round(base * applicable.rate / 100 - applicable.deduction));

  return {
    irrf,
    base,
    aliquota: applicable.rate,
    deducao: applicable.deduction,
  };
}

/**
 * Calculate FGTS (employer deposit — 8%).
 */
export function calculateFgts(baseFgts: number): number {
  return round(baseFgts * 0.08);
}

/**
 * Full tax calculation.
 */
export function calculateTaxes(
  baseInss: number,
  baseIrrf: number,
  baseFgts: number,
  dependentes: number = 0,
  outrasDeducoes: number = 0,
): TaxResult {
  const inss = calculateInss(baseInss);
  const irrf = calculateIrrf(baseIrrf, inss.total, dependentes, outrasDeducoes);
  const fgts = calculateFgts(baseFgts);

  return {
    inss: inss.total,
    inss_faixas: inss.faixas,
    irrf: irrf.irrf,
    irrf_base: irrf.base,
    irrf_aliquota: irrf.aliquota,
    irrf_deducao: irrf.deducao,
    fgts,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
