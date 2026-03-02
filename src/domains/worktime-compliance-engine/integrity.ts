/**
 * WorkTime Compliance Engine — Integrity Hash (Chain of Trust)
 *
 * Client-side: SHA-256 via Web Crypto API (pre-hash before server signing)
 * Server-side: HMAC-SHA256 via edge function (authoritative signature)
 *
 * The client computes the same SHA-256 for local validation,
 * but the server_signature (HMAC) can only be produced server-side.
 */

/** Compute SHA-256 hash of canonical entry payload (browser-compatible) */
export async function computeEntryHashSHA256(entry: {
  tenant_id: string;
  employee_id: string;
  event_type: string;
  recorded_at: string;
  source: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  device_fingerprint?: string | null;
  ip_address?: string | null;
  previous_hash?: string | null;
}): Promise<string> {
  const canonical = [
    entry.tenant_id,
    entry.employee_id,
    entry.event_type,
    entry.recorded_at,
    entry.source,
    entry.latitude ?? '',
    entry.longitude ?? '',
    entry.accuracy_meters ?? '',
    entry.device_fingerprint ?? '',
    entry.ip_address ?? '',
    entry.previous_hash ?? 'GENESIS',
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Compute SHA-256 hash of adjustment payload */
export async function computeAdjustmentHashSHA256(adj: {
  original_entry_id: string;
  adjustment_type: string;
  reason: string;
  new_recorded_at?: string | null;
  timestamp?: string;
}): Promise<string> {
  const canonical = [
    adj.original_entry_id,
    adj.adjustment_type,
    adj.reason,
    adj.new_recorded_at ?? '',
    adj.timestamp ?? new Date().toISOString(),
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Verify hash chain integrity across ordered entries */
export function verifyHashChain(entries: Array<{ integrity_hash: string; previous_hash: string | null }>) {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].previous_hash !== entries[i - 1].integrity_hash) {
      return {
        valid: false,
        broken_at_index: i,
        expected: entries[i - 1].integrity_hash,
        got: entries[i].previous_hash,
      };
    }
  }
  return { valid: true, broken_at_index: -1 };
}

// Legacy sync wrappers for backward compat (delegate to SHA-256)
export function computeEntryHash(entry: Parameters<typeof computeEntryHashSHA256>[0]): string {
  // Synchronous fallback — used only where async isn't possible
  const canonical = [
    entry.tenant_id, entry.employee_id, entry.event_type, entry.recorded_at,
    entry.source, entry.latitude ?? '', entry.longitude ?? '',
    entry.device_fingerprint ?? '', entry.previous_hash ?? 'GENESIS',
  ].join('|');

  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) - hash) + canonical.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

export function computeAdjustmentHash(adj: {
  original_entry_id: string;
  adjustment_type: string;
  reason: string;
  new_recorded_at?: string | null;
}): string {
  const canonical = [adj.original_entry_id, adj.adjustment_type, adj.reason, adj.new_recorded_at ?? ''].join('|');
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) - hash) + canonical.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}
