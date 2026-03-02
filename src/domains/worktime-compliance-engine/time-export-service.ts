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
import type { WorkTimeExport, ExportType, TimeExportServiceAPI, WorkTimeLedgerEntry } from './types';

const EVENT_TYPE_CODE: Record<string, string> = {
  clock_in: '1',
  clock_out: '2',
  break_start: '3',
  break_end: '4',
};

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
        break;
      default:
        fileContent = this.generateCSV(entries);
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

  // ── AFD — Arquivo Fonte de Dados (Portaria 671/2021 Art. 80) ──
  // Format: NSR|TipoReg|DataHora|PIS|Tipo|Hash

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

    // Trailer
    lines.push(`${String(nsr).padStart(9, '0')}|9|${entries.length}`);
    return lines.join('\n');
  }

  // ── AFDT — Arquivo Fonte de Dados Tratados (Art. 81) ──
  // Adds employee name, CPF, computed hours

  private generateAFDT(entries: WorkTimeLedgerEntry[], _tenantId: string): string {
    const header = `NSR;TIPO;DATA;HORA;PIS;NOME;CPF;TIPO_EVENTO;LATITUDE;LONGITUDE;HASH`;
    const lines = [header];
    let nsr = 1;

    for (const entry of entries) {
      const dt = new Date(entry.recorded_at);
      const dateStr = dt.toISOString().slice(0, 10);
      const timeStr = dt.toISOString().slice(11, 19);

      lines.push([
        String(nsr).padStart(9, '0'),
        '3',
        dateStr,
        timeStr,
        entry.employee_pis ?? '',
        entry.employee_name ?? '',
        entry.employee_cpf_masked ?? '',
        entry.event_type,
        entry.latitude?.toFixed(6) ?? '',
        entry.longitude?.toFixed(6) ?? '',
        entry.integrity_hash ?? '',
      ].join(';'));
      nsr++;
    }

    return lines.join('\n');
  }

  // ── ACJEF — Controle de Jornada para Efeitos Fiscais (Art. 82) ──

  private generateACJEF(entries: WorkTimeLedgerEntry[], _tenantId: string): string {
    const header = `NSR;DATA;PIS;NOME;ENTRADA;SAIDA_INTERVALO;RETORNO_INTERVALO;SAIDA;HORAS_NORMAIS;HORAS_EXTRAS`;
    const lines = [header];

    // Group by employee+date
    const grouped = new Map<string, WorkTimeLedgerEntry[]>();
    for (const e of entries) {
      const key = `${e.employee_id}|${e.recorded_at.slice(0, 10)}`;
      const list = grouped.get(key) ?? [];
      list.push(e);
      grouped.set(key, list);
    }

    let nsr = 1;
    for (const [, dayEntries] of grouped) {
      const clockIn = dayEntries.find(e => e.event_type === 'clock_in');
      const clockOut = dayEntries.find(e => e.event_type === 'clock_out');
      const breakStart = dayEntries.find(e => e.event_type === 'break_start');
      const breakEnd = dayEntries.find(e => e.event_type === 'break_end');

      if (!clockIn) continue;

      const date = clockIn.recorded_at.slice(0, 10);
      const fmt = (e?: WorkTimeLedgerEntry) => e ? new Date(e.recorded_at).toISOString().slice(11, 16) : '';

      let normalMin = 0;
      let extraMin = 0;
      if (clockIn && clockOut) {
        const total = (new Date(clockOut.recorded_at).getTime() - new Date(clockIn.recorded_at).getTime()) / 60000;
        const breakMin = (breakStart && breakEnd)
          ? (new Date(breakEnd.recorded_at).getTime() - new Date(breakStart.recorded_at).getTime()) / 60000
          : 0;
        const worked = total - breakMin;
        normalMin = Math.min(worked, 480);
        extraMin = Math.max(0, worked - 480);
      }

      lines.push([
        String(nsr).padStart(9, '0'),
        date,
        clockIn.employee_pis ?? '',
        clockIn.employee_name ?? '',
        fmt(clockIn),
        fmt(breakStart),
        fmt(breakEnd),
        fmt(clockOut),
        `${Math.floor(normalMin / 60)}:${String(Math.round(normalMin % 60)).padStart(2, '0')}`,
        `${Math.floor(extraMin / 60)}:${String(Math.round(extraMin % 60)).padStart(2, '0')}`,
      ].join(';'));
      nsr++;
    }

    return lines.join('\n');
  }

  // ── AEJ — Arquivo Eletrônico de Jornada (Art. 84) ──

  private generateAEJ(entries: WorkTimeLedgerEntry[], _tenantId: string): string {
    const header = `TIPO;NSR;DATA;HORA;PIS;NOME;CPF;EVENTO;FONTE;DISPOSITIVO;LATITUDE;LONGITUDE;HASH;ASSINATURA`;
    const lines = [header];
    let nsr = 1;

    for (const entry of entries) {
      const dt = new Date(entry.recorded_at);
      lines.push([
        '3',
        String(nsr).padStart(9, '0'),
        dt.toISOString().slice(0, 10),
        dt.toISOString().slice(11, 19),
        entry.employee_pis ?? '',
        entry.employee_name ?? '',
        entry.employee_cpf_masked ?? '',
        entry.event_type,
        entry.source,
        entry.device_fingerprint ?? '',
        entry.latitude?.toFixed(6) ?? '',
        entry.longitude?.toFixed(6) ?? '',
        entry.integrity_hash ?? '',
        entry.server_signature ? 'HMAC-SHA256' : 'N/A',
      ].join(';'));
      nsr++;
    }

    return lines.join('\n');
  }

  // ── CSV genérico ──

  private generateCSV(entries: WorkTimeLedgerEntry[]): string {
    const header = 'id;employee_id;employee_name;cpf;pis;event_type;recorded_at;source;latitude;longitude;device;status;integrity_hash';
    const lines = [header];

    for (const e of entries) {
      lines.push([
        e.id,
        e.employee_id,
        e.employee_name ?? '',
        e.employee_cpf_masked ?? '',
        e.employee_pis ?? '',
        e.event_type,
        e.recorded_at,
        e.source,
        e.latitude?.toFixed(6) ?? '',
        e.longitude?.toFixed(6) ?? '',
        e.device_fingerprint ?? '',
        e.status,
        e.integrity_hash,
      ].join(';'));
    }

    return lines.join('\n');
  }
}
