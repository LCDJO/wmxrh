/**
 * WorkTime Compliance Engine — Unified Facade
 *
 * Orchestrates all sub-controllers into a single API surface.
 * Integrates with: Tenant IAM, ComplianceAutomation, AccountEnforcement,
 *                  API Management, Control Plane, Audit Logger.
 */

import { TimeEntryController } from './time-entry-controller';
import { GeoFenceValidator } from './geofence-validator';
import { DeviceIntegrityValidator } from './device-integrity-validator';
import { ImmutableTimeLedger } from './immutable-time-ledger';
import { TimeComplianceAuditor } from './time-compliance-auditor';
import { TimeExportService } from './time-export-service';
import { AntiFraudAnalyzer } from './anti-fraud-analyzer';
import type { WorkTimeEngineAPI, CreateTimeEntryDTO, WorkTimeLedgerEntry } from './types';

export class WorkTimeEngine implements WorkTimeEngineAPI {
  readonly timeEntry = new TimeEntryController();
  readonly geoFence = new GeoFenceValidator();
  readonly device = new DeviceIntegrityValidator();
  readonly ledger = new ImmutableTimeLedger();
  readonly compliance = new TimeComplianceAuditor();
  readonly export = new TimeExportService();
  readonly antiFraud = new AntiFraudAnalyzer();

  /**
   * Full pipeline: validate → persist → audit → anti-fraud
   * This is the primary entry point for clock events.
   */
  async registerClockEvent(tenantId: string, dto: CreateTimeEntryDTO): Promise<{
    entry: WorkTimeLedgerEntry;
    geofence_ok: boolean;
    device_ok: boolean;
    fraud_signals: number;
  }> {
    // 1. Geofence validation (with tolerance + enforcement)
    let geofenceOk = true;
    let geofenceSuggestedStatus: 'valid' | 'rejected' | 'flagged' = 'valid';
    if (dto.latitude != null && dto.longitude != null) {
      const geoResult = await this.geoFence.validate(tenantId, dto.latitude, dto.longitude, dto.event_type);
      geofenceOk = geoResult.allowed;
      geofenceSuggestedStatus = geoResult.suggested_status;
      if (geoResult.matched_geofence) {
        dto.geofence_id = geoResult.matched_geofence.id;
      }
      // Block: reject registration entirely
      if (geoResult.suggested_status === 'rejected') {
        throw new Error(`[WorkTimeEngine] Registro bloqueado por geofence: ${geoResult.reason}`);
      }
    }

    // 2. Device integrity validation
    let deviceOk = true;
    if (dto.device_fingerprint) {
      const devResult = await this.device.validate(tenantId, dto.employee_id, dto.device_fingerprint);
      deviceOk = devResult.is_valid;
      if (devResult.is_blocked) {
        throw new Error(`[WorkTimeEngine] Device blocked: ${devResult.device?.blocked_reason}`);
      }
    }

    // 3. Persist to immutable ledger
    const entry = await this.timeEntry.register(tenantId, dto);

    // 4. Anti-fraud analysis (async, non-blocking)
    const fraudLogs = await this.antiFraud.analyze(tenantId, entry).catch(err => {
      console.error('[WorkTimeEngine] Anti-fraud analysis failed:', err);
      return [];
    });

    return {
      entry,
      geofence_ok: geofenceOk,
      device_ok: deviceOk,
      fraud_signals: fraudLogs.length,
    };
  }
}

// Singleton
let _instance: WorkTimeEngine | null = null;

export function getWorkTimeEngine(): WorkTimeEngine {
  if (!_instance) _instance = new WorkTimeEngine();
  return _instance;
}
