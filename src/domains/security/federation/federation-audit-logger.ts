/**
 * UIFE — FederationAuditLogger
 *
 * Structured audit logging for all federation events.
 * Backed by federation_audit_logs table (insert via service_role).
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  FederationAuditLoggerAPI,
  FederationAuditEvent,
  FederationAuditEntry,
  AuditQueryFilters,
} from './types';

/** In-memory buffer for batch inserts (flushed periodically or on threshold) */
const eventBuffer: FederationAuditEvent[] = [];
const BUFFER_THRESHOLD = 10;
const FLUSH_INTERVAL_MS = 5_000;

let flushTimer: ReturnType<typeof setInterval> | null = null;

async function flushBuffer(): Promise<void> {
  if (eventBuffer.length === 0) return;

  const batch = eventBuffer.splice(0, eventBuffer.length);
  const rows = batch.map(e => ({
    tenant_id: e.tenant_id,
    idp_config_id: e.idp_config_id ?? null,
    session_id: e.session_id ?? null,
    user_id: e.user_id ?? null,
    event_type: e.event_type,
    protocol: e.protocol ?? null,
    details: (e.details ?? {}) as import('@/integrations/supabase/types').Json,
    ip_address: e.ip_address ?? null,
    user_agent: e.user_agent ?? null,
    success: e.success,
    error_message: e.error_message ?? null,
  }));

  const { error } = await supabase
    .from('federation_audit_logs')
    .insert(rows);

  if (error) {
    console.error('[UIFE:Audit] Flush failed:', error.message);
    // Re-queue failed events
    eventBuffer.push(...batch);
  }
}

function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushBuffer().catch(console.error);
  }, FLUSH_INTERVAL_MS);
}

export function createFederationAuditLogger(): FederationAuditLoggerAPI {
  ensureFlushTimer();

  return {
    async log(event) {
      eventBuffer.push(event);
      if (eventBuffer.length >= BUFFER_THRESHOLD) {
        await flushBuffer();
      }
    },

    async query(tenantId, filters) {
      let query = supabase
        .from('federation_audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(filters?.limit ?? 100);

      if (filters?.event_type) query = query.eq('event_type', filters.event_type);
      if (filters?.user_id) query = query.eq('user_id', filters.user_id);
      if (filters?.idp_config_id) query = query.eq('idp_config_id', filters.idp_config_id);
      if (filters?.session_id) query = query.eq('session_id', filters.session_id);
      if (filters?.success !== undefined) query = query.eq('success', filters.success);
      if (filters?.from) query = query.gte('created_at', filters.from);
      if (filters?.to) query = query.lte('created_at', filters.to);

      const { data, error } = await query;
      if (error) {
        console.error('[UIFE:Audit] query failed:', error.message);
        return [];
      }
      return (data ?? []) as unknown as FederationAuditEntry[];
    },

    async getSessionEvents(sessionId) {
      const { data, error } = await supabase
        .from('federation_audit_logs')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[UIFE:Audit] getSessionEvents failed:', error.message);
        return [];
      }
      return (data ?? []) as unknown as FederationAuditEntry[];
    },
  };
}
