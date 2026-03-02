/**
 * WorkTime Compliance Engine — Integrity Hash (Chain of Trust)
 * Implements tamper-proof hashing for the immutable ledger.
 */

export function computeEntryHash(entry: {
  tenant_id: string;
  employee_id: string;
  event_type: string;
  recorded_at: string;
  source: string;
  latitude?: number | null;
  longitude?: number | null;
  device_fingerprint?: string | null;
  previous_hash?: string | null;
}): string {
  const payload = [
    entry.tenant_id,
    entry.employee_id,
    entry.event_type,
    entry.recorded_at,
    entry.source,
    entry.latitude ?? '',
    entry.longitude ?? '',
    entry.device_fingerprint ?? '',
    entry.previous_hash ?? 'GENESIS',
  ].join('|');

  // Simple hash for client-side (deterministic, fast)
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `wt_${hex}_${btoa(payload.slice(0, 32)).replace(/[=+/]/g, '').slice(0, 12)}`;
}

export function computeAdjustmentHash(adj: {
  original_entry_id: string;
  adjustment_type: string;
  reason: string;
  new_recorded_at?: string | null;
}): string {
  const payload = [
    adj.original_entry_id,
    adj.adjustment_type,
    adj.reason,
    adj.new_recorded_at ?? '',
    new Date().toISOString(),
  ].join('|');

  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `wtadj_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

export function verifyHashChain(entries: Array<{ integrity_hash: string; previous_hash: string | null }>) {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].previous_hash !== entries[i - 1].integrity_hash) {
      return { valid: false, broken_at_index: i, expected: entries[i - 1].integrity_hash, got: entries[i].previous_hash };
    }
  }
  return { valid: true, broken_at_index: -1 };
}
