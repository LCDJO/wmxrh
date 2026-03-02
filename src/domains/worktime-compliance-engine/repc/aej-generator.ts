/**
 * AEJGenerator — Gera Atestado de Entrega ao Julgamento
 * conforme Portaria 671/2021 Art. 85-88.
 */

import type { AEJFile, AEJJornada } from './types';
import type { WorkTimeLedgerEntry } from '../types';

export class AEJGenerator {
  generate(
    cnpj_cpf: string,
    razao_social: string,
    periodStart: string,
    periodEnd: string,
    entries: WorkTimeLedgerEntry[],
    generatedBy: string,
  ): AEJFile {
    // Group entries by employee + date
    const grouped = new Map<string, WorkTimeLedgerEntry[]>();
    for (const e of entries) {
      const date = new Date(e.recorded_at).toISOString().slice(0, 10);
      const key = `${e.employee_pis ?? e.employee_id}::${date}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    }

    const jornadas: AEJJornada[] = [];
    for (const [, dayEntries] of grouped) {
      const sorted = dayEntries.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
      const first = sorted[0];
      const d = new Date(first.recorded_at);

      const marcacoes = sorted.map(e => {
        const dt = new Date(e.recorded_at);
        return `${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}`;
      });

      // Basic hours calculation
      const clockIns = sorted.filter(e => e.event_type === 'clock_in');
      const clockOuts = sorted.filter(e => e.event_type === 'clock_out');
      let totalMinutes = 0;
      for (let i = 0; i < Math.min(clockIns.length, clockOuts.length); i++) {
        totalMinutes += (new Date(clockOuts[i].recorded_at).getTime() - new Date(clockIns[i].recorded_at).getTime()) / 60000;
      }

      const hours = Math.floor(totalMinutes / 60);
      const mins = Math.round(totalMinutes % 60);
      const extras = Math.max(0, totalMinutes - 480); // > 8h
      const isNocturnal = d.getHours() >= 22 || d.getHours() < 5;

      jornadas.push({
        pis: first.employee_pis ?? '',
        cpf: first.employee_cpf_masked ?? '',
        nome: first.employee_name ?? '',
        data: `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`,
        marcacoes,
        horas_trabalhadas: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
        horas_extras: `${String(Math.floor(extras / 60)).padStart(2, '0')}:${String(Math.round(extras % 60)).padStart(2, '0')}`,
        horas_noturnas: isNocturnal ? `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}` : '00:00',
        faltas_atrasos: '00:00',
        observacoes: '',
      });
    }

    const content = JSON.stringify(jornadas);
    let hash = 0x811c9dc5;
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }

    return {
      cnpj_cpf,
      razao_social,
      periodo_inicio: periodStart,
      periodo_fim: periodEnd,
      jornadas,
      generated_at: new Date().toISOString(),
      generated_by: generatedBy,
      content_hash: hash.toString(16).padStart(8, '0'),
    };
  }

  validate(aej: AEJFile): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!aej.cnpj_cpf) errors.push('AEJ-001: CNPJ/CPF ausente');
    if (aej.jornadas.length === 0) errors.push('AEJ-002: Nenhuma jornada no período');
    for (const j of aej.jornadas) {
      if (!j.pis || j.pis.length !== 11) errors.push(`AEJ-003: PIS inválido para ${j.nome}`);
      if (j.marcacoes.length === 0) errors.push(`AEJ-004: Sem marcações para ${j.nome} em ${j.data}`);
    }
    return { valid: errors.length === 0, errors };
  }

  toText(aej: AEJFile): string {
    const lines: string[] = [];
    lines.push(`ATESTADO DE ENTREGA AO JULGAMENTO`);
    lines.push(`Empregador: ${aej.razao_social} (${aej.cnpj_cpf})`);
    lines.push(`Período: ${aej.periodo_inicio} a ${aej.periodo_fim}`);
    lines.push(`Gerado em: ${aej.generated_at}`);
    lines.push('');
    lines.push('PIS         | CPF         | Nome                | Data     | Marcações        | Trabalhadas | Extras');
    lines.push('-'.repeat(120));
    for (const j of aej.jornadas) {
      lines.push([
        j.pis.padEnd(11), '|',
        j.cpf.padEnd(13), '|',
        j.nome.substring(0, 19).padEnd(21), '|',
        j.data.padEnd(10), '|',
        j.marcacoes.join(' ').padEnd(18), '|',
        j.horas_trabalhadas.padEnd(13), '|',
        j.horas_extras,
      ].join(' '));
    }
    lines.push('');
    lines.push(`Hash: ${aej.content_hash}`);
    return lines.join('\n');
  }
}
