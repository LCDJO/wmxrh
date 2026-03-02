/**
 * WorkTime Compliance Engine — TimeEntryController
 *
 * Client-side controller that calls the unified `worktime-api` edge function.
 *
 * Endpoints mapped:
 *   POST /worktime/clock       →  action: "clock"
 *   GET  /worktime/history     →  action: "history"
 *   POST /worktime/adjustment  →  action: "adjustment"
 *   POST /worktime/adjustment/approve → action: "approve_adjustment"
 *   POST /worktime/verify      →  action: "verify_entry"
 */

import { supabase } from '@/integrations/supabase/client';
import { computeEntryHashSHA256, computeAdjustmentHashSHA256 } from './integrity';
import type {
  WorkTimeLedgerEntry, CreateTimeEntryDTO, LedgerAdjustment,
  CreateAdjustmentDTO, TimeEntryControllerAPI,
} from './types';

const FUNCTION_NAME = 'worktime-api';

export class TimeEntryController implements TimeEntryControllerAPI {

  /**
   * POST /worktime/clock
   * Register a clock event via server-signed pipeline.
   */
  async register(tenantId: string, dto: CreateTimeEntryDTO): Promise<WorkTimeLedgerEntry> {
    const now = new Date().toISOString();
    const recordedAt = dto.is_offline_sync && dto.offline_recorded_at ? dto.offline_recorded_at : now;

    // Client-side SHA-256 pre-hash (local validation only)
    await computeEntryHashSHA256({
      tenant_id: tenantId,
      employee_id: dto.employee_id,
      event_type: dto.event_type,
      recorded_at: recordedAt,
      source: dto.source ?? 'manual',
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy_meters: dto.accuracy_meters,
      device_fingerprint: dto.device_fingerprint,
      ip_address: dto.ip_address,
      previous_hash: null, // server resolves chain
    });

    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: {
        action: 'clock',
        entry: {
          tenant_id: tenantId,
          employee_id: dto.employee_id,
          event_type: dto.event_type,
          recorded_at: recordedAt,
          source: dto.source ?? 'manual',
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          accuracy_meters: dto.accuracy_meters ?? null,
          device_fingerprint: dto.device_fingerprint ?? null,
          device_model: dto.device_model ?? null,
          device_os: dto.device_os ?? null,
          app_version: dto.app_version ?? null,
          ip_address: dto.ip_address ?? null,
          geofence_id: dto.geofence_id ?? null,
          photo_proof_url: dto.photo_proof_url ?? null,
          is_offline_sync: dto.is_offline_sync ?? false,
          offline_recorded_at: dto.offline_recorded_at ?? null,
        },
      },
    });

    if (error) throw new Error(`[TimeEntryController] clock failed: ${error.message}`);
    if (data?.error) throw new Error(`[TimeEntryController] ${data.error}`);
    return data.entry as WorkTimeLedgerEntry;
  }

  /**
   * POST /worktime/adjustment
   * Formal adjustment — original entry stays immutable.
   */
  async adjust(tenantId: string, dto: CreateAdjustmentDTO): Promise<LedgerAdjustment> {
    await computeAdjustmentHashSHA256({
      original_entry_id: dto.original_entry_id,
      adjustment_type: dto.adjustment_type,
      reason: dto.reason,
      new_recorded_at: dto.new_recorded_at,
    });

    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: {
        action: 'adjustment',
        adjustment: {
          tenant_id: tenantId,
          original_entry_id: dto.original_entry_id,
          adjustment_type: dto.adjustment_type,
          new_recorded_at: dto.new_recorded_at ?? null,
          new_event_type: dto.new_event_type ?? null,
          reason: dto.reason,
          legal_basis: dto.legal_basis ?? null,
        },
      },
    });

    if (error) throw new Error(`[TimeEntryController] adjustment failed: ${error.message}`);
    if (data?.error) throw new Error(`[TimeEntryController] ${data.error}`);
    return data.adjustment as LedgerAdjustment;
  }

  /**
   * POST /worktime/adjustment/approve
   */
  async approveAdjustment(adjustmentId: string, approved: boolean): Promise<LedgerAdjustment> {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { action: 'approve_adjustment', adjustment_id: adjustmentId, approved },
    });
    if (error) throw new Error(`[TimeEntryController] approval failed: ${error.message}`);
    if (data?.error) throw new Error(`[TimeEntryController] ${data.error}`);
    return data.adjustment as LedgerAdjustment;
  }

  /** Verify an entry's integrity hash server-side */
  async verifyEntry(entryId: string): Promise<{ hash_valid: boolean; has_signature: boolean }> {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { action: 'verify_entry', entry_id: entryId },
    });
    if (error) throw new Error(`[TimeEntryController] verify failed: ${error.message}`);
    return data;
  }

  /**
   * GET /worktime/history
   * Paginated history with adjustments.
   */
  async getEntries(tenantId: string, employeeId: string, from: string, to: string): Promise<WorkTimeLedgerEntry[]> {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { action: 'history', tenant_id: tenantId, employee_id: employeeId, from, to },
    });
    if (error) throw new Error(`[TimeEntryController] history failed: ${error.message}`);
    if (data?.error) throw new Error(`[TimeEntryController] ${data.error}`);
    return (data.entries ?? []) as WorkTimeLedgerEntry[];
  }

  /**
   * GET /worktime/history (full response with pagination + adjustments)
   */
  async getHistory(tenantId: string, employeeId: string, from: string, to: string, page = 1, perPage = 50) {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { action: 'history', tenant_id: tenantId, employee_id: employeeId, from, to, page, per_page: perPage },
    });
    if (error) throw new Error(`[TimeEntryController] history failed: ${error.message}`);
    if (data?.error) throw new Error(`[TimeEntryController] ${data.error}`);
    return data as {
      entries: WorkTimeLedgerEntry[];
      adjustments: LedgerAdjustment[];
      pagination: { page: number; per_page: number; total: number; total_pages: number };
    };
  }
}
