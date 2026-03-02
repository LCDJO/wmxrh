/**
 * WorkTime Compliance Engine — TimeEntryController
 *
 * Orchestrates: validate → SHA-256 hash → server sign (HMAC) → persist → audit
 *
 * CRITICAL FLOW:
 *   1. Client computes SHA-256 pre-hash (local validation)
 *   2. Sends payload to edge function `worktime-sign-entry`
 *   3. Server computes authoritative SHA-256 + HMAC-SHA256 signature
 *   4. Server persists to immutable ledger (service_role bypasses RLS)
 *   5. Returns signed entry to client
 *
 * This ensures: no edit, no delete, formal adjustment only, SHA-256, server key.
 */

import { supabase } from '@/integrations/supabase/client';
import { computeEntryHashSHA256, computeAdjustmentHashSHA256 } from './integrity';
import type {
  WorkTimeLedgerEntry, CreateTimeEntryDTO, LedgerAdjustment,
  CreateAdjustmentDTO, TimeEntryControllerAPI,
} from './types';

export class TimeEntryController implements TimeEntryControllerAPI {

  /**
   * Register a clock event via server-signed pipeline.
   * The entry is hashed (SHA-256) and signed (HMAC-SHA256) server-side.
   */
  async register(tenantId: string, dto: CreateTimeEntryDTO): Promise<WorkTimeLedgerEntry> {
    // 1. Get previous hash for chain linkage
    const lastEntry = await this.getLastEntry(tenantId, dto.employee_id);
    const previousHash = lastEntry?.integrity_hash ?? null;

    const now = new Date().toISOString();
    const recordedAt = dto.is_offline_sync && dto.offline_recorded_at ? dto.offline_recorded_at : now;

    // 2. Client-side SHA-256 pre-hash (for local validation)
    const clientHash = await computeEntryHashSHA256({
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
      previous_hash: previousHash,
    });

    // 3. Send to server for authoritative signing + persistence
    const { data, error } = await supabase.functions.invoke('worktime-sign-entry', {
      body: {
        action: 'sign_entry',
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
          geofence_matched: false,
          photo_proof_url: dto.photo_proof_url ?? null,
          previous_hash: previousHash,
          is_offline_sync: dto.is_offline_sync ?? false,
          offline_recorded_at: dto.offline_recorded_at ?? null,
          client_hash: clientHash,
        },
      },
    });

    if (error) throw new Error(`[TimeEntryController] Server signing failed: ${error.message}`);
    if (data?.error) throw new Error(`[TimeEntryController] ${data.error}`);

    return data.entry as WorkTimeLedgerEntry;
  }

  /**
   * Register a formal adjustment (append-only, server-signed).
   * Original entry remains untouched in the ledger.
   */
  async adjust(tenantId: string, dto: CreateAdjustmentDTO): Promise<LedgerAdjustment> {
    // Client-side pre-hash
    await computeAdjustmentHashSHA256({
      original_entry_id: dto.original_entry_id,
      adjustment_type: dto.adjustment_type,
      reason: dto.reason,
      new_recorded_at: dto.new_recorded_at,
    });

    const { data, error } = await supabase.functions.invoke('worktime-sign-entry', {
      body: {
        action: 'sign_adjustment',
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

    if (error) throw new Error(`[TimeEntryController] Adjustment signing failed: ${error.message}`);
    if (data?.error) throw new Error(`[TimeEntryController] ${data.error}`);

    return data.adjustment as LedgerAdjustment;
  }

  /** Verify an entry's integrity hash server-side */
  async verifyEntry(entryId: string): Promise<{ hash_valid: boolean; has_signature: boolean }> {
    const { data, error } = await supabase.functions.invoke('worktime-sign-entry', {
      body: { action: 'verify_entry', entry_id: entryId },
    });
    if (error) throw new Error(`[TimeEntryController] Verify failed: ${error.message}`);
    return data;
  }

  async getEntries(tenantId: string, employeeId: string, from: string, to: string): Promise<WorkTimeLedgerEntry[]> {
    const { data, error } = await supabase
      .from('worktime_ledger' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .gte('recorded_at', from)
      .lte('recorded_at', to)
      .order('recorded_at', { ascending: true });

    if (error) throw new Error(`[TimeEntryController] getEntries failed: ${error.message}`);
    return (data ?? []) as unknown as WorkTimeLedgerEntry[];
  }

  private async getLastEntry(tenantId: string, employeeId: string): Promise<WorkTimeLedgerEntry | null> {
    const { data, error } = await supabase
      .from('worktime_ledger' as any)
      .select('integrity_hash')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`[TimeEntryController] getLastEntry failed: ${error.message}`);
    return data as unknown as WorkTimeLedgerEntry | null;
  }
}
