/**
 * AEJGenerator — Gera Arquivo Espelho de Jornada
 * conforme Portaria 671/2021 Art. 85-88.
 *
 * Inclui: entradas, saídas, intervalos, horas extras, banco de horas.
 * Exporta em formato oficial (texto) e PDF.
 */

import type { AEJFile, AEJJornada, AEJIntervalo, AEJEspelhoMensal } from './types';
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
      jornadas.push(this.buildJornada(dayEntries));
    }

    // Build monthly summaries
    const espelhos_mensais = this.buildEspelhosMensais(jornadas);

    const content = JSON.stringify(jornadas);
    const content_hash = this.fnv1a(content);

    return {
      cnpj_cpf,
      razao_social,
      periodo_inicio: periodStart,
      periodo_fim: periodEnd,
      jornadas,
      espelhos_mensais,
      generated_at: new Date().toISOString(),
      generated_by: generatedBy,
      content_hash,
    };
  }

  private buildJornada(dayEntries: WorkTimeLedgerEntry[]): AEJJornada {
    const sorted = dayEntries.sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
    const first = sorted[0];
    const d = new Date(first.recorded_at);

    const marcacoes = sorted.map(e => this.fmtTime(new Date(e.recorded_at)));

    const clockIns = sorted.filter(e => e.event_type === 'clock_in');
    const clockOuts = sorted.filter(e => e.event_type === 'clock_out');
    const breakStarts = sorted.filter(e => e.event_type === 'break_start');
    const breakEnds = sorted.filter(e => e.event_type === 'break_end');

    const entradas = clockIns.map(e => this.fmtTime(new Date(e.recorded_at)));
    const saidas = clockOuts.map(e => this.fmtTime(new Date(e.recorded_at)));

    // Build intervals
    const intervalos: AEJIntervalo[] = [];
    for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
      const inicio = new Date(breakStarts[i].recorded_at);
      const fim = new Date(breakEnds[i].recorded_at);
      const duracao = (fim.getTime() - inicio.getTime()) / 60000;
      intervalos.push({
        inicio: this.fmtTime(inicio),
        fim: this.fmtTime(fim),
        duracao_minutos: Math.round(duracao),
        tipo: 'intrajornada',
        conforme_clt: duracao >= 60, // CLT Art. 71: >= 1h para jornada > 6h
      });
    }

    // If no explicit breaks but pairs of out/in exist mid-day, infer intervals
    if (intervalos.length === 0 && clockOuts.length > 1 && clockIns.length > 1) {
      for (let i = 0; i < clockOuts.length - 1; i++) {
        const outTime = new Date(clockOuts[i].recorded_at);
        const nextInTime = new Date(clockIns[i + 1].recorded_at);
        if (nextInTime > outTime) {
          const duracao = (nextInTime.getTime() - outTime.getTime()) / 60000;
          intervalos.push({
            inicio: this.fmtTime(outTime),
            fim: this.fmtTime(nextInTime),
            duracao_minutos: Math.round(duracao),
            tipo: 'intrajornada',
            conforme_clt: duracao >= 60,
          });
        }
      }
    }

    // Calculate total worked minutes (excluding breaks)
    let totalWorkedMs = 0;
    for (let i = 0; i < Math.min(clockIns.length, clockOuts.length); i++) {
      totalWorkedMs += new Date(clockOuts[i].recorded_at).getTime() - new Date(clockIns[i].recorded_at).getTime();
    }
    // Subtract explicit breaks
    const breakMs = intervalos.reduce((acc, iv) => acc + iv.duracao_minutos * 60000, 0);
    const netWorkedMs = Math.max(0, totalWorkedMs - breakMs);
    const totalMinutes = netWorkedMs / 60000;

    const extras = Math.max(0, totalMinutes - 480); // > 8h = extras

    // Nocturnal hours (22:00-05:00)
    let nocturnalMinutes = 0;
    for (let i = 0; i < Math.min(clockIns.length, clockOuts.length); i++) {
      nocturnalMinutes += this.calcNocturnalMinutes(
        new Date(clockIns[i].recorded_at),
        new Date(clockOuts[i].recorded_at),
      );
    }

    // Bank hours: extras go to bank
    const bankMinutes = extras;

    return {
      pis: first.employee_pis ?? '',
      cpf: first.employee_cpf_masked ?? '',
      nome: first.employee_name ?? '',
      data: this.fmtDate(d),
      marcacoes,
      entradas,
      saidas,
      intervalos,
      horas_trabalhadas: this.minutesToHHMM(totalMinutes),
      horas_extras: this.minutesToHHMM(extras),
      horas_noturnas: this.minutesToHHMM(nocturnalMinutes),
      banco_horas_saldo: bankMinutes >= 0
        ? `+${this.minutesToHHMM(bankMinutes)}`
        : `-${this.minutesToHHMM(Math.abs(bankMinutes))}`,
      faltas_atrasos: '00:00',
      observacoes: intervalos.some(iv => !iv.conforme_clt)
        ? 'ALERTA: Intervalo intrajornada inferior a 1h (CLT Art. 71)'
        : '',
    };
  }

  private buildEspelhosMensais(jornadas: AEJJornada[]): AEJEspelhoMensal[] {
    // Group by employee+month
    const byEmpMonth = new Map<string, AEJJornada[]>();
    for (const j of jornadas) {
      const month = j.data.slice(2); // MMAAAA from DDMMAAAA
      const key = `${j.pis}::${month}`;
      if (!byEmpMonth.has(key)) byEmpMonth.set(key, []);
      byEmpMonth.get(key)!.push(j);
    }

    const espelhos: AEJEspelhoMensal[] = [];
    for (const [key, dias] of byEmpMonth) {
      const [pis, competencia] = key.split('::');
      const first = dias[0];

      const sumMinutes = (field: 'horas_trabalhadas' | 'horas_extras' | 'horas_noturnas' | 'faltas_atrasos') =>
        dias.reduce((acc, d) => acc + this.hhmmToMinutes(d[field]), 0);

      const bankTotal = dias.reduce((acc, d) => {
        const sign = d.banco_horas_saldo.startsWith('-') ? -1 : 1;
        return acc + sign * this.hhmmToMinutes(d.banco_horas_saldo.replace(/^[+-]/, ''));
      }, 0);

      espelhos.push({
        pis,
        cpf: first.cpf,
        nome: first.nome,
        competencia,
        dias,
        total_horas_trabalhadas: this.minutesToHHMM(sumMinutes('horas_trabalhadas')),
        total_horas_extras: this.minutesToHHMM(sumMinutes('horas_extras')),
        total_horas_noturnas: this.minutesToHHMM(sumMinutes('horas_noturnas')),
        total_banco_horas: bankTotal >= 0
          ? `+${this.minutesToHHMM(bankTotal)}`
          : `-${this.minutesToHHMM(Math.abs(bankTotal))}`,
        total_faltas_atrasos: this.minutesToHHMM(sumMinutes('faltas_atrasos')),
      });
    }

    return espelhos;
  }

  validate(aej: AEJFile): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!aej.cnpj_cpf) errors.push('AEJ-001: CNPJ/CPF ausente');
    if (aej.jornadas.length === 0) errors.push('AEJ-002: Nenhuma jornada no período');
    for (const j of aej.jornadas) {
      if (!j.pis || j.pis.length !== 11) errors.push(`AEJ-003: PIS inválido para ${j.nome}`);
      if (j.marcacoes.length === 0) errors.push(`AEJ-004: Sem marcações para ${j.nome} em ${j.data}`);
      if (j.entradas.length === 0) errors.push(`AEJ-005: Sem entradas para ${j.nome} em ${j.data}`);
      for (const iv of j.intervalos) {
        if (!iv.conforme_clt) {
          errors.push(`AEJ-006: Intervalo não conforme CLT Art.71 para ${j.nome} em ${j.data} (${iv.duracao_minutos}min)`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /** Formato oficial texto para fiscalização */
  toText(aej: AEJFile): string {
    const lines: string[] = [];
    lines.push('═'.repeat(120));
    lines.push('ARQUIVO ESPELHO DE JORNADA — AEJ');
    lines.push(`Portaria MTP 671/2021 · Art. 85-88`);
    lines.push('═'.repeat(120));
    lines.push(`Empregador: ${aej.razao_social} (${aej.cnpj_cpf})`);
    lines.push(`Período: ${aej.periodo_inicio} a ${aej.periodo_fim}`);
    lines.push(`Gerado em: ${aej.generated_at}`);
    lines.push('');

    for (const esp of aej.espelhos_mensais) {
      lines.push('─'.repeat(120));
      lines.push(`EMPREGADO: ${esp.nome} | PIS: ${esp.pis} | CPF: ${esp.cpf} | Competência: ${esp.competencia}`);
      lines.push('─'.repeat(120));
      lines.push(
        'Data     | Entradas     | Saídas       | Intervalos        | Trabalhadas | Extras | Noturnas | Banco  | Obs',
      );
      lines.push('-'.repeat(120));

      for (const j of esp.dias) {
        const ivStr = j.intervalos.map(iv => `${iv.inicio}-${iv.fim}`).join(', ') || '—';
        lines.push([
          j.data.padEnd(10),
          j.entradas.join(' ').padEnd(14),
          j.saidas.join(' ').padEnd(14),
          ivStr.substring(0, 19).padEnd(19),
          j.horas_trabalhadas.padEnd(13),
          j.horas_extras.padEnd(8),
          j.horas_noturnas.padEnd(10),
          j.banco_horas_saldo.padEnd(8),
          j.observacoes.substring(0, 30),
        ].join('| '));
      }

      lines.push('');
      lines.push(`  TOTAIS: Trabalhadas=${esp.total_horas_trabalhadas} | Extras=${esp.total_horas_extras} | Noturnas=${esp.total_horas_noturnas} | Banco=${esp.total_banco_horas} | Faltas=${esp.total_faltas_atrasos}`);
      lines.push('');
    }

    lines.push('═'.repeat(120));
    lines.push(`Hash de integridade: ${aej.content_hash}`);
    return lines.join('\n');
  }

  /** Gera PDF do espelho via jsPDF (client-side) */
  async toPdf(aej: AEJFile): Promise<Blob> {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF('l', 'mm', 'a4'); // landscape for wider tables
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    let y = margin;

    const addText = (text: string, size = 8, bold = false) => {
      if (y > pageH - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.setFontSize(size);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.text(text, margin, y);
      y += size * 0.5;
    };

    // Header
    addText('ARQUIVO ESPELHO DE JORNADA — AEJ', 14, true);
    addText('Portaria MTP 671/2021 · Art. 85-88', 9);
    addText(`Empregador: ${aej.razao_social} (${aej.cnpj_cpf})`, 9);
    addText(`Período: ${aej.periodo_inicio} a ${aej.periodo_fim}`, 9);
    addText(`Gerado em: ${aej.generated_at}`, 8);
    y += 4;

    for (const esp of aej.espelhos_mensais) {
      addText(`EMPREGADO: ${esp.nome} | PIS: ${esp.pis} | Competência: ${esp.competencia}`, 10, true);
      y += 2;

      // Table header
      const cols = ['Data', 'Entradas', 'Saídas', 'Intervalos', 'Trab.', 'Extras', 'Noturnas', 'Banco'];
      const colX = [margin, 30, 55, 80, 120, 148, 172, 198];

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      cols.forEach((c, i) => pdf.text(c, colX[i], y));
      y += 3;
      pdf.setDrawColor(150);
      pdf.line(margin, y, pageW - margin, y);
      y += 2;

      pdf.setFont('helvetica', 'normal');
      for (const j of esp.dias) {
        if (y > pageH - margin - 5) {
          pdf.addPage();
          y = margin;
        }
        const ivStr = j.intervalos.map(iv => `${iv.inicio}-${iv.fim}`).join(', ') || '—';
        const values = [j.data, j.entradas.join(' '), j.saidas.join(' '), ivStr, j.horas_trabalhadas, j.horas_extras, j.horas_noturnas, j.banco_horas_saldo];
        values.forEach((v, i) => pdf.text(v.substring(0, 20), colX[i], y));
        y += 3;
      }

      y += 2;
      addText(`TOTAIS: Trab=${esp.total_horas_trabalhadas} | Extras=${esp.total_horas_extras} | Noturnas=${esp.total_horas_noturnas} | Banco=${esp.total_banco_horas}`, 8, true);
      y += 4;
    }

    addText(`Hash: ${aej.content_hash}`, 7);

    return pdf.output('blob');
  }

  // ── Helpers ──

  private calcNocturnalMinutes(start: Date, end: Date): number {
    let minutes = 0;
    const current = new Date(start);
    while (current < end) {
      const h = current.getHours();
      if (h >= 22 || h < 5) minutes++;
      current.setMinutes(current.getMinutes() + 1);
    }
    return minutes;
  }

  private fmtDate(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
  }

  private fmtTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private minutesToHHMM(m: number): string {
    const h = Math.floor(Math.abs(m) / 60);
    const mm = Math.round(Math.abs(m) % 60);
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  private hhmmToMinutes(s: string): number {
    const clean = s.replace(/^[+-]/, '');
    const [h, m] = clean.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  private fnv1a(str: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }
}
