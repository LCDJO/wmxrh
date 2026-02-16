/**
 * Rule Evaluation Engine
 * Avalia regras trabalhistas dinamicamente com base no contexto de trabalho do colaborador.
 *
 * evaluateLaborRules(employeeContext, rules) → CalculatedRubric[]
 */

import type { LaborRuleDefinition, LaborRuleCategory } from './types';

// ── Input ──

export interface WorkContext {
  salario_base: number;
  jornada_mensal_horas: number;       // e.g. 220
  horas_extras_50?: number;
  horas_extras_100?: number;
  horas_noturnas?: number;
  plantao?: boolean;
  plantao_horas?: number;
  sobreaviso?: boolean;
  sobreaviso_horas?: number;
  insalubridade_grau?: 'minimo' | 'medio' | 'maximo' | null;
  periculosidade?: boolean;
  dias_trabalhados?: number;          // no mês (para DSR)
  domingos_feriados_trabalhados?: number;
}

// ── Output ──

export interface CalculatedRubric {
  rule_id: string;
  rule_name: string;
  category: LaborRuleCategory;
  codigo_rubrica: string | null;
  valor: number;
  base_calculo: string | null;
  percentual_aplicado: number | null;
  quantidade: number | null;
  legal_basis: string | null;
  integra_inss: boolean;
  integra_irrf: boolean;
  integra_fgts: boolean;
  integra_ferias: boolean;
  integra_13: boolean;
  integra_dsr: boolean;
  aplica_reflexos: boolean;
}

// ── Engine ──

/**
 * Main evaluation function.
 * Receives the employee work context and the set of effective rules,
 * returns all calculated rubrics with values > 0.
 */
export function evaluateLaborRules(
  ctx: WorkContext,
  rules: LaborRuleDefinition[],
): CalculatedRubric[] {
  const results: CalculatedRubric[] = [];
  const hourRate = ctx.jornada_mensal_horas > 0
    ? ctx.salario_base / ctx.jornada_mensal_horas
    : 0;

  // Sort by priority (lower = first)
  const sorted = [...rules]
    .filter(r => r.is_active && !r.deleted_at)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    const rubric = evaluateRule(rule, ctx, hourRate);
    if (rubric && rubric.valor > 0) {
      results.push(rubric);
    }
  }

  return results;
}

