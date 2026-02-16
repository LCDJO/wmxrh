/**
 * eSocial Engine Service — Application Layer
 *
 * Orchestrates the full lifecycle:
 *   1. Receive domain events
 *   2. Generate envelopes via layout mappers
 *   3. Validate payloads
 *   4. Persist to esocial_events table
 *   5. Track status transitions
 *
 * Uses the existing esocial_events table as persistence.
 * Decoupled from HR Core — only consumes InboundDomainEvents.
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { ESocialEnvelope, TransmissionStatus, ESocialDashboardStats, ESocialCategory } from './types';
import { generateFromDomainEvent } from './event-generator';
import { validateEnvelope, transitionEnvelope, computeBatchStats } from './transmission-controller';
import type { InboundDomainEvent } from './types';

// ════════════════════════════════════
// ENVELOPE PERSISTENCE (via esocial_events table)
// ════════════════════════════════════

function envelopeToRow(env: ESocialEnvelope) {
  return {
    tenant_id: env.tenant_id,
    company_id: env.company_id,
    event_type: env.event_type,
    category: env.category,
    payload: env.payload,
    entity_type: env.source_entity_type,
    entity_id: env.source_entity_id,
    status: mapStatusToDb(env.status),
    receipt_number: env.receipt_number,
    error_message: env.error_message,
    retry_count: env.retry_count,
    response_payload: env.response_payload,
    effective_date: env.created_at.slice(0, 10),
  };
}

/** Map engine status → DB enum */
function mapStatusToDb(status: TransmissionStatus): string {
  const map: Record<TransmissionStatus, string> = {
    draft: 'pending',
    validated: 'pending',
    queued: 'processing',
    transmitting: 'processing',
    accepted: 'accepted',
    rejected: 'rejected',
    error: 'error',
    cancelled: 'cancelled',
  };
  return map[status] || 'pending';
}

/** Map DB status → engine status */
function mapStatusFromDb(dbStatus: string): TransmissionStatus {
  const map: Record<string, TransmissionStatus> = {
    pending: 'draft',
    processing: 'queued',
    sent: 'transmitting',
    accepted: 'accepted',
    rejected: 'rejected',
    error: 'error',
    cancelled: 'cancelled',
  };
  return map[dbStatus] || 'draft';
}

function rowToEnvelope(row: any): ESocialEnvelope {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    company_id: row.company_id,
    event_type: row.event_type,
    category: row.category,
    layout_version: 'S-1.2',
    payload: row.payload || {},
    source_entity_type: row.entity_type || '',
    source_entity_id: row.entity_id || '',
    status: mapStatusFromDb(row.status),
    receipt_number: row.receipt_number,
    error_message: row.error_message,
    error_code: null,
    retry_count: row.retry_count || 0,
    response_payload: row.response_payload,
    validated_at: null,
    queued_at: null,
    transmitted_at: row.sent_at,
    accepted_at: row.processed_at,
    created_at: row.created_at,
  };
}

// ════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════

export const esocialEngineService = {
  /**
   * Process an inbound domain event: generate envelope, validate, persist.
   */
  async processEvent(event: InboundDomainEvent): Promise<ESocialEnvelope | null> {
    const envelope = generateFromDomainEvent(event);
    if (!envelope) return null;

    // Validate
    const validation = validateEnvelope(envelope);
    const finalEnvelope = validation.valid
      ? { ...envelope, status: 'validated' as TransmissionStatus, validated_at: new Date().toISOString() }
      : envelope; // Stay as draft if invalid

    // Persist
    const row = envelopeToRow(finalEnvelope);
    const { data, error } = await supabase
      .from('esocial_events')
      .insert([row as any])
      .select()
      .single();

    if (error) throw error;
    return rowToEnvelope(data);
  },

  /**
   * List envelopes with scope filtering.
   */
  async listEnvelopes(scope: QueryScope, opts?: {
    status?: string;
    category?: string;
    event_type?: string;
    limit?: number;
  }): Promise<ESocialEnvelope[]> {
    let q = applyScope(
      supabase.from('esocial_events').select('*'),
      scope,
      { skipSoftDelete: true },
    ).order('created_at', { ascending: false });

    if (opts?.status) q = q.eq('status', opts.status as any);
    if (opts?.category) q = q.eq('category', opts.category as any);
    if (opts?.event_type) q = q.eq('event_type', opts.event_type);
    q = q.limit(opts?.limit ?? 200);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(rowToEnvelope);
  },

  /**
   * Get dashboard stats.
   */
  async getDashboardStats(scope: QueryScope): Promise<ESocialDashboardStats> {
    const envelopes = await this.listEnvelopes(scope, { limit: 1000 });
    const stats = computeBatchStats(envelopes);

    const lastAccepted = envelopes
      .filter(e => e.status === 'accepted')
      .sort((a, b) => b.accepted_at!.localeCompare(a.accepted_at!))[0];

    return {
      total_events: stats.total,
      by_status: stats.by_status as Record<TransmissionStatus, number>,
      by_category: stats.by_category as Record<ESocialCategory, number>,
      pending_count: stats.pending,
      error_count: stats.errors,
      accepted_rate: stats.total > 0 ? (stats.accepted / stats.total) * 100 : 0,
      last_transmission_at: lastAccepted?.accepted_at ?? null,
    };
  },

  /**
   * Transition an envelope to a new status.
   */
  async updateStatus(id: string, newStatus: TransmissionStatus, meta?: {
    receipt_number?: string;
    error_message?: string;
  }): Promise<void> {
    const update: Record<string, unknown> = { status: mapStatusToDb(newStatus) };
    if (newStatus === 'accepted' || newStatus === 'rejected') {
      update.processed_at = new Date().toISOString();
    }
    if (newStatus === 'transmitting') {
      update.sent_at = new Date().toISOString();
    }
    if (meta?.receipt_number) update.receipt_number = meta.receipt_number;
    if (meta?.error_message) update.error_message = meta.error_message;

    const { error } = await supabase
      .from('esocial_events')
      .update(update)
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Cancel an envelope.
   */
  async cancel(id: string): Promise<void> {
    await this.updateStatus(id, 'cancelled');
  },

  /**
   * Queue validated envelopes for transmission.
   */
  async queueValidated(scope: QueryScope): Promise<number> {
    const envelopes = await this.listEnvelopes(scope, { status: 'pending' });
    let queued = 0;
    for (const env of envelopes) {
      if (env.status === 'validated' || env.status === 'draft') {
        // Re-validate before queuing
        const validation = validateEnvelope(env);
        if (validation.valid) {
          await this.updateStatus(env.id, 'queued');
          queued++;
        }
      }
    }
    return queued;
  },
};
