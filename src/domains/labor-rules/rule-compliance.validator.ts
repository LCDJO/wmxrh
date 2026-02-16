/**
 * Labor Rules — Compliance Validator
 * Validações automáticas de regras trabalhistas CLT.
 */

import type { WorkContext, CalculatedRubric } from './rule-evaluation.engine';

// ── Types ──

export type ComplianceSeverity = 'block' | 'alert' | 'info';

export interface ComplianceValidation {
  code: string;
  severity: ComplianceSeverity;
  message: string;
  category: string;
  legal_basis: string | null;
  context?: Record<string, unknown>;
}

export interface ComplianceResult {
  valid: boolean;
  violations: ComplianceValidation[];
  blocked: boolean;
}

// ── Constants ──

const CLT_WEEKLY_OVERTIME_LIMIT = 44; // Art. 59 CLT — limite semanal padrão + extras
const CLT_DAILY_OVERTIME_LIMIT = 2;   // Art. 59 §1º — máximo 2h extras/dia

// ── Validator ──

/**
 * Validates work context and calculated rubrics against CLT compliance rules.
 * Returns blocking violations (must stop) and alerts (warnings).
 */
export function validateLaborCompliance(
  ctx: WorkContext,
  rubrics: CalculatedRubric[],
  options?: {
    jornada_semanal?: number;         // CCT override (default 44h)
    employee_status?: string;         // 'active' | 'terminated' etc.
    has_night_shift_contract?: boolean;
    has_oncall_contract?: boolean;
  },
): ComplianceResult {
  const violations: ComplianceValidation[] = [];
  const opts = options ?? {};

  // ── 1. Horas extras acima do limite semanal → ALERT ──
  validateOvertimeLimit(ctx, opts, violations);

  // ── 2. Adicional noturno sem jornada noturna → BLOCK ──
  validateNightShift(ctx, rubrics, opts, violations);

  // ── 3. Adicional plantão exige vínculo ativo → BLOCK ──
  validateOnCallContract(ctx, rubrics, opts, violations);

  // ── 4. Insalubridade + Periculosidade simultâneos → ALERT (vedação legal) ──
  validateHazardCombination(ctx, violations);

  // ── 5. Horas extras diárias acima de 2h → ALERT ──
  validateDailyOvertimeLimit(ctx, violations);

  // ── 6. Colaborador inativo recebendo verbas → BLOCK ──
  validateActiveStatus(ctx, rubrics, opts, violations);

  const blocked = violations.some(v => v.severity === 'block');

  return {
    valid: violations.length === 0,
    violations,
    blocked,
  };
}

// ── Individual Validators ──

function validateOvertimeLimit(
  ctx: WorkContext,
  opts: { jornada_semanal?: number },
  violations: ComplianceValidation[],
) {
  const totalExtras = (ctx.horas_extras_50 ?? 0) + (ctx.horas_extras_100 ?? 0);
  if (totalExtras <= 0) return;

  const jornada = opts.jornada_semanal ?? 44;
  // Estimate weekly from monthly (÷ 4.33 weeks)
  const weeklyExtras = totalExtras / 4.33;
  const totalWeekly = jornada + weeklyExtras;

  if (totalWeekly > CLT_WEEKLY_OVERTIME_LIMIT + 10) {
    violations.push({
      code: 'OVERTIME_WEEKLY_LIMIT',
      severity: 'alert',
      message: `Horas extras estimadas (${Math.round(weeklyExtras)}h/semana) excedem o limite recomendado. Jornada semanal total estimada: ${Math.round(totalWeekly)}h.`,
      category: 'hora_extra',
      legal_basis: 'CLT Art. 59 — Limite de 2h extras por dia, 44h semanais',
      context: { weeklyExtras: Math.round(weeklyExtras * 100) / 100, totalWeekly: Math.round(totalWeekly * 100) / 100 },
    });
  }
}