function evaluateRule(
  rule: LaborRuleDefinition,
  ctx: WorkContext,
  hourRate: number,
): CalculatedRubric | null {
  let valor = 0;
  let percentual: number | null = null;
  let quantidade: number | null = null;

  switch (rule.category) {
    // ── HORA EXTRA ──
    case 'hora_extra': {
      const pct = rule.base_percentage ?? 0;
      // Match 50% rules to horas_extras_50, 100% to horas_extras_100
      const hours = pct >= 100
        ? (ctx.horas_extras_100 ?? 0)
        : (ctx.horas_extras_50 ?? 0);
      if (hours <= 0) return null;
      percentual = pct;
      quantidade = hours;
      valor = hours * hourRate * (1 + pct / 100);
      break;
    }

    // ── ADICIONAL NOTURNO ──
    case 'adicional_noturno': {
      const hours = ctx.horas_noturnas ?? 0;
      if (hours <= 0) return null;
      percentual = rule.base_percentage ?? 20;
      quantidade = hours;
      // Noturno: hora reduzida (52:30) + percentual
      const reducedHourRate = hourRate * (60 / 52.5);
      valor = hours * reducedHourRate * (percentual / 100);
      break;
    }

    // ── INSALUBRIDADE ──
    case 'insalubridade': {
      if (!ctx.insalubridade_grau) return null;
      const grauMap: Record<string, number> = { minimo: 10, medio: 20, maximo: 40 };
      const expectedPct = grauMap[ctx.insalubridade_grau];
      // Only apply the rule that matches the employee's grade
      if (rule.base_percentage !== expectedPct) return null;
      percentual = expectedPct;
      // Base = salário mínimo (using base_salary as proxy; real would use SM)
      valor = ctx.salario_base * (percentual / 100);
      break;
    }

    // ── PERICULOSIDADE ──
    case 'periculosidade': {
      if (!ctx.periculosidade) return null;
      percentual = rule.base_percentage ?? 30;
      valor = ctx.salario_base * (percentual / 100);
      break;
    }

    // ── SOBREAVISO ──
    case 'sobreaviso': {
      if (!ctx.sobreaviso) return null;
      const hours = ctx.sobreaviso_horas ?? 0;
      if (hours <= 0) return null;
      percentual = rule.percentual_sobre_hora ?? rule.base_percentage ?? 33.33;
      quantidade = Math.min(hours, rule.limite_horas ?? Infinity);
      valor = quantidade * hourRate * (percentual / 100);
      break;
    }

    // ── PLANTÃO ──
    case 'plantao': {
      if (!ctx.plantao) return null;
      const hours = ctx.plantao_horas ?? 0;
      if (hours <= 0) return null;
      percentual = rule.percentual_sobre_hora ?? rule.base_percentage ?? 0;
      quantidade = Math.min(hours, rule.limite_horas ?? Infinity);
      if (rule.calc_type === 'fixed_value' && rule.fixed_value) {
        valor = rule.fixed_value * quantidade;
      } else {
        valor = quantidade * hourRate * (1 + (percentual ?? 0) / 100);
      }
      break;
    }

    // ── DSR ──
    case 'dsr': {
      // DSR = (soma verbas variáveis / dias úteis) * domingos+feriados
      // Simplified: reflexo sobre HE
      const heTotal = (ctx.horas_extras_50 ?? 0) * hourRate * 1.5
        + (ctx.horas_extras_100 ?? 0) * hourRate * 2;
      if (heTotal <= 0) return null;
      const diasUteis = ctx.dias_trabalhados ?? 22;
      const domingos = ctx.domingos_feriados_trabalhados ?? 4;
      valor = (heTotal / diasUteis) * domingos;
      break;
    }

    // ── VALE TRANSPORTE (desconto 6%) ──
    case 'vale_transporte': {
      percentual = rule.base_percentage ?? 6;
      valor = ctx.salario_base * (percentual / 100);
      break;
    }

    // ── FGTS ──
    case 'fgts': {
      percentual = rule.base_percentage ?? 8;
      valor = ctx.salario_base * (percentual / 100);
      break;
    }

    // ── Generic percentage/fixed ──
    default: {
      if (rule.calc_type === 'percentage' && rule.base_percentage) {
        percentual = rule.base_percentage;
        valor = ctx.salario_base * (percentual / 100);
      } else if (rule.calc_type === 'fixed_value' && rule.fixed_value) {
        valor = rule.fixed_value;
      } else {
        return null; // formula/tiered not evaluated client-side
      }
    }
  }

  return {
    rule_id: rule.id,
    rule_name: rule.name,
    category: rule.category,
    codigo_rubrica: rule.esocial_rubric_code,
    valor: Math.round(valor * 100) / 100,
    base_calculo: rule.base_calculo,
    percentual_aplicado: percentual,
    quantidade,
    legal_basis: rule.legal_basis,
    integra_inss: rule.integra_inss,
    integra_irrf: rule.integra_irrf,
    integra_fgts: rule.integra_fgts,
    integra_ferias: rule.integra_ferias,
    integra_13: rule.integra_13,
    integra_dsr: rule.integra_dsr ?? false,
    aplica_reflexos: rule.aplica_reflexos ?? false,
  };
}

/**
 * Summarize calculated rubrics into totals.
 */
export function summarizeRubrics(rubrics: CalculatedRubric[]) {
  const proventos = rubrics.filter(r => r.valor > 0 && r.category !== 'vale_transporte');
  const descontos = rubrics.filter(r => r.category === 'vale_transporte');

  const totalProventos = proventos.reduce((s, r) => s + r.valor, 0);
  const totalDescontos = descontos.reduce((s, r) => s + r.valor, 0);
  const baseInss = rubrics.filter(r => r.integra_inss).reduce((s, r) => s + r.valor, 0);
  const baseFgts = rubrics.filter(r => r.integra_fgts).reduce((s, r) => s + r.valor, 0);
  const baseIrrf = rubrics.filter(r => r.integra_irrf).reduce((s, r) => s + r.valor, 0);

  return {
    rubrics,
    totalProventos: Math.round(totalProventos * 100) / 100,
    totalDescontos: Math.round(totalDescontos * 100) / 100,
    liquido: Math.round((totalProventos - totalDescontos) * 100) / 100,
    baseInss: Math.round(baseInss * 100) / 100,
    baseFgts: Math.round(baseFgts * 100) / 100,
    baseIrrf: Math.round(baseIrrf * 100) / 100,
  };
}
