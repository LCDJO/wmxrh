/**
 * WorkTime Compliance Engine — TimeExportService
 *
 * Exportações em formato oficial:
 *   - AFD  (Arquivo Fonte de Dados)
 *   - AFDT (Arquivo Fonte de Dados Tratados)
 *   - ACJEF (Arquivo de Controle de Jornada para Efeitos Fiscais)
 *   - AEJ  (Arquivo Eletrônico de Jornada)
 *   - Espelho de Ponto
 *   - CSV / PDF
 *
 * Portaria 671/2021 Art. 80–84
 * Retenção mínima: 5 anos (CLT Art. 11)
 */

import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import type { WorkTimeExport, ExportType, TimeExportServiceAPI, WorkTimeLedgerEntry } from './types';

const EVENT_TYPE_CODE: Record<string, string> = {
  clock_in: '1',
  clock_out: '2',
  break_start: '3',
  break_end: '4',
};

const EVENT_LABEL: Record<string, string> = {
  clock_in: 'Entrada',
  clock_out: 'Saída',
  break_start: 'Início Intervalo',
  break_end: 'Fim Intervalo',
};

// ── Helpers ──

interface DaySummary {
  date: string;
  employeeId: string;
  employeeName: string;
  cpf: string;
  pis: string;
  clockIn?: string;
  breakStart?: string;
  breakEnd?: string;
  clockOut?: string;
  workedMinutes: number;
  normalMinutes: number;
  extraMinutes: number;
  entries: WorkTimeLedgerEntry[];
}

