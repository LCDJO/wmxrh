/**
 * WorkTime Compliance Engine — TimeExportService
 *
 * Client-side: calls the unified `worktime-api` edge function for server-side
 * export generation (AFD/AFDT/ACJEF/AEJ/espelho_ponto/csv/pdf).
 *
 * PDF generation remains client-side (jsPDF) for immediate download.
 * Official formats are generated server-side for integrity/audit.
 *
 * Portaria 671/2021 Art. 80–84
 * Retenção mínima: 5 anos (CLT Art. 11)
 */

import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import type { WorkTimeExport, ExportType, TimeExportServiceAPI, WorkTimeLedgerEntry } from './types';

const FUNCTION_NAME = 'worktime-api';

const EVENT_LABEL: Record<string, string> = {
  clock_in: 'Entrada',
  clock_out: 'Saída',
  break_start: 'Início Intervalo',
  break_end: 'Fim Intervalo',
};

interface DaySummary {
  date: string;
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
  status: string;
}

function groupByEmployeeDate(entries: WorkTimeLedgerEntry[]): { employee: string; days: DaySummary[] }[] {
  const byEmp = new Map<string, Map<string, WorkTimeLedgerEntry[]>>();

  for (const e of entries) {
    const date = e.recorded_at.slice(0, 10);
    if (!byEmp.has(e.employee_id)) byEmp.set(e.employee_id, new Map());
    const dayMap = byEmp.get(e.employee_id)!;
    if (!dayMap.has(date)) dayMap.set(date, []);
    dayMap.get(date)!.push(e);
  }

  const result: { employee: string; days: DaySummary[] }[] = [];

  for (const [empId, dayMap] of byEmp) {
    const days: DaySummary[] = [];
    for (const [date, dayEntries] of dayMap) {
      const ci = dayEntries.find(e => e.event_type === 'clock_in');
      const co = dayEntries.find(e => e.event_type === 'clock_out');
      const bs = dayEntries.find(e => e.event_type === 'break_start');
      const be = dayEntries.find(e => e.event_type === 'break_end');

      const fmt = (e?: WorkTimeLedgerEntry) => e ? new Date(e.recorded_at).toISOString().slice(11, 16) : undefined;

      let worked = 0;
      if (ci && co) {
        const total = (new Date(co.recorded_at).getTime() - new Date(ci.recorded_at).getTime()) / 60000;
        const brk = bs && be ? (new Date(be.recorded_at).getTime() - new Date(bs.recorded_at).getTime()) / 60000 : 0;
        worked = Math.max(0, total - brk);
      }

      days.push({
        date,
        employeeName: dayEntries[0].employee_name ?? empId,
        cpf: dayEntries[0].employee_cpf_masked ?? '',
        pis: dayEntries[0].employee_pis ?? '',
        clockIn: fmt(ci),
        breakStart: fmt(bs),
        breakEnd: fmt(be),
        clockOut: fmt(co),
        workedMinutes: worked,
        normalMinutes: Math.min(worked, 480),
        extraMinutes: Math.max(0, worked - 480),
        status: dayEntries[0].status,
      });
    }
    days.sort((a, b) => a.date.localeCompare(b.date));
    result.push({ employee: empId, days });
  }

  return result;
}

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export class TimeExportService implements TimeExportServiceAPI {

  /**
   * GET /worktime/export — server-side export for official formats.
   */
  async requestExport(
    tenantId: string,
    exportType: ExportType,
    periodStart: string,
    periodEnd: string,
    employeeIds?: string[],
    requestedBy?: string,
  ): Promise<WorkTimeExport> {
    // PDF is generated client-side for immediate download
    if (exportType === 'pdf') {
      return this.generatePdfClientSide(tenantId, periodStart, periodEnd, employeeIds);
    }

    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: {
        action: 'export',
        tenant_id: tenantId,
        export_type: exportType,
        period_start: periodStart,
        period_end: periodEnd,
        employee_ids: employeeIds ?? null,
      },
    });

    if (error) throw new Error(`[TimeExportService] export failed: ${error.message}`);
    if (data?.error) throw new Error(`[TimeExportService] ${data.error}`);

    return data.export as WorkTimeExport;
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
   * Download a previously generated export.
   */
  downloadExport(exp: WorkTimeExport & { file_content?: string; mime_type?: string }): void {
    if (!exp.file_content) throw new Error('Sem conteúdo disponível para download.');

    const isPdf = exp.export_type === 'pdf' || exp.mime_type === 'application/pdf';

    if (isPdf) {
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

  // ── Client-side PDF generation (jsPDF) ──

  private async generatePdfClientSide(
    tenantId: string,
    periodStart: string,
    periodEnd: string,
    employeeIds?: string[],
  ): Promise<WorkTimeExport> {
    let query = supabase
      .from('worktime_ledger' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', `${periodStart}T00:00:00Z`)
      .lte('recorded_at', `${periodEnd}T23:59:59Z`)
      .order('recorded_at', { ascending: true });

    if (employeeIds?.length) query = query.in('employee_id', employeeIds);

    const { data, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    const entries = (data ?? []) as unknown as WorkTimeLedgerEntry[];
    const pdfDataUri = this.buildPdf(entries, periodStart, periodEnd);

    // Trigger download
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = `espelho_ponto_${periodStart}_${periodEnd}.pdf`;
    link.click();

    return {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      export_type: 'pdf',
      period_start: periodStart,
      period_end: periodEnd,
      employee_ids: employeeIds ?? null,
      status: 'completed',
      file_url: null,
      file_hash: null,
      record_count: entries.length,
      requested_by: null,
      completed_at: new Date().toISOString(),
      error_message: null,
      created_at: new Date().toISOString(),
    };
  }

  private buildPdf(entries: WorkTimeLedgerEntry[], periodStart: string, periodEnd: string): string {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    const checkPage = (needed: number) => {
      if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
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

    const groups = groupByEmployeeDate(entries);
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

    for (const group of groups) {
      const first = group.days[0];
      checkPage(30);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(first.employeeName, margin, y);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`CPF: ${first.cpf}  |  PIS: ${first.pis}`, margin + 80, y);
      y += 5;

      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 3, pageW - 2 * margin, 5, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      for (const col of cols) doc.text(col.label, col.x + 1, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      let tw = 0, tn = 0, te = 0;

      for (const d of group.days) {
        checkPage(5);
        tw += d.workedMinutes; tn += d.normalMinutes; te += d.extraMinutes;
        const row = [d.date, d.clockIn ?? '--:--', d.breakStart ?? '--:--', d.breakEnd ?? '--:--', d.clockOut ?? '--:--', fmtMinutes(d.workedMinutes), fmtMinutes(d.normalMinutes), fmtMinutes(d.extraMinutes), d.status];
        for (let i = 0; i < cols.length; i++) doc.text(row[i], cols[i].x + 1, y);
        y += 4;
      }

      checkPage(8);
      doc.setFont('helvetica', 'bold');
      doc.line(margin, y - 1, pageW - margin, y - 1);
      doc.text('TOTAL', margin + 1, y + 2);
      doc.text(fmtMinutes(tw), cols[5].x + 1, y + 2);
      doc.text(fmtMinutes(tn), cols[6].x + 1, y + 2);
      doc.text(fmtMinutes(te), cols[7].x + 1, y + 2);
      y += 10;
    }

    // Signatures
    checkPage(25);
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

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.text(`Página ${i} de ${pages}`, pageW - margin, pageH - 8, { align: 'right' });
    }

    return doc.output('datauristring');
  }
}