function validateNightShift(
  ctx: WorkContext,
  rubrics: CalculatedRubric[],
  opts: { has_night_shift_contract?: boolean },
  violations: ComplianceValidation[],
) {
  const hasNightRubric = rubrics.some(r => r.category === 'adicional_noturno' && r.valor > 0);
  const hasNightHours = (ctx.horas_noturnas ?? 0) > 0;

  if (hasNightRubric && !hasNightHours) {
    violations.push({
      code: 'NIGHT_SHIFT_NO_HOURS',
      severity: 'block',
      message: 'Adicional noturno calculado sem horas noturnas registradas no contexto de trabalho.',
      category: 'adicional_noturno',
      legal_basis: 'CLT Art. 73 — Adicional noturno exige trabalho entre 22h e 5h',
    });
  }

  if (hasNightHours && !opts.has_night_shift_contract && opts.has_night_shift_contract !== undefined) {
    violations.push({
      code: 'NIGHT_SHIFT_NO_CONTRACT',
      severity: 'alert',
      message: 'Horas noturnas registradas mas colaborador não possui contrato com jornada noturna.',
      category: 'adicional_noturno',
      legal_basis: 'CLT Art. 73 §1º',
    });
  }
}

function validateOnCallContract(
  ctx: WorkContext,
  rubrics: CalculatedRubric[],
  opts: { has_oncall_contract?: boolean; employee_status?: string },
  violations: ComplianceValidation[],
) {
  const hasOnCallRubric = rubrics.some(
    r => (r.category === 'plantao' || r.category === 'sobreaviso') && r.valor > 0
  );

  if (!hasOnCallRubric) return;

  // Vínculo ativo obrigatório
  if (opts.employee_status && opts.employee_status !== 'active') {
    violations.push({
      code: 'ONCALL_INACTIVE_EMPLOYEE',
      severity: 'block',
      message: 'Adicional de plantão/sobreaviso requer vínculo empregatício ativo.',
      category: 'plantao',
      legal_basis: 'CLT Art. 244 §2º — Sobreaviso exige vínculo ativo',
    });
  }

  // Contrato de sobreaviso
  if (opts.has_oncall_contract === false) {
    violations.push({
      code: 'ONCALL_NO_CONTRACT',
      severity: 'alert',
      message: 'Adicional de plantão/sobreaviso sem previsão contratual registrada.',
      category: 'plantao',
      legal_basis: 'CLT Art. 244 §2º',
    });
  }
}

function validateHazardCombination(
  ctx: WorkContext,
  violations: ComplianceValidation[],
) {
  if (ctx.insalubridade_grau && ctx.periculosidade) {
    violations.push({
      code: 'HAZARD_DOUBLE_PAY',
      severity: 'alert',
      message: 'Insalubridade e periculosidade simultâneos — CLT permite apenas o mais vantajoso ao empregado.',
      category: 'insalubridade',
      legal_basis: 'CLT Art. 193 §2º — Vedação de cumulação (posição majoritária TST)',
    });
  }
}

function validateDailyOvertimeLimit(
  ctx: WorkContext,
  violations: ComplianceValidation[],
) {
  const totalMonthly = (ctx.horas_extras_50 ?? 0) + (ctx.horas_extras_100 ?? 0);
  const diasTrabalhados = ctx.dias_trabalhados ?? 22;
  if (diasTrabalhados <= 0 || totalMonthly <= 0) return;

  const dailyAvg = totalMonthly / diasTrabalhados;
  if (dailyAvg > CLT_DAILY_OVERTIME_LIMIT) {
    violations.push({
      code: 'OVERTIME_DAILY_LIMIT',
      severity: 'alert',
      message: `Média diária de horas extras (${dailyAvg.toFixed(1)}h) excede o limite de ${CLT_DAILY_OVERTIME_LIMIT}h/dia.`,
      category: 'hora_extra',
      legal_basis: 'CLT Art. 59 §1º — Máximo de 2 horas extras por dia',
      context: { dailyAvg: Math.round(dailyAvg * 100) / 100 },
    });
  }
}

function validateActiveStatus(
  _ctx: WorkContext,
  rubrics: CalculatedRubric[],
  opts: { employee_status?: string },
  violations: ComplianceValidation[],
) {
  if (!opts.employee_status || opts.employee_status === 'active') return;
  if (rubrics.length === 0) return;

  const totalValor = rubrics.reduce((s, r) => s + r.valor, 0);
  if (totalValor > 0) {
    violations.push({
      code: 'INACTIVE_EMPLOYEE_RUBRICS',
      severity: 'block',
      message: `Colaborador com status "${opts.employee_status}" possui rubricas calculadas (R$ ${totalValor.toFixed(2)}). Verbas salariais exigem vínculo ativo.`,
      category: 'geral',
      legal_basis: null,
    });
  }
}
