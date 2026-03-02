/**
 * WorkTime Compliance Engine — TimeEntryController
 * Orchestrates: validate → hash → persist → audit → anti-fraud
 */

import { supabase } from '@/integrations/supabase/client';
import { computeEntryHash, computeAdjustmentHash } from './integrity';
import type {
  WorkTimeLedgerEntry, CreateTimeEntryDTO, LedgerAdjustment,
  CreateAdjustmentDTO, TimeEntryControllerAPI,
} from './types';

export class TimeEntryController implements TimeEntryControllerAPI {

  async register(tenantId: string, dto: CreateTimeEntryDTO): Promise<WorkTimeLedgerEntry> {
    // 1. Get previous hash for chain
    const lastEntry = await this.getLastEntry(tenantId, dto.employee_id);
    const previousHash = lastEntry?.integrity_hash ?? null;

    // 2. Compute integrity hash
    const now = new Date().toISOString();
    const integrityHash = computeEntryHash({
      tenant_id: tenantId,
      employee_id: dto.employee_id,
      event_type: dto.event_type,
      recorded_at: dto.is_offline_sync && dto.offline_recorded_at ? dto.offline_recorded_at : now,
      source: dto.source ?? 'manual',
      latitude: dto.latitude,
      longitude: dto.longitude,
      device_fingerprint: dto.device_fingerprint,
      previous_hash: previousHash,
    });

    // 3. Persist to immutable ledger
    const { data, error } = await supabase
      .from('worktime_ledger' as any)
      .insert({
        tenant_id: tenantId,
        employee_id: dto.employee_id,
        event_type: dto.event_type,
        recorded_at: dto.is_offline_sync && dto.offline_recorded_at ? dto.offline_recorded_at : now,
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
        integrity_hash: integrityHash,
        previous_hash: previousHash,
        is_offline_sync: dto.is_offline_sync ?? false,
        offline_recorded_at: dto.offline_recorded_at ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`[TimeEntryController] register failed: ${error.message}`);
    return data as unknown as WorkTimeLedgerEntry;
  }

  async adjust(tenantId: string, dto: CreateAdjustmentDTO): Promise<LedgerAdjustment> {
    const hash = computeAdjustmentHash({
      original_entry_id: dto.original_entry_id,
      adjustment_type: dto.adjustment_type,
      reason: dto.reason,
      new_recorded_at: dto.new_recorded_at,
    });

    const { data, error } = await supabase
      .from('worktime_ledger_adjustments' as any)
      .insert({
        tenant_id: tenantId,
        original_entry_id: dto.original_entry_id,
        adjustment_type: dto.adjustment_type,
        new_recorded_at: dto.new_recorded_at ?? null,
        new_event_type: dto.new_event_type ?? null,
        reason: dto.reason,
        legal_basis: dto.legal_basis ?? null,
        approval_status: 'pending',
        integrity_hash: hash,
      })
      .select()
      .single();

    if (error) throw new Error(`[TimeEntryController] adjust failed: ${error.message}`);
    return data as unknown as LedgerAdjustment;
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
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`[TimeEntryController] getLastEntry failed: ${error.message}`);
    return data as unknown as WorkTimeLedgerEntry | null;
  }
}
