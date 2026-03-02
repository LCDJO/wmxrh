/**
 * WorkTime Compliance Engine — TimeComplianceAuditor
 *
 * Compliance checks per Portaria 671/2021 and CLT:
 *   - Identificação clara do empregado (nome, CPF, PIS)
 *   - Armazenamento mínimo 5 anos (CLT Art. 11)
 *   - Cadeia de integridade SHA-256
 *   - Verificações diárias (intervalo, HE, saída)
 *   - Trilha de auditoria completa
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  WorkTimeComplianceAudit, ComplianceFinding, ComplianceAuditType,
  TimeComplianceAuditorAPI, WorkTimeLedgerEntry,
} from './types';

export class TimeComplianceAuditor implements TimeComplianceAuditorAPI {

  async runDailyAudit(tenantId: string, date: string, employeeId?: string): Promise<WorkTimeComplianceAudit> {
    const from = `${date}T00:00:00Z`;
    const to = `${date}T23:59:59Z`;

    let query = supabase
      .from('worktime_ledger' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', from)
      .lte('recorded_at', to)
      .order('recorded_at', { ascending: true });

    if (employeeId) query = query.eq('employee_id', employeeId);

    const { data, error } = await query;
    if (error) throw error;

    const entries = (data ?? []) as unknown as WorkTimeLedgerEntry[];
    const findings: ComplianceFinding[] = [];

    // Group by employee
    const byEmployee = new Map<string, WorkTimeLedgerEntry[]>();
    for (const e of entries) {
      const list = byEmployee.get(e.employee_id) ?? [];
      list.push(e);
      byEmployee.set(e.employee_id, list);
    }

    for (const [empId, empEntries] of byEmployee) {
      const clockIns = empEntries.filter(e => e.event_type === 'clock_in');
      const clockOuts = empEntries.filter(e => e.event_type === 'clock_out');
      const breakStarts = empEntries.filter(e => e.event_type === 'break_start');
      const breakEnds = empEntries.filter(e => e.event_type === 'break_end');

      // ── 1. Identificação do empregado ──
      const firstEntry = empEntries[0];
      if (firstEntry && (!firstEntry.employee_name || !firstEntry.employee_cpf_masked)) {
        findings.push({
          code: 'MISSING_EMPLOYEE_ID',
          severity: 'violation',
          description: 'Registro sem identificação completa do empregado (nome/CPF)',
          legal_reference: 'Portaria 671/2021 Art. 79 §1º',
          employee_id: empId,
          date,
        });
      }

      // ── 2. Missing clock_out ──
      if (clockIns.length > clockOuts.length) {
        findings.push({
          code: 'MISSING_CLOCK_OUT',
          severity: 'warning',
          description: 'Registro de saída ausente',
          legal_reference: 'CLT Art. 74 §2º',
          employee_id: empId,
          date,
        });
      }

      // ── 3. Break violation (jornada > 6h sem intervalo) ──
      if (clockIns.length > 0 && clockOuts.length > 0) {
        const totalMinutes = clockIns.reduce((sum, ci, i) => {
          const co = clockOuts[i];
          if (!co) return sum;
          return sum + (new Date(co.recorded_at).getTime() - new Date(ci.recorded_at).getTime()) / 60000;
        }, 0);

        if (totalMinutes > 360 && breakStarts.length === 0) {
          findings.push({
            code: 'BREAK_VIOLATION',
            severity: 'violation',
            description: 'Jornada >6h sem registro de intervalo',
            legal_reference: 'CLT Art. 71',
            employee_id: empId,
            date,
            details: { total_minutes: Math.round(totalMinutes) },
          });
        }

        // ── 4. Overtime limit (>2h extras) ──
        const overtime = totalMinutes - 480;
        if (overtime > 120) {
          findings.push({
            code: 'OVERTIME_LIMIT_EXCEEDED',
            severity: 'violation',
            description: `Limite de HE excedido: ${Math.round(overtime)}min extras (máx 120min)`,
            legal_reference: 'CLT Art. 59 §1º',
            employee_id: empId,
            date,
            details: { overtime_minutes: Math.round(overtime) },
          });
        }
      }

      // ── 5. Break too short ──
      if (breakStarts.length > 0 && breakEnds.length > 0) {
        const breakMin = breakStarts.reduce((sum, bs, i) => {
          const be = breakEnds[i];
          if (!be) return sum;
          return sum + (new Date(be.recorded_at).getTime() - new Date(bs.recorded_at).getTime()) / 60000;
        }, 0);
        if (breakMin < 60) {
          findings.push({
            code: 'BREAK_TOO_SHORT',
            severity: 'warning',
            description: `Intervalo de ${Math.round(breakMin)}min (mínimo 60min)`,
            legal_reference: 'CLT Art. 71',
            employee_id: empId,
            date,
          });
        }
      }

      // ── 6. Hash integrity per entry ──
      for (const entry of empEntries) {
        if (!entry.integrity_hash) {
          findings.push({
            code: 'MISSING_HASH',
            severity: 'violation',
            description: 'Registro sem hash de integridade SHA-256',
            legal_reference: 'Portaria 671/2021 Art. 79',
            employee_id: empId,
            date,
            details: { entry_id: entry.id },
          });
        }
        if (!entry.server_signature) {
          findings.push({
            code: 'MISSING_SIGNATURE',
            severity: 'warning',
            description: 'Registro sem assinatura do servidor (HMAC)',
            legal_reference: 'Portaria 671/2021 Art. 79',
            employee_id: empId,
            date,
            details: { entry_id: entry.id },
          });
        }
      }
    }

    // Log audit action
    await this.logAuditTrail(tenantId, 'daily_audit_executed', 'compliance_audit', undefined, {
      date,
      employee_id: employeeId ?? 'all',
      findings_count: findings.length,
    });

    return this.persistAudit(tenantId, {
      audit_type: 'daily_closure',
      period_start: date,
      period_end: date,
      employee_id: employeeId ?? null,
      findings,
    });
  }

  async runPortaria671Check(tenantId: string, periodStart: string, periodEnd: string): Promise<WorkTimeComplianceAudit> {
    const findings: ComplianceFinding[] = [];

    // ── Hash chain integrity ──
    const { data: entries, error } = await supabase
      .from('worktime_ledger' as any)
      .select('id, integrity_hash, previous_hash, server_signature, recorded_at, employee_id, employee_name, employee_cpf_masked')
      .eq('tenant_id', tenantId)
      .gte('recorded_at', `${periodStart}T00:00:00Z`)
      .lte('recorded_at', `${periodEnd}T23:59:59Z`)
      .order('recorded_at', { ascending: true })
      .limit(1000);

    if (error) throw error;

    const allEntries = (entries ?? []) as any[];

    // Chain verification
    for (let i = 1; i < allEntries.length; i++) {
      if (allEntries[i].previous_hash && allEntries[i].previous_hash !== allEntries[i - 1].integrity_hash) {
        findings.push({
          code: 'HASH_CHAIN_BROKEN',
          severity: 'violation',
          description: 'Cadeia de integridade quebrada — possível adulteração',
          legal_reference: 'Portaria 671/2021 Art. 79',
          employee_id: allEntries[i].employee_id,
          date: allEntries[i].recorded_at,
        });
      }
    }

    // ── Employee identification compliance ──
    const missingId = allEntries.filter(e => !e.employee_name || !e.employee_cpf_masked);
    if (missingId.length > 0) {
      findings.push({
        code: 'EMPLOYEE_ID_INCOMPLETE',
        severity: 'violation',
        description: `${missingId.length} registros sem identificação completa do empregado`,
        legal_reference: 'Portaria 671/2021 Art. 79 §1º',
        details: { count: missingId.length, sample_ids: missingId.slice(0, 5).map((e: any) => e.id) },
      });
    }

    // ── Signature coverage ──
    const unsigned = allEntries.filter(e => !e.server_signature);
    if (unsigned.length > 0) {
      findings.push({
        code: 'UNSIGNED_ENTRIES',
        severity: 'warning',
        description: `${unsigned.length} registros sem assinatura HMAC do servidor`,
        legal_reference: 'Portaria 671/2021 Art. 79',
        details: { count: unsigned.length },
      });
    }

    // ── Retention compliance (5 years) ──
    const retentionFinding = await this.checkRetention(tenantId);
    if (retentionFinding) findings.push(retentionFinding);

    // Summary
    findings.push({
      code: 'PORTARIA_671_COMPLIANCE',
      severity: 'info',
      description: `Verificação de ${allEntries.length} registros no período ${periodStart} → ${periodEnd}`,
      legal_reference: 'Portaria 671/2021',
      details: {
        total_entries: allEntries.length,
        with_hash: allEntries.filter(e => e.integrity_hash).length,
        with_signature: allEntries.filter(e => e.server_signature).length,
        with_employee_id: allEntries.filter(e => e.employee_name && e.employee_cpf_masked).length,
      },
    });

    await this.logAuditTrail(tenantId, 'portaria671_check_executed', 'compliance_audit', undefined, {
      period: `${periodStart} → ${periodEnd}`,
      entries_checked: allEntries.length,
      findings_count: findings.length,
    });

    return this.persistAudit(tenantId, {
      audit_type: 'portaria_671_check',
      period_start: periodStart,
      period_end: periodEnd,
      findings,
    });
  }

  async getAudits(tenantId: string, opts?: { auditType?: ComplianceAuditType; limit?: number }): Promise<WorkTimeComplianceAudit[]> {
    let query = supabase
      .from('worktime_compliance_audits' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 50);

    if (opts?.auditType) query = query.eq('audit_type', opts.auditType);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as WorkTimeComplianceAudit[];
  }

  // ── Retention check ──

  private async checkRetention(tenantId: string): Promise<ComplianceFinding | null> {
    // Check for oldest record
    const { data } = await supabase
      .from('worktime_ledger' as any)
      .select('recorded_at')
      .eq('tenant_id', tenantId)
      .order('recorded_at', { ascending: true })
      .limit(1);

    if (!data || data.length === 0) return null;

    const oldest = new Date((data[0] as any).recorded_at);
    const yearsStored = (Date.now() - oldest.getTime()) / (365.25 * 86400000);

    // Warn if approaching 5 year mark with no archive policy
    if (yearsStored >= 4.5) {
      return {
        code: 'RETENTION_APPROACHING_LIMIT',
        severity: 'warning',
        description: `Registros mais antigos têm ${Math.round(yearsStored * 10) / 10} anos. Prazo legal: 5 anos (CLT Art. 11)`,
        legal_reference: 'CLT Art. 11 / Portaria 671/2021 Art. 83',
        details: {
          oldest_record: oldest.toISOString(),
          years_stored: Math.round(yearsStored * 10) / 10,
          required_years: 5,
        },
      };
    }

    return null;
  }

  // ── Audit trail logging ──

  private async logAuditTrail(
    tenantId: string,
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await supabase
        .from('worktime_audit_trail' as any)
        .insert({
          tenant_id: tenantId,
          action,
          entity_type: entityType,
          entity_id: entityId ?? null,
          details: details ?? {},
        });
    } catch (err) {
      console.error('[TimeComplianceAuditor] audit trail log failed:', err);
    }
  }

  // ── Persist audit result ──

  private async persistAudit(tenantId: string, audit: {
    audit_type: ComplianceAuditType;
    period_start: string;
    period_end: string;
    employee_id?: string | null;
    findings: ComplianceFinding[];
  }): Promise<WorkTimeComplianceAudit> {
    const violations = audit.findings.filter(f => f.severity === 'violation').length;
    const total = audit.findings.length;
    const score = total === 0 ? 100 : Math.max(0, 100 - (violations / total) * 100);

    const { data, error } = await supabase
      .from('worktime_compliance_audits' as any)
      .insert({
        tenant_id: tenantId,
        audit_type: audit.audit_type,
        period_start: audit.period_start,
        period_end: audit.period_end,
        employee_id: audit.employee_id ?? null,
        findings: JSON.parse(JSON.stringify(audit.findings)),
        violations_count: violations,
        compliance_score: Math.round(score * 100) / 100,
        audited_by: 'system',
      })
      .select()
      .single();

    if (error) throw new Error(`[TimeComplianceAuditor] persistAudit failed: ${error.message}`);
    return data as unknown as WorkTimeComplianceAudit;
  }
}