function groupByEmployeeDate(entries: WorkTimeLedgerEntry[]): DaySummary[] {
  const map = new Map<string, WorkTimeLedgerEntry[]>();
  for (const e of entries) {
    const key = `${e.employee_id}|${e.recorded_at.slice(0, 10)}`;
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }

  const summaries: DaySummary[] = [];
  for (const [, dayEntries] of map) {
    const clockIn = dayEntries.find(e => e.event_type === 'clock_in');
    const clockOut = dayEntries.find(e => e.event_type === 'clock_out');
    const breakStart = dayEntries.find(e => e.event_type === 'break_start');
    const breakEnd = dayEntries.find(e => e.event_type === 'break_end');

    const first = dayEntries[0];
    const fmt = (e?: WorkTimeLedgerEntry) => e ? new Date(e.recorded_at).toISOString().slice(11, 16) : '';

    let workedMin = 0;
    let breakMin = 0;
    if (clockIn && clockOut) {
      const total = (new Date(clockOut.recorded_at).getTime() - new Date(clockIn.recorded_at).getTime()) / 60000;
      breakMin = (breakStart && breakEnd)
        ? (new Date(breakEnd.recorded_at).getTime() - new Date(breakStart.recorded_at).getTime()) / 60000
        : 0;
      workedMin = Math.max(0, total - breakMin);
    }

    summaries.push({
      date: first.recorded_at.slice(0, 10),
      employeeId: first.employee_id,
      employeeName: first.employee_name ?? first.employee_id,
      cpf: first.employee_cpf_masked ?? '',
      pis: first.employee_pis ?? '',
      clockIn: fmt(clockIn),
      breakStart: fmt(breakStart),
      breakEnd: fmt(breakEnd),
      clockOut: fmt(clockOut),
      workedMinutes: workedMin,
      normalMinutes: Math.min(workedMin, 480),
      extraMinutes: Math.max(0, workedMin - 480),
      entries: dayEntries,
    });
  }

  return summaries.sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));
}

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export class TimeExportService implements TimeExportServiceAPI {

  async requestExport(
    tenantId: string,
    exportType: ExportType,
    periodStart: string,
    periodEnd: string,
    employeeIds?: string[],
    requestedBy?: string,
  ): Promise<WorkTimeExport> {
    // Fetch records
    let query = supabase
      .from('worktime_ledger' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', `${periodStart}T00:00:00Z`)
      .lte('recorded_at', `${periodEnd}T23:59:59Z`)
      .order('recorded_at', { ascending: true });

    if (employeeIds && employeeIds.length > 0) {
      query = query.in('employee_id', employeeIds);
    }

    const { data, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    const entries = (data ?? []) as unknown as WorkTimeLedgerEntry[];

    // Generate file content based on export type
    let fileContent: string;
    let mimeType = 'text/plain';

    switch (exportType) {
      case 'AFD':
        fileContent = this.generateAFD(entries, tenantId);
        break;
      case 'AFDT':
        fileContent = this.generateAFDT(entries, tenantId);
        break;
      case 'ACJEF':
        fileContent = this.generateACJEF(entries, tenantId);
        break;
      case 'AEJ':
        fileContent = this.generateAEJ(entries, tenantId);
        break;
      case 'csv':
        fileContent = this.generateCSV(entries);
        mimeType = 'text/csv;charset=utf-8;';
        break;
      case 'espelho_ponto':
        fileContent = this.generateEspelhoPonto(entries, periodStart, periodEnd);
        break;
      case 'pdf': {
        const pdfBase64 = this.generatePDF(entries, periodStart, periodEnd, tenantId);
        fileContent = pdfBase64;
        mimeType = 'application/pdf';
        break;
      }
      default:
        fileContent = this.generateCSV(entries);
        mimeType = 'text/csv;charset=utf-8;';
    }

    // 5-year retention
    const retentionUntil = new Date();
    retentionUntil.setFullYear(retentionUntil.getFullYear() + 5);

    const { data: exportData, error } = await supabase
      .from('worktime_exports' as any)
      .insert({
        tenant_id: tenantId,
        export_type: exportType,
        period_start: periodStart,
        period_end: periodEnd,
        employee_ids: employeeIds ?? null,
        status: 'completed',
        record_count: entries.length,
        requested_by: requestedBy ?? null,
        completed_at: new Date().toISOString(),
        file_content: fileContent,
        mime_type: mimeType,
        legal_basis: 'Portaria 671/2021 Art. 80-84',
        retention_until: retentionUntil.toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`[TimeExportService] requestExport failed: ${error.message}`);

    // Audit trail
    await supabase.from('worktime_audit_trail' as any).insert({
      tenant_id: tenantId,
      action: 'export_generated',
      entity_type: 'worktime_export',
      entity_id: (exportData as any)?.id,
      details: {
        export_type: exportType,
        period: `${periodStart} → ${periodEnd}`,
        record_count: entries.length,
        retention_until: retentionUntil.toISOString(),
      },
    });

    return exportData as unknown as WorkTimeExport;
  }

  async getExports(tenantId: string, limit = 50): Promise<WorkTimeExport[]> {
    const { data, error } = await supabase
      .from('worktime_exports' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as unknown as WorkTimeExport[];
  }

  /**
   * Download helper — triggers browser download from stored export
   */
  downloadExport(exp: WorkTimeExport & { file_content?: string; mime_type?: string }): void {
    if (!exp.file_content) throw new Error('Sem conteúdo disponível para download.');

    const isPdf = exp.export_type === 'pdf' || exp.mime_type === 'application/pdf';

    if (isPdf) {
      // file_content is base64 data URI
      const link = document.createElement('a');
      link.href = exp.file_content;
      link.download = `ponto_${exp.export_type}_${exp.period_start}_${exp.period_end}.pdf`;
      link.click();
    } else {
      const blob = new Blob(['\uFEFF' + exp.file_content], {
        type: exp.mime_type || 'text/plain;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = exp.export_type === 'csv' ? 'csv' : 'txt';
      a.download = `ponto_${exp.export_type}_${exp.period_start}_${exp.period_end}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // AFD — Arquivo Fonte de Dados (Portaria 671/2021 Art. 80)
  // ══════════════════════════════════════════════════════════════════

  private generateAFD(entries: WorkTimeLedgerEntry[], _tenantId: string): string {
    const header = `00000000001|AFD|${new Date().toISOString().slice(0, 10)}|WORKTIME_COMPLIANCE_ENGINE|v1.0`;
    const lines = [header];
    let nsr = 1;

    for (const entry of entries) {
      const dt = new Date(entry.recorded_at);
      const dateStr = dt.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = dt.toISOString().slice(11, 16).replace(':', '');
      const pis = entry.employee_pis ?? '00000000000';
      const typeCode = EVENT_TYPE_CODE[entry.event_type] ?? '0';

      lines.push(
        `${String(nsr).padStart(9, '0')}|3|${dateStr}${timeStr}|${pis}|${typeCode}|${entry.integrity_hash?.slice(0, 16) ?? ''}`
      );
      nsr++;
    }

    lines.push(`${String(nsr).padStart(9, '0')}|9|${entries.length}`);
    return lines.join('\n');
  }

  // ══════════════════════════════════════════════════════════════════
  // AFDT — Arquivo Fonte de Dados Tratados (Art. 81)
  // ══════════════════════════════════════════════════════════════════

  private generateAFDT(entries: WorkTimeLedgerEntry[], _tenantId: string): string {
    const header = `NSR;TIPO;DATA;HORA;PIS;NOME;CPF;TIPO_EVENTO;LATITUDE;LONGITUDE;HASH`;
    const lines = [header];
    let nsr = 1;

    for (const entry of entries) {
      const dt = new Date(entry.recorded_at);
      lines.push([
        String(nsr).padStart(9, '0'), '3',
        dt.toISOString().slice(0, 10), dt.toISOString().slice(11, 19),
        entry.employee_pis ?? '', entry.employee_name ?? '',
        entry.employee_cpf_masked ?? '', entry.event_type,
        entry.latitude?.toFixed(6) ?? '', entry.longitude?.toFixed(6) ?? '',
        entry.integrity_hash ?? '',
      ].join(';'));
      nsr++;
    }

    return lines.join('\n');
  }

  // ══════════════════════════════════════════════════════════════════
  // ACJEF — Controle de Jornada para Efeitos Fiscais (Art. 82)
  // ══════════════════════════════════════════════════════════════════

  private generateACJEF(entries: WorkTimeLedgerEntry[], _tenantId: string): string {
    const header = `NSR;DATA;PIS;NOME;ENTRADA;SAIDA_INTERVALO;RETORNO_INTERVALO;SAIDA;HORAS_NORMAIS;HORAS_EXTRAS`;
    const lines = [header];

    const summaries = groupByEmployeeDate(entries);
    let nsr = 1;

    for (const s of summaries) {
      lines.push([
        String(nsr).padStart(9, '0'), s.date,
        s.pis, s.employeeName,
        s.clockIn ?? '', s.breakStart ?? '', s.breakEnd ?? '', s.clockOut ?? '',
        fmtMinutes(s.normalMinutes), fmtMinutes(s.extraMinutes),
      ].join(';'));
      nsr++;
    }

    return lines.join('\n');
  }

  // ══════════════════════════════════════════════════════════════════
  // AEJ — Arquivo Eletrônico de Jornada (Art. 84)
  // ══════════════════════════════════════════════════════════════════

  private generateAEJ(entries: WorkTimeLedgerEntry[], _tenantId: string): string {
    const header = `TIPO;NSR;DATA;HORA;PIS;NOME;CPF;EVENTO;FONTE;DISPOSITIVO;LATITUDE;LONGITUDE;HASH;ASSINATURA`;
    const lines = [header];
    let nsr = 1;

    for (const entry of entries) {
      const dt = new Date(entry.recorded_at);
      lines.push([
        '3', String(nsr).padStart(9, '0'),
        dt.toISOString().slice(0, 10), dt.toISOString().slice(11, 19),
        entry.employee_pis ?? '', entry.employee_name ?? '',
        entry.employee_cpf_masked ?? '', entry.event_type,
        entry.source, entry.device_fingerprint ?? '',
        entry.latitude?.toFixed(6) ?? '', entry.longitude?.toFixed(6) ?? '',
        entry.integrity_hash ?? '',
        entry.server_signature ? 'HMAC-SHA256' : 'N/A',
      ].join(';'));
      nsr++;
    }

    return lines.join('\n');
  }

  // ══════════════════════════════════════════════════════════════════
  // Espelho de Ponto
  // ══════════════════════════════════════════════════════════════════

  private generateEspelhoPonto(entries: WorkTimeLedgerEntry[], periodStart: string, periodEnd: string): string {
    const summaries = groupByEmployeeDate(entries);

    // Group by employee
    const byEmployee = new Map<string, DaySummary[]>();
    for (const s of summaries) {
      const list = byEmployee.get(s.employeeId) ?? [];
      list.push(s);
      byEmployee.set(s.employeeId, list);
    }

    const blocks: string[] = [];
    blocks.push(`ESPELHO DE PONTO ELETRÔNICO`);
    blocks.push(`Período: ${periodStart} a ${periodEnd}`);
    blocks.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    blocks.push(`${'═'.repeat(100)}`);

    for (const [, days] of byEmployee) {
      const emp = days[0];
      blocks.push('');
      blocks.push(`Colaborador: ${emp.employeeName}`);
      blocks.push(`CPF: ${emp.cpf}  |  PIS: ${emp.pis}`);
      blocks.push(`${'─'.repeat(100)}`);
      blocks.push(
        'Data'.padEnd(12) +
        'Entrada'.padEnd(10) +
        'Saída Int.'.padEnd(12) +
        'Ret. Int.'.padEnd(12) +
        'Saída'.padEnd(10) +
        'Trabalhado'.padEnd(12) +
        'Normal'.padEnd(10) +
        'Extra'.padEnd(10)
      );
      blocks.push(`${'─'.repeat(100)}`);

      let totalWorked = 0;
      let totalNormal = 0;
      let totalExtra = 0;

      for (const d of days) {
        totalWorked += d.workedMinutes;
        totalNormal += d.normalMinutes;
        totalExtra += d.extraMinutes;

        blocks.push(
          d.date.padEnd(12) +
          (d.clockIn ?? '--:--').padEnd(10) +
          (d.breakStart ?? '--:--').padEnd(12) +
          (d.breakEnd ?? '--:--').padEnd(12) +
          (d.clockOut ?? '--:--').padEnd(10) +
          fmtMinutes(d.workedMinutes).padEnd(12) +
          fmtMinutes(d.normalMinutes).padEnd(10) +
          fmtMinutes(d.extraMinutes).padEnd(10)
        );
      }

      blocks.push(`${'─'.repeat(100)}`);
      blocks.push(
        'TOTAL'.padEnd(56) +
        fmtMinutes(totalWorked).padEnd(12) +
        fmtMinutes(totalNormal).padEnd(10) +
        fmtMinutes(totalExtra).padEnd(10)
      );
      blocks.push(`${'═'.repeat(100)}`);
    }

    blocks.push('');
    blocks.push('Declaro que os registros acima estão corretos.');
    blocks.push('');
    blocks.push('______________________________          ______________________________');
    blocks.push('    Assinatura do Empregado                  Assinatura do Empregador  ');
    blocks.push('');
    blocks.push(`Documento gerado eletronicamente — Retenção: 5 anos (CLT Art. 11)`);

    return blocks.join('\n');
  }

  // ══════════════════════════════════════════════════════════════════
  // CSV genérico
  // ══════════════════════════════════════════════════════════════════

  private generateCSV(entries: WorkTimeLedgerEntry[]): string {
    const header = 'id;employee_id;employee_name;cpf;pis;event_type;recorded_at;source;latitude;longitude;device;status;integrity_hash';
    const lines = [header];

    for (const e of entries) {
      lines.push([
        e.id, e.employee_id, e.employee_name ?? '', e.employee_cpf_masked ?? '',
        e.employee_pis ?? '', e.event_type, e.recorded_at, e.source,
        e.latitude?.toFixed(6) ?? '', e.longitude?.toFixed(6) ?? '',
        e.device_fingerprint ?? '', e.status, e.integrity_hash,
      ].join(';'));
    }

    return lines.join('\n');
  }

  // ══════════════════════════════════════════════════════════════════
  // PDF — Espelho de Ponto em PDF (jsPDF)
  // ══════════════════════════════════════════════════════════════════

  private generatePDF(entries: WorkTimeLedgerEntry[], periodStart: string, periodEnd: string, _tenantId: string): string {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    const addPageIfNeeded = (needed: number) => {
      if (y + needed > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
    };

    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ESPELHO DE PONTO ELETRÔNICO', pageW / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${periodStart} a ${periodEnd}  |  Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageW / 2, y, { align: 'center' });
    y += 4;
    doc.text('Portaria 671/2021 — CLT Art. 74 — Retenção: 5 anos (Art. 11)', pageW / 2, y, { align: 'center' });
    y += 8;

    const summaries = groupByEmployeeDate(entries);
    const byEmployee = new Map<string, DaySummary[]>();
    for (const s of summaries) {
      const list = byEmployee.get(s.employeeId) ?? [];
      list.push(s);
      byEmployee.set(s.employeeId, list);
    }

    const cols = [
      { label: 'Data', x: margin, w: 28 },
      { label: 'Entrada', x: margin + 28, w: 22 },
      { label: 'Saída Int.', x: margin + 50, w: 22 },
      { label: 'Ret. Int.', x: margin + 72, w: 22 },
      { label: 'Saída', x: margin + 94, w: 22 },
      { label: 'Trabalhado', x: margin + 116, w: 26 },
      { label: 'Normal', x: margin + 142, w: 24 },
      { label: 'Extra', x: margin + 166, w: 24 },
      { label: 'Status', x: margin + 190, w: 24 },
    ];

    for (const [, days] of byEmployee) {
      const emp = days[0];
      addPageIfNeeded(30);

      // Employee header
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${emp.employeeName}`, margin, y);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`CPF: ${emp.cpf}  |  PIS: ${emp.pis}`, margin + 80, y);
      y += 5;

      // Table header
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 3, pageW - 2 * margin, 5, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      for (const col of cols) {
        doc.text(col.label, col.x + 1, y);
      }
      y += 5;

      doc.setFont('helvetica', 'normal');
      let totalWorked = 0, totalNormal = 0, totalExtra = 0;

      for (const d of days) {
        addPageIfNeeded(5);
        totalWorked += d.workedMinutes;
        totalNormal += d.normalMinutes;
        totalExtra += d.extraMinutes;

        const row = [
          d.date, d.clockIn ?? '--:--', d.breakStart ?? '--:--', d.breakEnd ?? '--:--',
          d.clockOut ?? '--:--', fmtMinutes(d.workedMinutes), fmtMinutes(d.normalMinutes),
          fmtMinutes(d.extraMinutes), d.entries[0].status,
        ];
        for (let i = 0; i < cols.length; i++) {
          doc.text(row[i], cols[i].x + 1, y);
        }
        y += 4;
      }

      // Totals
      addPageIfNeeded(8);
      doc.setFont('helvetica', 'bold');
      doc.line(margin, y - 1, pageW - margin, y - 1);
      doc.text('TOTAL', margin + 1, y + 2);
      doc.text(fmtMinutes(totalWorked), cols[5].x + 1, y + 2);
      doc.text(fmtMinutes(totalNormal), cols[6].x + 1, y + 2);
      doc.text(fmtMinutes(totalExtra), cols[7].x + 1, y + 2);
      y += 10;
    }

    // Signatures
    addPageIfNeeded(25);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Declaro que os registros acima estão corretos.', margin, y);
    y += 12;
    doc.line(margin, y, margin + 70, y);
    doc.line(pageW / 2 + 10, y, pageW / 2 + 80, y);
    y += 4;
    doc.text('Assinatura do Empregado', margin + 10, y);
    doc.text('Assinatura do Empregador', pageW / 2 + 20, y);
    y += 8;
    doc.setFontSize(7);
    doc.text('Documento gerado eletronicamente — Retenção: 5 anos (CLT Art. 11)', margin, y);

    // Add page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.text(`Página ${i} de ${pageCount}`, pageW - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }

    return doc.output('datauristring');
  }
}
