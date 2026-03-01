/**
 * GovernanceCoreEngine — Event Store Repository
 *
 * Append-only persistence backed by the governance_events table.
 * Reads support aggregate replay and type-based queries.
 */

import { supabase } from '@/integrations/supabase/client';
import type { GovernanceDomainEvent } from '../events/governance-domain-event';
import type { Json } from '@/integrations/supabase/types';
import { dispatchGovernanceEvents } from '../events/governance-event-bus';

export class GovernanceEventStore {
  /** Append events (single transaction). Dispatches after success. */
  async append(events: GovernanceDomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    const rows = events.map(e => ({
      id: e.id,
      tenant_id: e.metadata.tenant_id,
      aggregate_type: e.aggregate_type,
      aggregate_id: e.aggregate_id,
      event_type: e.event_type,
      event_version: e.event_version,
      payload: JSON.parse(JSON.stringify(e.payload)) as Json,
      metadata: JSON.parse(JSON.stringify(e.metadata)) as Json,
      occurred_at: e.occurred_at,
    }));

    const { error } = await supabase.from('governance_events').insert(rows);
    if (error) throw new Error(`[GovernanceEventStore] append failed: ${error.message}`);

    // Fire-and-forget dispatch to in-process handlers
    dispatchGovernanceEvents(events).catch(console.error);
  }

  /** Load all events for an aggregate (ordered by occurred_at). */
  async loadStream(
    tenantId: string,
    aggregateType: string,
    aggregateId: string,
  ): Promise<GovernanceDomainEvent[]> {
    const { data, error } = await supabase
      .from('governance_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('aggregate_type', aggregateType)
      .eq('aggregate_id', aggregateId)
      .order('occurred_at', { ascending: true });

    if (error) throw new Error(`[GovernanceEventStore] loadStream failed: ${error.message}`);
    return (data ?? []).map(row => this.toEvent(row));
  }

  /** Query events by type across all aggregates. */
  async queryByType(
    tenantId: string,
    eventType: string,
    opts?: { limit?: number; after?: string },
  ): Promise<GovernanceDomainEvent[]> {
    let query = supabase
      .from('governance_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('event_type', eventType)
      .order('occurred_at', { ascending: true })
      .limit(opts?.limit ?? 100);

    if (opts?.after) query = query.gt('occurred_at', opts.after);

    const { data, error } = await query;
    if (error) throw new Error(`[GovernanceEventStore] queryByType failed: ${error.message}`);
    return (data ?? []).map(row => this.toEvent(row));
  }

  /** Query all events for a tenant (paginated). */
  async queryAll(
    tenantId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<GovernanceDomainEvent[]> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;

    const { data, error } = await supabase
      .from('governance_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`[GovernanceEventStore] queryAll failed: ${error.message}`);
    return (data ?? []).map(row => this.toEvent(row));
  }

  private toEvent(row: Record<string, unknown>): GovernanceDomainEvent {
    return {
      id: row.id as string,
      aggregate_type: row.aggregate_type as string,
      aggregate_id: row.aggregate_id as string,
      event_type: row.event_type as string,
      event_version: row.event_version as number,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      metadata: (row.metadata ?? {}) as GovernanceDomainEvent['metadata'],
      occurred_at: row.occurred_at as string,
    };
  }
}
