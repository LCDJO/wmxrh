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
 * ╔══════════════════════════════════════════════════════════╗
 * ║  SECURITY: Every operation goes through SecurityKernel  ║
 * ║  - tenant_id derived from SecurityContext (never FE)     ║
 * ║  - company scope validated via pipeline                  ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { supabase } from '@/integrations/supabase/client';
import { applyScope } from '@/domains/shared/scoped-query';
import type { QueryScope } from '@/domains/shared/scoped-query';
import type { ESocialEnvelope, TransmissionStatus, ESocialDashboardStats, ESocialCategory } from './types';
import { generateFromDomainEvent } from './event-generator';
import { validateEnvelope, transitionEnvelope, computeBatchStats } from './transmission-controller';
import type { InboundDomainEvent } from './types';
import { executeSecurityPipeline, requirePermission, type PipelineInput } from '@/domains/security/kernel/security-pipeline';
import { scopedInsertFromContext, buildQueryScope } from '@/domains/security/kernel/scope-resolver';
import type { SecurityContext } from '@/domains/security/kernel/identity.service';

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
// SECURITY HELPERS
// ════════════════════════════════════

/**
 * Build a PipelineInput for eSocial operations.
 * Ensures tenant_id + company scope are validated.
 */
function buildPipelineInput(
  ctx: SecurityContext,
  action: PipelineInput['action'],
  companyId?: string | null,
): PipelineInput {
  return {
    action,
    resource: 'esocial_events',
    ctx,
    target: companyId ? { company_id: companyId } : undefined,
    guardTarget: {
      tenantId: ctx.tenant_id,
      companyId: companyId ?? undefined,
    },
  };
}

// ════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════

export const esocialEngineService = {
  /**
   * Process an inbound domain event: validate security, generate envelope, persist.
   *
   * tenant_id is ALWAYS derived from SecurityContext, never from the event payload.
   */
  async processEvent(
    event: InboundDomainEvent,
    ctx: SecurityContext,
  ): Promise<ESocialEnvelope | null> {
    // ── Security: validate tenant + company scope ──
    requirePermission(buildPipelineInput(ctx, 'create', event.company_id));

    // Override tenant_id from SecurityContext (never trust frontend)
    const securedEvent: InboundDomainEvent = {
      ...event,
      tenant_id: ctx.tenant_id,
    };

    const envelope = generateFromDomainEvent(securedEvent);
    if (!envelope) return null;

    // Inject tenant_id from ctx into envelope
    const securedEnvelope: ESocialEnvelope = {
      ...envelope,
      tenant_id: ctx.tenant_id,
    };

    // Validate
    const validation = validateEnvelope(securedEnvelope);
    const finalEnvelope = validation.valid
      ? { ...securedEnvelope, status: 'validated' as TransmissionStatus, validated_at: new Date().toISOString() }
      : securedEnvelope;

    // Persist — tenant_id from ctx
    const row = scopedInsertFromContext(envelopeToRow(finalEnvelope), ctx);
    const { data, error } = await supabase
      .from('esocial_events')
      .insert([row as any])
      .select()
      .single();

    if (error) throw error;
    return rowToEnvelope(data);
  },

  /**
   * List envelopes with SecurityKernel scope filtering.
   * tenant_id derived from SecurityContext.
   */
  async listEnvelopes(
    ctx: SecurityContext,
    scope: QueryScope,
    opts?: {
      status?: string;
      category?: string;
      event_type?: string;
      limit?: number;
    },
  ): Promise<ESocialEnvelope[]> {
    // ── Security: validate read access ──
    requirePermission(buildPipelineInput(ctx, 'view'));

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
   * Get dashboard stats (read-only, skip policy for performance).
   */
  async getDashboardStats(ctx: SecurityContext, scope: QueryScope): Promise<ESocialDashboardStats> {
    // ── Security: validate read access (skip policy for perf) ──
    const pipelineResult = executeSecurityPipeline({
      ...buildPipelineInput(ctx, 'view'),
      skipPolicy: true,
      skipAudit: true,
    });
    if (pipelineResult.decision === 'deny') {
      throw new Error(pipelineResult.reason || 'Acesso negado ao dashboard eSocial.');
    }

    const envelopes = await this.listEnvelopes(ctx, scope, { limit: 1000 });
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
   * Validates that the user has update permission on the envelope's company scope.
   */
  async updateStatus(
    id: string,
    newStatus: TransmissionStatus,
    ctx: SecurityContext,
    meta?: {
      receipt_number?: string;
      error_message?: string;
      company_id?: string;
    },
  ): Promise<void> {
    // ── Security: validate update + company scope ──
    requirePermission(buildPipelineInput(ctx, 'update', meta?.company_id));

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
  async cancel(id: string, ctx: SecurityContext, companyId?: string): Promise<void> {
    await this.updateStatus(id, 'cancelled', ctx, { company_id: companyId });
  },

  /**
   * Queue validated envelopes for transmission.
   */
  async queueValidated(ctx: SecurityContext, scope: QueryScope): Promise<number> {
    // ── Security: validate update permission ──
    requirePermission(buildPipelineInput(ctx, 'update'));

    const envelopes = await this.listEnvelopes(ctx, scope, { status: 'pending' });
    let queued = 0;
    for (const env of envelopes) {
      if (env.status === 'validated' || env.status === 'draft') {
        const validation = validateEnvelope(env);
        if (validation.valid) {
          await this.updateStatus(env.id, 'queued', ctx, { company_id: env.company_id ?? undefined });
          queued++;
        }
      }
    }
    return queued;
  },
};
