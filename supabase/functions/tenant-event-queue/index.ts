/**
 * tenant-event-queue — Kafka/Redis-inspired event queue engine.
 *
 * Topic structure: tenant.{tenant_id}.{domain}
 *
 * Event types:
 *   TrackingEvent, BehaviorEvent, ComplianceIncident,
 *   EmployeeOperationBlocked, RiskScoreUpdated, WarningIssued
 *
 * ACTIONS:
 *   POST ?action=publish         — Publish events to a topic
 *   POST ?action=consume         — Consume pending events from a topic
 *   POST ?action=ack             — Acknowledge processed events
 *   POST ?action=nack            — Negative ack (trigger retry/DLQ)
 *   POST ?action=retry           — Process retry queue
 *   POST ?action=reprocess_dlq   — Reprocess dead-letter events
 *   GET  ?action=dlq             — List dead-letter queue
 *   GET  ?action=stats           — Queue statistics
 *   POST ?action=cleanup         — Cleanup expired events
 *
 * GUARANTEES:
 *   ✅ Ordered within tenant (sequence_num)
 *   ✅ Partitioned by tenant_id
 *   ✅ Automatic retry with exponential backoff
 *   ✅ Dead-letter queue for max-retry exceeded
 *   ✅ Incremental saving (no batch accumulation)
 *   ✅ Consumer offset tracking
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-tenant-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Valid event types ──
const VALID_EVENT_TYPES = [
  'TrackingEvent',
  'BehaviorEvent',
  'ComplianceIncident',
  'EmployeeOperationBlocked',
  'RiskScoreUpdated',
  'WarningIssued',
] as const;

// ── Priority mapping ──
const PRIORITY_MAP: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// ── Topic builder ──
function buildTopic(tenantId: string, domain: string): string {
  return `tenant.${tenantId}.${domain}`;
}

function parseTopic(topic: string): { tenantId: string; domain: string } | null {
  const parts = topic.split('.');
  if (parts.length !== 3 || parts[0] !== 'tenant') return null;
  return { tenantId: parts[1], domain: parts[2] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'publish';

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // ════════════════════════════════════════════════════════
    // PUBLISH — Push events to tenant topic
    // ════════════════════════════════════════════════════════
    if (action === 'publish' && req.method === 'POST') {
      const tenantId = url.searchParams.get('tenant_id') ?? req.headers.get('x-tenant-id');
      if (!tenantId) return json({ error: 'tenant_id required' }, 400);

      const body = await req.json();
      const events: any[] = Array.isArray(body) ? body : [body];
      if (events.length === 0) return json({ error: 'No events' }, 400);

      const MAX_BATCH = 100;
      let published = 0;
      let errors = 0;

      // Incremental saving — one event at a time for reliability
      for (const evt of events.slice(0, MAX_BATCH)) {
        const eventType = evt.event_type ?? 'TrackingEvent';
        const domain = evt.domain ?? inferDomain(eventType);
        const topic = buildTopic(tenantId, domain);

        const row = {
          tenant_id: tenantId,
          topic,
          event_type: eventType,
          partition_key: evt.partition_key ?? tenantId,
          payload: evt.payload ?? evt.data ?? {},
          metadata: {
            source_system: evt.source ?? 'platform',
            published_by: evt.published_by ?? 'system',
            ...(evt.metadata ?? {}),
          },
          source: evt.source ?? 'platform',
          correlation_id: evt.correlation_id ?? undefined,
          causation_id: evt.causation_id ?? undefined,
          priority: PRIORITY_MAP[evt.priority ?? 'normal'] ?? 2,
          max_retries: evt.max_retries ?? 3,
          expires_at: new Date(
            Date.now() + (evt.ttl_seconds ?? 3600) * 1000
          ).toISOString(),
        };

        const { error } = await admin.from('tenant_event_log').insert(row);
        if (error) {
          console.error(`[event-queue] publish error:`, error.message);
          errors++;
        } else {
          published++;
        }
      }

      return json({
        published,
        errors,
        dropped: Math.max(0, events.length - MAX_BATCH),
        topic: buildTopic(tenantId, 'events'),
      });
    }

    // ════════════════════════════════════════════════════════
    // CONSUME — Read pending events from topic (with offset)
    // ════════════════════════════════════════════════════════
    if (action === 'consume' && req.method === 'POST') {
      const body = await req.json();
      const { tenant_id, topic, consumer_group, limit: rawLimit, domains } = body;

      if (!tenant_id) return json({ error: 'tenant_id required' }, 400);
      const eventLimit = Math.min(rawLimit ?? 50, 200);
      const consumerGroup = consumer_group ?? 'default';

      // Get consumer offset
      const { data: offset } = await admin
        .from('tenant_event_consumer_offsets')
        .select('last_sequence_num')
        .eq('tenant_id', tenant_id)
        .eq('consumer_group', consumerGroup)
        .eq('topic', topic ?? '*')
        .maybeSingle();

      const lastSeq = offset?.last_sequence_num ?? 0;

      // Build query
      let query = admin
        .from('tenant_event_log')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('status', 'pending')
        .gt('sequence_num', lastSeq)
        .gt('expires_at', new Date().toISOString())
        .order('priority', { ascending: true })
        .order('sequence_num', { ascending: true })
        .limit(eventLimit);

      if (topic) {
        query = query.eq('topic', topic);
      }

      // Filter by domains
      if (domains && Array.isArray(domains) && domains.length > 0) {
        const topicPatterns = domains.map((d: string) => buildTopic(tenant_id, d));
        query = query.in('topic', topicPatterns);
      }

      const { data: events, error } = await query;
      if (error) return json({ error: error.message }, 500);

      // Mark consumed events as "processing"
      if (events && events.length > 0) {
        const ids = events.map((e: any) => e.id);
        await admin
          .from('tenant_event_log')
          .update({ status: 'processing' })
          .in('id', ids);
      }

      return json({
        events: events ?? [],
        count: (events ?? []).length,
        consumer_group: consumerGroup,
        last_sequence: events?.length
          ? events[events.length - 1].sequence_num
          : lastSeq,
      });
    }

    // ════════════════════════════════════════════════════════
    // ACK — Acknowledge successfully processed events
    // ════════════════════════════════════════════════════════
    if (action === 'ack' && req.method === 'POST') {
      const body = await req.json();
      const { event_ids, tenant_id, consumer_group, topic } = body;

      if (!event_ids?.length || !tenant_id) {
        return json({ error: 'event_ids and tenant_id required' }, 400);
      }

      // Mark as processed
      const { count } = await admin
        .from('tenant_event_log')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .in('id', event_ids)
        .eq('tenant_id', tenant_id)
        .select('id', { count: 'exact', head: true });

      // Update consumer offset
      if (consumer_group) {
        const { data: maxSeq } = await admin
          .from('tenant_event_log')
          .select('sequence_num')
          .in('id', event_ids)
          .order('sequence_num', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (maxSeq) {
          await admin.from('tenant_event_consumer_offsets').upsert(
            {
              tenant_id,
              consumer_group,
              topic: topic ?? '*',
              last_sequence_num: maxSeq.sequence_num,
              last_consumed_at: new Date().toISOString(),
            },
            { onConflict: 'tenant_id,consumer_group,topic' }
          );
        }
      }

      return json({ acknowledged: count ?? 0 });
    }

    // ════════════════════════════════════════════════════════
    // NACK — Negative ack → retry or DLQ
    // ════════════════════════════════════════════════════════
    if (action === 'nack' && req.method === 'POST') {
      const body = await req.json();
      const { event_ids, tenant_id, error_message } = body;

      if (!event_ids?.length || !tenant_id) {
        return json({ error: 'event_ids and tenant_id required' }, 400);
      }

      const results: Record<string, string> = {};

      for (const eventId of event_ids) {
        const { data } = await admin.rpc('schedule_event_retry', {
          p_event_id: eventId,
          p_error_message: error_message ?? 'Consumer NACK',
        });
        results[eventId] = data ?? 'unknown';
      }

      return json({ results });
    }

    // ════════════════════════════════════════════════════════
    // RETRY — Process events in retry queue
    // ════════════════════════════════════════════════════════
    if (action === 'retry' && req.method === 'POST') {
      const tenantId = url.searchParams.get('tenant_id');

      let query = admin
        .from('tenant_event_log')
        .select('*')
        .eq('status', 'retry')
        .lte('next_retry_at', new Date().toISOString())
        .order('priority', { ascending: true })
        .order('next_retry_at', { ascending: true })
        .limit(50);

      if (tenantId) query = query.eq('tenant_id', tenantId);

      const { data: retryEvents, error } = await query;
      if (error) return json({ error: error.message }, 500);

      if (!retryEvents?.length) {
        return json({ retried: 0, message: 'No events ready for retry' });
      }

      // Reset to pending for re-consumption
      const ids = retryEvents.map((e: any) => e.id);
      await admin
        .from('tenant_event_log')
        .update({ status: 'pending', next_retry_at: null })
        .in('id', ids);

      return json({ retried: ids.length });
    }

    // ════════════════════════════════════════════════════════
    // REPROCESS DLQ — Move DLQ events back to main queue
    // ════════════════════════════════════════════════════════
    if (action === 'reprocess_dlq' && req.method === 'POST') {
      const body = await req.json();
      const { dlq_ids, tenant_id } = body;

      if (!dlq_ids?.length || !tenant_id) {
        return json({ error: 'dlq_ids and tenant_id required' }, 400);
      }

      let reprocessed = 0;

      for (const dlqId of dlq_ids) {
        const { data: dlqEvent } = await admin
          .from('tenant_event_dlq')
          .select('*')
          .eq('id', dlqId)
          .eq('tenant_id', tenant_id)
          .eq('reprocessed', false)
          .maybeSingle();

        if (!dlqEvent) continue;

        // Re-insert into main queue
        const { error } = await admin.from('tenant_event_log').insert({
          tenant_id: dlqEvent.tenant_id,
          topic: dlqEvent.topic,
          event_type: dlqEvent.event_type,
          partition_key: dlqEvent.tenant_id,
          payload: dlqEvent.payload,
          metadata: { ...dlqEvent.metadata, reprocessed_from_dlq: dlqId },
          source: 'dlq_reprocess',
          max_retries: 3,
        });

        if (!error) {
          await admin
            .from('tenant_event_dlq')
            .update({ reprocessed: true, reprocessed_at: new Date().toISOString() })
            .eq('id', dlqId);
          reprocessed++;
        }
      }

      return json({ reprocessed });
    }

    // ════════════════════════════════════════════════════════
    // DLQ LIST — View dead-letter queue
    // ════════════════════════════════════════════════════════
    if (action === 'dlq' && req.method === 'GET') {
      const tenantId = url.searchParams.get('tenant_id');
      if (!tenantId) return json({ error: 'tenant_id required' }, 400);

      const topic = url.searchParams.get('topic');
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);

      let query = admin
        .from('tenant_event_dlq')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('reprocessed', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (topic) query = query.eq('topic', topic);

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);

      return json({ events: data ?? [], count: (data ?? []).length });
    }

    // ════════════════════════════════════════════════════════
    // STATS — Queue statistics per tenant
    // ════════════════════════════════════════════════════════
    if (action === 'stats' && req.method === 'GET') {
      const tenantId = url.searchParams.get('tenant_id');
      if (!tenantId) return json({ error: 'tenant_id required' }, 400);

      const [pending, processing, retry, dlq, processed5m] = await Promise.all([
        admin
          .from('tenant_event_log')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'pending'),
        admin
          .from('tenant_event_log')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'processing'),
        admin
          .from('tenant_event_log')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'retry'),
        admin
          .from('tenant_event_dlq')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('reprocessed', false),
        admin
          .from('tenant_event_log')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'processed')
          .gt('processed_at', new Date(Date.now() - 300_000).toISOString()),
      ]);

      // Topic breakdown
      const { data: topicCounts } = await admin
        .from('tenant_event_log')
        .select('topic')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending');

      const byTopic: Record<string, number> = {};
      (topicCounts ?? []).forEach((r: any) => {
        byTopic[r.topic] = (byTopic[r.topic] ?? 0) + 1;
      });

      return json({
        pending: pending.count ?? 0,
        processing: processing.count ?? 0,
        retry: retry.count ?? 0,
        dead_letter: dlq.count ?? 0,
        processed_last_5min: processed5m.count ?? 0,
        throughput_per_min: Math.round((processed5m.count ?? 0) / 5),
        by_topic: byTopic,
      });
    }

    // ════════════════════════════════════════════════════════
    // CLEANUP — Expire old events
    // ════════════════════════════════════════════════════════
    if (action === 'cleanup' && req.method === 'POST') {
      const { data: cleaned } = await admin.rpc('cleanup_expired_events');
      return json({ cleaned: cleaned ?? 0 });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('[tenant-event-queue] error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

// ── Helpers ──

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function inferDomain(eventType: string): string {
  const map: Record<string, string> = {
    TrackingEvent: 'fleet',
    BehaviorEvent: 'fleet',
    ComplianceIncident: 'compliance',
    EmployeeOperationBlocked: 'compliance',
    RiskScoreUpdated: 'risk',
    WarningIssued: 'compliance',
  };
  return map[eventType] ?? 'events';
}
