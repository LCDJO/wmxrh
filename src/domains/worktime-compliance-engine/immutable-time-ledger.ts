/**
 * WorkTime Compliance Engine — ImmutableTimeLedger
 * Read-only access + chain verification for the append-only ledger.
 */

import { supabase } from '@/integrations/supabase/client';
import { verifyHashChain } from './integrity';
import type { WorkTimeLedgerEntry, ImmutableTimeLedgerAPI, ChainVerificationResult } from './types';

export class ImmutableTimeLedger implements ImmutableTimeLedgerAPI {

  async getEntries(tenantId: string, employeeId: string, from: string, to: string): Promise<WorkTimeLedgerEntry[]> {
    const { data, error } = await supabase
      .from('worktime_ledger' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .gte('recorded_at', from)
      .lte('recorded_at', to)
      .order('recorded_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as WorkTimeLedgerEntry[];
  }

  async getLastEntry(tenantId: string, employeeId: string): Promise<WorkTimeLedgerEntry | null> {
    const { data, error } = await supabase
      .from('worktime_ledger' as any)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as WorkTimeLedgerEntry | null;
  }

  async verifyChain(tenantId: string, employeeId: string, from: string, to: string): Promise<ChainVerificationResult> {
    const entries = await this.getEntries(tenantId, employeeId, from, to);

    if (entries.length === 0) {
      return { is_valid: true, entries_checked: 0 };
    }

    const result = verifyHashChain(entries);

    if (!result.valid) {
      return {
        is_valid: false,
        entries_checked: entries.length,
        broken_at: entries[result.broken_at_index]?.recorded_at,
        details: `Chain broken at entry ${result.broken_at_index}: expected hash '${result.expected}', got '${result.got}'`,
      };
    }

    return { is_valid: true, entries_checked: entries.length };
  }
}
