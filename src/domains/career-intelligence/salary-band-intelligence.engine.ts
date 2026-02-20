/**
 * Salary Band Intelligence Engine — Pure analysis (no I/O)
 *
 * Integrates:
 *  - Piso sindical (CCT) → minimo_legal
 *  - Market benchmarks → media_mercado
 *  - Payroll simulation → impacto_encargos
 *  - Risk grade → impacto_risco (insalubridade/periculosidade)
 *
 * Returns a SuggestedSalaryBand for a given career position.
 */

import type { CareerPosition, CareerSalaryBenchmark, CareerLegalMapping } from './types';

// ── Output ──

export interface SuggestedSalaryBand {
  position_id: string;
  position_name: string;
  /** Legal minimum (CCT salary floor or national minimum) */
  minimo_legal: number;
  /** Market median if benchmark data available; null otherwise */
  media_mercado: number | null;
  /** Estimated employer charge multiplier (e.g. 1.78 = 78% above base) */
  impacto_encargos: number;
  /** Monthly additional cost from risk premiums (insalubridade/periculosidade) */
  impacto_risco: number;
  /** Suggested band */
  suggested_min: number;
  suggested_max: number;
  /** Whether current band is compliant */
  compliant: boolean;
  /** Warnings */
  warnings: string[];
}

// ── CCT input ──

export interface CctSalaryInput {
  salary_floor: number | null;
  salary_ceiling: number | null;
  annual_readjustment_pct: number | null;
}

// ── Encargo factor input ──

export interface EncargoFactorInput {
  /** Cost multiplier (fator_custo from PayrollSimulation, e.g. 1.78) */
  fator_custo: number;
}

// ── Constants ──

const NATIONAL_MINIMUM_WAGE = 1518; // 2025/2026
const DEFAULT_ENCARGO_FACTOR = 1.78;
const INSALUBRIDADE_RATES: Record<string, number> = { minimo: 0.10, medio: 0.20, maximo: 0.40 };
const PERICULOSIDADE_RATE = 0.30;

// ── Engine ──

export function suggestSalaryBand(
  position: CareerPosition,
  benchmarks: CareerSalaryBenchmark[],
  legalMappings: CareerLegalMapping[],
  cct: CctSalaryInput | null,
  encargoFactor: EncargoFactorInput | null
): SuggestedSalaryBand {
  const warnings: string[] = [];

  // 1. Minimum legal floor
  const cctFloor = cct?.salary_floor ?? 0;
  const minimo_legal = Math.max(cctFloor, NATIONAL_MINIMUM_WAGE);

  // 2. Market median
  const sorted = [...benchmarks].sort(
    (a, b) => new Date(b.referencia_data).getTime() - new Date(a.referencia_data).getTime()
  );
  const media_mercado = sorted.length > 0 ? sorted[0].valor_mediano : null;

  // 3. Encargo factor
  const impacto_encargos = encargoFactor?.fator_custo ?? DEFAULT_ENCARGO_FACTOR;

  // 4. Risk premium (insalubridade / periculosidade)
  let impacto_risco = 0;
  for (const m of legalMappings) {
    if (m.adicional_aplicavel === 'insalubridade') {
      // Use minimum grade as conservative default
      impacto_risco = Math.max(impacto_risco, minimo_legal * INSALUBRIDADE_RATES.minimo);
    }
    if (m.adicional_aplicavel === 'periculosidade') {
      // Periculosidade = 30% of base salary (use position min as proxy)
      impacto_risco = Math.max(impacto_risco, position.faixa_salarial_min * PERICULOSIDADE_RATE);
    }
  }

  // 5. Suggested band
  const baseMin = Math.max(minimo_legal, media_mercado ? media_mercado * 0.85 : minimo_legal);
  const baseMax = media_mercado ? media_mercado * 1.15 : baseMin * 1.5;
  const suggested_min = Math.round(baseMin + impacto_risco);
  const suggested_max = Math.round(Math.max(baseMax + impacto_risco, suggested_min * 1.2));

  // 6. Compliance check
  const compliant = position.faixa_salarial_min >= minimo_legal;
  if (!compliant) {
    warnings.push(
      `Faixa salarial mínima (R$ ${position.faixa_salarial_min.toFixed(2)}) está abaixo do piso legal (R$ ${minimo_legal.toFixed(2)}).`
    );
  }
  if (media_mercado && position.faixa_salarial_max < media_mercado * 0.8) {
    warnings.push(
      `Faixa máxima está mais de 20% abaixo da mediana de mercado (R$ ${media_mercado.toFixed(2)}).`
    );
  }
  if (impacto_risco > 0) {
    warnings.push(
      `Cargo possui adicional de risco estimado em R$ ${impacto_risco.toFixed(2)}/mês — incluir no custo total.`
    );
  }

  return {
    position_id: position.id,
    position_name: position.nome,
    minimo_legal,
    media_mercado,
    impacto_encargos,
    impacto_risco,
    suggested_min,
    suggested_max,
    compliant,
    warnings,
  };
}
