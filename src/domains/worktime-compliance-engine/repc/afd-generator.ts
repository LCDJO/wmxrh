/**
 * AFDGenerator — Gera Arquivo Fonte de Dados conforme Portaria 671/2021 Art. 81-84.
 *
 * Layout fixo posicional para fiscalização do MTE.
 */

import type {
  AFDFile, AFDHeader, AFDDetail, AFDAdjustment, AFDTrailer,
} from './types';
import type { WorkTimeLedgerEntry, LedgerAdjustment } from '../types';

export class AFDGenerator {
  /**
   * Gera AFD a partir de entries do ledger imutável.
   */
  generateFromEntries(
    header: Omit<AFDHeader, 'tipo_registro' | 'data_geracao' | 'hora_geracao'>,
    entries: WorkTimeLedgerEntry[],
    adjustments: LedgerAdjustment[],
  ): AFDFile {
    const now = new Date();
    const h: AFDHeader = {
      ...header,
      tipo_registro: '1',
      data_geracao: this.formatDate(now),
      hora_geracao: this.formatTime(now),
    };

    const details: AFDDetail[] = entries.map(e => ({
      tipo_registro: '2' as const,
      nsr: e.nsr_sequence ?? 0,
      data_marcacao: this.formatDate(new Date(e.recorded_at)),
      hora_marcacao: this.formatTime(new Date(e.recorded_at)),
      pis: e.employee_pis ?? '',
      cpf: e.employee_cpf_masked ?? '',
      nome_empregado: e.employee_name ?? '',
    }));

    const adjs: AFDAdjustment[] = adjustments.map(a => ({
      tipo_registro: '3' as const,
      nsr_original: 0,
      data_original: a.new_recorded_at ? this.formatDate(new Date(a.requested_at)) : '',
      hora_original: a.new_recorded_at ? this.formatTime(new Date(a.requested_at)) : '',
      data_nova: a.new_recorded_at ? this.formatDate(new Date(a.new_recorded_at)) : '',
      hora_nova: a.new_recorded_at ? this.formatTime(new Date(a.new_recorded_at)) : '',
      tipo_operacao: a.adjustment_type === 'addition' ? 'I' as const
        : a.adjustment_type === 'invalidation' ? 'E' as const : 'A' as const,
      motivo: a.reason,
      responsavel_cpf: a.requested_by ?? '',
      data_operacao: this.formatDate(new Date(a.requested_at)),
      hora_operacao: this.formatTime(new Date(a.requested_at)),
    }));

    const trailer: AFDTrailer = {
      tipo_registro: '9',
      total_registros_tipo_2: details.length,
      total_registros_tipo_3: adjs.length,
      total_geral: 1 + details.length + adjs.length + 1,
    };

    const text = this.toText({ header: h, details, adjustments: adjs, trailer, content_hash: '', generated_at: '' });
    const content_hash = this.computeHash(text);

    return {
      header: h,
      details,
      adjustments: adjs,
      trailer,
      content_hash,
      generated_at: now.toISOString(),
    };
  }

  validate(afd: AFDFile): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!afd.header.cnpj_cpf || afd.header.cnpj_cpf.length < 11) {
      errors.push('AFD-001: CNPJ/CPF do empregador inválido');
    }
    if (!afd.header.numero_registro_rep) {
      errors.push('AFD-002: Número de registro REP-C ausente');
    }
    if (afd.trailer.total_registros_tipo_2 !== afd.details.length) {
      errors.push('AFD-003: Totalizador tipo 2 diverge do número de registros');
    }
    if (afd.trailer.total_registros_tipo_3 !== afd.adjustments.length) {
      errors.push('AFD-004: Totalizador tipo 3 diverge do número de ajustes');
    }

    // Verify NSR sequencing
    for (let i = 1; i < afd.details.length; i++) {
      if (afd.details[i].nsr <= afd.details[i - 1].nsr) {
        errors.push(`AFD-005: NSR fora de sequência no registro ${i} (${afd.details[i].nsr} <= ${afd.details[i - 1].nsr})`);
      }
    }

    // PIS validation
    for (const d of afd.details) {
      if (!d.pis || d.pis.length !== 11) {
        errors.push(`AFD-006: PIS inválido para NSR ${d.nsr}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  toText(afd: AFDFile): string {
    const lines: string[] = [];
    const h = afd.header;

    // Header — tipo 1
    lines.push([
      h.tipo_registro,
      h.cnpj_cpf.padEnd(14, ' '),
      h.cei_caepf.padEnd(14, ' '),
      h.razao_social.substring(0, 150).padEnd(150, ' '),
      h.numero_registro_rep.padEnd(17, ' '),
      h.data_inicio, h.data_fim,
      h.data_geracao, h.hora_geracao,
    ].join(''));

    // Details — tipo 2
    for (const d of afd.details) {
      lines.push([
        d.tipo_registro,
        String(d.nsr).padStart(9, '0'),
        d.data_marcacao,
        d.hora_marcacao,
        d.pis.padEnd(11, ' '),
      ].join(''));
    }

    // Adjustments — tipo 3
    for (const a of afd.adjustments) {
      lines.push([
        a.tipo_registro,
        String(a.nsr_original).padStart(9, '0'),
        a.tipo_operacao,
        a.data_original, a.hora_original,
        a.data_nova, a.hora_nova,
        a.responsavel_cpf.padEnd(11, ' '),
        a.data_operacao, a.hora_operacao,
      ].join(''));
    }

    // Trailer — tipo 9
    const t = afd.trailer;
    lines.push([
      t.tipo_registro,
      String(t.total_registros_tipo_2).padStart(9, '0'),
      String(t.total_registros_tipo_3).padStart(9, '0'),
      String(t.total_geral).padStart(9, '0'),
    ].join(''));

    return lines.join('\n');
  }

  private formatDate(d: Date): string {
    return [
      String(d.getDate()).padStart(2, '0'),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getFullYear()),
    ].join('');
  }

  private formatTime(d: Date): string {
    return [
      String(d.getHours()).padStart(2, '0'),
      String(d.getMinutes()).padStart(2, '0'),
    ].join('');
  }

  private computeHash(text: string): string {
    // Simple FNV-1a for synchronous in-browser use
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }
}
