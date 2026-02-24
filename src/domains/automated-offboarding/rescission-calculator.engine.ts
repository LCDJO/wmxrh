/**
 * Rescission Calculator Engine — Cálculo de Rescisão CLT
 *
 * Pure-function engine that calculates all termination values
 * based on Brazilian labor law (CLT).
 *
 * Integrates with PayrollSimulation tax calculators for INSS/IRRF/FGTS.
 *
 * Supported termination types:
 * - sem_justa_causa: Full rights (multa 40% FGTS, aviso prévio, etc.)
 * - justa_causa: Minimal rights (saldo salário + férias vencidas only)
 * - pedido_demissao: No multa FGTS, no aviso prévio indenizado
 * - termino_contrato: Similar to sem_justa_causa but no aviso prévio
 */

import { calculateInss, calculateIrrf, calculateFgts } from '@/domains/payroll-simulation';
import type { OffboardingType, AvisoPrevioType } from './types';

// ── Input ──

export interface RescissionInput {
  offboarding_type: OffboardingType;
  salario_base: number;
  /** Date employee was admitted (ISO string) */
  data_admissao: string;
  /** Date of termination (ISO string) */
  data_desligamento: string;
  /** Aviso prévio type */
  aviso_previo_type: AvisoPrevioType;
  /** Aviso prévio days (minimum 30, +3 per year worked, max 90) */
  aviso_previo_days: number;
  /** Days worked in the termination month */
  dias_trabalhados_mes: number;
  /** Total days in the termination month */
  dias_no_mes: number;
  /** Accrued vacation periods not yet taken */
  ferias_vencidas_periodos: number;
  /** Months since last vacation period started (for proportional) */
  meses_ferias_proporcionais: number;
  /** Months worked in current year (for 13º) */
  meses_13_proporcional: number;
  /** Accumulated FGTS balance */
  saldo_fgts: number;
  /** FGTS deposits in the termination month */
  fgts_mes_rescisao?: number;
  /** Number of IRRF dependents */
  dependentes_irrf?: number;
  /** Acordo mútuo? (CLT Art. 484-A) */
  acordo_mutuo?: boolean;
  /** Deductions: advances, loans, etc. */
  descontos_diversos?: number;
  /** Monthly work hours (default 220) */
  jornada_mensal_horas?: number;
}

// ── Output ──

export interface RescissionLineItem {
  codigo: string;
  descricao: string;
  referencia: string | null;
  tipo: 'provento' | 'desconto';
  valor: number;
  base_legal: string;
}

export interface RescissionResult {
  /** ⚠️ SIMULAÇÃO marker */
  is_simulacao: true;
  disclaimer: string;
  tipo_rescisao: OffboardingType;
  data_admissao: string;
  data_desligamento: string;

  // Verbas
  linhas: RescissionLineItem[];

  // Totals
  total_proventos: number;
  total_descontos: number;
  valor_liquido: number;

  // FGTS
  saldo_fgts: number;
  multa_fgts: number;
  multa_fgts_percentual: number;
  fgts_mes_rescisao: number;
  total_fgts_a_receber: number;

  // Tax breakdown
  inss_desconto: number;
  irrf_desconto: number;

  calculated_at: string;
}

// ── Constants ──

const SALARIO_MINIMO = 1412.00; // 2024

// ── Engine ──

