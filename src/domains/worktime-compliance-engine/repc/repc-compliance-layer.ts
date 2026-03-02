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
import type { REPCComplianceLayerAPI } from './types';

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
}

// ── Singleton ──
let _instance: REPCComplianceLayer | null = null;
export function getREPCComplianceLayer(): REPCComplianceLayer {
  if (!_instance) _instance = new REPCComplianceLayer();
  return _instance;
}
