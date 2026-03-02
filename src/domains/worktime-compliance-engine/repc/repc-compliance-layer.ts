/**
 * REPCComplianceLayer — Facade unificada para conformidade REP-C.
 *
 * Portaria MTP 671/2021 · CLT Art. 74
 *
 * Integra:
 *   - WorkTimeEngine (ledger imutável)
 *   - ComplianceAutomationEngine (auditorias)
 *   - Audit Logger (trilha)
 *   - Control Plane (configuração)
 */

import { AFDGenerator } from './afd-generator';
import { AEJGenerator } from './aej-generator';
import { OfficialTimeSyncService } from './official-time-sync';
import { REPCTechnicalLog } from './repc-technical-log';
import { SystemIdentificationManager } from './system-identification';
import { InspectionExportService } from './inspection-export';
import { REPVersionRegistry } from './rep-version-registry';
import type { REPComplianceReport } from './types';

export class REPCComplianceLayer {
  readonly afd = new AFDGenerator();
  readonly aej = new AEJGenerator();
  readonly timeSync = new OfficialTimeSyncService();
  readonly technicalLog = new REPCTechnicalLog();
  readonly systemId = new SystemIdentificationManager();
  readonly inspection = new InspectionExportService();
  readonly versions = new REPVersionRegistry();

  /** Initialize: sync time + log system start */
  async initialize(tenantId: string): Promise<void> {
    // 1. Sync with official time
    const syncResult = await this.timeSync.sync();

    // 2. Log system start
    this.technicalLog.log(tenantId, {
      event_type: 'system_start',
      description: `REP-C inicializado. Sync NTP: ${syncResult.synced ? 'OK' : 'FALLBACK'} (offset: ${syncResult.offset_ms}ms)`,
      metadata: { sync: syncResult, version: this.versions.getCurrent().version },
    });

    // 3. Log time sync
    this.technicalLog.log(tenantId, {
      event_type: syncResult.synced ? 'ntp_sync_success' : 'ntp_sync_failure',
      description: `Sincronização com ${syncResult.ntp_server}: offset=${syncResult.offset_ms}ms`,
      metadata: { ...syncResult } as unknown as Record<string, unknown>,
    });
  }

  /** Log a clock registration event */
  logClockRegistration(tenantId: string, nsr: number, employeeId: string, actorCpf?: string): void {
    this.technicalLog.log(tenantId, {
      event_type: 'clock_registration',
      nsr,
      description: `Registro de ponto NSR=${nsr} para empregado ${employeeId}`,
      actor_id: employeeId,
      actor_cpf: actorCpf,
    });
  }

  /** Log configuration change */
  logConfigChange(tenantId: string, actorId: string, description: string, metadata?: Record<string, unknown>): void {
    this.technicalLog.log(tenantId, {
      event_type: 'config_change',
      description,
      actor_id: actorId,
      metadata,
    });
  }

  /** Log export generation */
  logExportGenerated(tenantId: string, exportType: string, actorId: string): void {
    this.technicalLog.log(tenantId, {
      event_type: 'export_generated',
      description: `Exportação ${exportType} gerada`,
      actor_id: actorId,
    });
  }

  /** Run full integrity verification */
  verifyIntegrity(tenantId: string): { technicalLog: { valid: boolean; broken_at?: string } } {
    return {
      technicalLog: this.technicalLog.verifyChain(tenantId),
    };
  }

  /** Generate full REP-C compliance report */
  generateComplianceReport(tenantId: string): REPComplianceReport {
    const findings: string[] = [];

    // Time sync status
    const lastSync = this.timeSync.getLastSync();
    const syncStatus = !lastSync ? 'never_synced' : lastSync.synced ? 'synced' : 'fallback';
    if (syncStatus === 'never_synced') findings.push('Sincronização NTP nunca realizada');
    if (syncStatus === 'fallback') findings.push('Sincronização NTP em fallback — hora oficial não garantida');
    if (lastSync && !lastSync.within_tolerance) findings.push(`Offset NTP fora da tolerância: ${lastSync.offset_ms}ms`);

    // Integrity
    const integrity = this.technicalLog.verifyChain(tenantId);
    if (!integrity.valid) findings.push(`Cadeia de integridade do log técnico corrompida em: ${integrity.broken_at}`);

    // Version
    const currentVersion = this.versions.getCurrent();
    if (currentVersion.compliance_level !== 'full') findings.push(`Nível de conformidade: ${currentVersion.compliance_level}`);

    // Log entries & failures
    const allLogs = this.technicalLog.getEntries(tenantId, '2000-01-01', '2099-12-31');
    const ntpFailures = allLogs.filter(e => e.event_type === 'ntp_sync_failure');
    const errors = allLogs.filter(e => e.event_type === 'error');
    const exportLogs = allLogs.filter(e => e.event_type === 'export_generated' && e.description.includes('AFD'));
    const lastAfdLog = exportLogs.length > 0 ? exportLogs[exportLogs.length - 1] : null;

    const recentFailures = [...ntpFailures, ...errors]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map(e => ({ timestamp: e.timestamp, event_type: e.event_type, description: e.description }));

    if (ntpFailures.length > 0) findings.push(`${ntpFailures.length} falha(s) de sincronização NTP registradas`);
    if (errors.length > 0) findings.push(`${errors.length} erro(s) crítico(s) registrados`);

    // Overall status
    const hasBlocker = !integrity.valid || syncStatus === 'never_synced' || currentVersion.compliance_level === 'non_compliant';
    const hasWarning = findings.length > 0;
    const overall_status = hasBlocker ? 'non_compliant' : hasWarning ? 'warning' : 'compliant';

    return {
      generated_at: new Date().toISOString(),
      tenant_id: tenantId,
      time_sync: {
        status: syncStatus,
        last_sync: lastSync,
        offset_ms: lastSync?.offset_ms ?? 0,
        within_tolerance: lastSync?.within_tolerance ?? false,
      },
      integrity: {
        technical_log_valid: integrity.valid,
        technical_log_broken_at: integrity.broken_at,
        total_log_entries: allLogs.length,
      },
      version: {
        current: currentVersion.version,
        compliance_level: currentVersion.compliance_level,
        content_hash: currentVersion.content_hash,
        release_date: currentVersion.release_date,
        total_versions: this.versions.getHistory().length,
      },
      last_afd: {
        generated: !!lastAfdLog,
        generated_at: lastAfdLog?.timestamp,
      },
      failures: {
        total: ntpFailures.length + errors.length,
        ntp_failures: ntpFailures.length,
        errors: errors.length,
        recent: recentFailures,
      },
      overall_status,
      findings,
    };
  }
}

// ── Singleton ──
let _instance: REPCComplianceLayer | null = null;
export function getREPCComplianceLayer(): REPCComplianceLayer {
  if (!_instance) _instance = new REPCComplianceLayer();
  return _instance;
}