export function calculateRescission(input: RescissionInput): RescissionResult {
  const linhas: RescissionLineItem[] = [];
  const r = round;
  const type = input.offboarding_type;
  const isJustaCausa = type === 'justa_causa';
  const isPedidoDemissao = type === 'pedido_demissao';
  const isAcordoMutuo = input.acordo_mutuo === true;

  // ── 1. Saldo de Salário ──
  const salarioDia = input.salario_base / input.dias_no_mes;
  const saldoSalario = r(salarioDia * input.dias_trabalhados_mes);
  linhas.push({
    codigo: 'SALDO_SALARIO',
    descricao: 'Saldo de Salário',
    referencia: `${input.dias_trabalhados_mes}/${input.dias_no_mes} dias`,
    tipo: 'provento',
    valor: saldoSalario,
    base_legal: 'CLT Art. 462',
  });

  // ── 2. Aviso Prévio Indenizado ──
  let avisoPrevioValor = 0;
  if (
    input.aviso_previo_type === 'indenizado' &&
    !isJustaCausa &&
    !isPedidoDemissao
  ) {
    const valorDia = input.salario_base / 30;
    avisoPrevioValor = r(valorDia * input.aviso_previo_days);
    // Acordo mútuo: 50% do aviso prévio
    if (isAcordoMutuo) avisoPrevioValor = r(avisoPrevioValor * 0.5);

    linhas.push({
      codigo: 'AVISO_PREVIO_IND',
      descricao: `Aviso Prévio Indenizado${isAcordoMutuo ? ' (50% - Acordo)' : ''}`,
      referencia: `${input.aviso_previo_days} dias`,
      tipo: 'provento',
      valor: avisoPrevioValor,
      base_legal: isAcordoMutuo ? 'CLT Art. 484-A' : 'CLT Art. 487, §1º',
    });
  }

  // ── 3. Férias Vencidas + 1/3 ──
  if (input.ferias_vencidas_periodos > 0) {
    const feriasVencidas = r(input.salario_base * input.ferias_vencidas_periodos);
    const tercoVencidas = r(feriasVencidas / 3);
    linhas.push({
      codigo: 'FERIAS_VENCIDAS',
      descricao: 'Férias Vencidas',
      referencia: `${input.ferias_vencidas_periodos} período(s)`,
      tipo: 'provento',
      valor: feriasVencidas,
      base_legal: 'CLT Art. 137',
    });
    linhas.push({
      codigo: 'TERCO_FERIAS_VENCIDAS',
      descricao: '1/3 Constitucional s/ Férias Vencidas',
      referencia: null,
      tipo: 'provento',
      valor: tercoVencidas,
      base_legal: 'CF Art. 7º, XVII',
    });
  }

  // ── 4. Férias Proporcionais + 1/3 ──
  // Justa causa: NÃO tem direito a férias proporcionais
  if (!isJustaCausa && input.meses_ferias_proporcionais > 0) {
    const feriasProporcionais = r((input.salario_base / 12) * input.meses_ferias_proporcionais);
    const tercoProporcionais = r(feriasProporcionais / 3);
    linhas.push({
      codigo: 'FERIAS_PROPORCIONAIS',
      descricao: 'Férias Proporcionais',
      referencia: `${input.meses_ferias_proporcionais}/12 avos`,
      tipo: 'provento',
      valor: feriasProporcionais,
      base_legal: 'CLT Art. 146, parágrafo único',
    });
    linhas.push({
      codigo: 'TERCO_FERIAS_PROPORCIONAIS',
      descricao: '1/3 Constitucional s/ Férias Proporcionais',
      referencia: null,
      tipo: 'provento',
      valor: tercoProporcionais,
      base_legal: 'CF Art. 7º, XVII',
    });
  }

  // ── 5. 13º Salário Proporcional ──
  // Justa causa: NÃO tem direito a 13º proporcional
  if (!isJustaCausa && input.meses_13_proporcional > 0) {
    const decimoTerceiro = r((input.salario_base / 12) * input.meses_13_proporcional);
    linhas.push({
      codigo: 'DECIMO_TERCEIRO_PROP',
      descricao: '13º Salário Proporcional',
      referencia: `${input.meses_13_proporcional}/12 avos`,
      tipo: 'provento',
      valor: decimoTerceiro,
      base_legal: 'Lei 4.090/62, Art. 3º',
    });
  }

  // ── Calculate totals before deductions ──
  const totalProventos = r(linhas.filter(l => l.tipo === 'provento').reduce((s, l) => s + l.valor, 0));

  // ── 6. INSS sobre rescisão ──
  const inssResult = calculateInss(totalProventos);
  if (inssResult.total > 0) {
    linhas.push({
      codigo: 'INSS_RESCISAO',
      descricao: 'INSS s/ Rescisão',
      referencia: null,
      tipo: 'desconto',
      valor: inssResult.total,
      base_legal: 'Lei 8.212/91',
    });
  }

  // ── 7. IRRF sobre rescisão ──
  const irrfResult = calculateIrrf(totalProventos, inssResult.total, input.dependentes_irrf ?? 0);
  if (irrfResult.irrf > 0) {
    linhas.push({
      codigo: 'IRRF_RESCISAO',
      descricao: 'IRRF s/ Rescisão',
      referencia: `${irrfResult.aliquota}%`,
      tipo: 'desconto',
      valor: irrfResult.irrf,
      base_legal: 'Lei 7.713/88',
    });
  }

  // ── 8. Descontos diversos ──
  if (input.descontos_diversos && input.descontos_diversos > 0) {
    linhas.push({
      codigo: 'DESCONTOS_DIVERSOS',
      descricao: 'Descontos Diversos (adiantamentos, empréstimos)',
      referencia: null,
      tipo: 'desconto',
      valor: input.descontos_diversos,
      base_legal: 'CLT Art. 462',
    });
  }

  // ── 9. Aviso prévio desconto (pedido de demissão sem cumprimento) ──
  if (
    isPedidoDemissao &&
    input.aviso_previo_type === 'indenizado'
  ) {
    const descontoAviso = r(input.salario_base);
    linhas.push({
      codigo: 'AVISO_PREVIO_DESC',
      descricao: 'Desconto Aviso Prévio não cumprido',
      referencia: '30 dias',
      tipo: 'desconto',
      valor: descontoAviso,
      base_legal: 'CLT Art. 487, §2º',
    });
  }

  // ── Final totals ──
  const finalProventos = r(linhas.filter(l => l.tipo === 'provento').reduce((s, l) => s + l.valor, 0));
  const finalDescontos = r(linhas.filter(l => l.tipo === 'desconto').reduce((s, l) => s + l.valor, 0));
  const valorLiquido = r(finalProventos - finalDescontos);

  // ── 10. FGTS ──
  const fgtsMes = input.fgts_mes_rescisao ?? r(totalProventos * 0.08);
  let multaFgtsPct = 0;
  let multaFgts = 0;
  const saldoFgtsTotal = r(input.saldo_fgts + fgtsMes);

  if (!isJustaCausa && !isPedidoDemissao) {
    if (isAcordoMutuo) {
      // Acordo mútuo: multa de 20%
      multaFgtsPct = 20;
      multaFgts = r(saldoFgtsTotal * 0.20);
    } else {
      // Sem justa causa / término contrato: multa de 40%
      multaFgtsPct = 40;
      multaFgts = r(saldoFgtsTotal * 0.40);
    }
  }

  const totalFgtsReceber = r(saldoFgtsTotal + multaFgts);

  return {
    is_simulacao: true,
    disclaimer: 'SIMULAÇÃO — valores estimados para análise. NÃO substitui homologação oficial.',
    tipo_rescisao: type,
    data_admissao: input.data_admissao,
    data_desligamento: input.data_desligamento,
    linhas,
    total_proventos: finalProventos,
    total_descontos: finalDescontos,
    valor_liquido: valorLiquido,
    saldo_fgts: saldoFgtsTotal,
    multa_fgts: multaFgts,
    multa_fgts_percentual: multaFgtsPct,
    fgts_mes_rescisao: fgtsMes,
    total_fgts_a_receber: totalFgtsReceber,
    inss_desconto: inssResult.total,
    irrf_desconto: irrfResult.irrf,
    calculated_at: new Date().toISOString(),
  };
}

// ── Helpers ──

/**
 * Calculate aviso prévio days based on tenure (CLT Art. 487, §1º + Lei 12.506/2011).
 * Minimum 30 days + 3 days per year of service, max 90 days.
 */
export function calculateAvisoPrevioDays(dataAdmissao: string, dataDesligamento: string): number {
  const admissao = new Date(dataAdmissao);
  const desligamento = new Date(dataDesligamento);
  const diffMs = desligamento.getTime() - admissao.getTime();
  const anosCompletos = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
  return Math.min(90, 30 + anosCompletos * 3);
}

/**
 * Calculate proportional months for férias/13º.
 * A month counts if 15+ days were worked.
 */
export function calculateProportionalMonths(dataInicio: string, dataFim: string): number {
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);

  let months = (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth());
  const remainingDays = fim.getDate() - inicio.getDate();
  if (remainingDays >= 15) months += 1;

  return Math.min(12, Math.max(0, months));
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
