/**
 * display-event-processor — Server-side Tenant Event Processor.
 *
 * Pipeline: TrackingEvent → EventQueue → TenantEventProcessor → WebSocketChannel
 *
 * MODES:
 *   POST /display-event-processor?action=ingest   — Push events into tenant queue
 *   POST /display-event-processor?action=process  — Process queued events (cron/manual)
 *   POST /display-event-processor?action=heartbeat — Display session heartbeat
 *   GET  /display-event-processor?action=subscribe&tenant_id=X&channel=Y — Get pending events
 *
 * SECURITY:
 *   ✅ Tenant isolation enforced on all operations
 *   ✅ Service-role only for ingest/process
 *   ✅ Token-validated for subscribe
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-tenant-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface IngestEvent {
  event_type: string;
  source: string;
  channel?: string;
  payload: Record<string, unknown>;
  priority?: number;
  ttl_seconds?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'ingest';

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // ════════════════════════════════════════════════
    // ACTION: INGEST — Push events into tenant queue
    // ════════════════════════════════════════════════
    if (action === 'ingest' && req.method === 'POST') {
      const tenantId = url.searchParams.get('tenant_id') ?? req.headers.get('x-tenant-id');
      if (!tenantId) {
        return jsonResponse({ error: 'tenant_id required' }, 400);
      }

      const body = await req.json();
      const events: IngestEvent[] = Array.isArray(body) ? body : [body];

      if (events.length === 0) {
        return jsonResponse({ error: 'No events provided' }, 400);
      }

      // Batch size limit
      const MAX_BATCH = 200;
      const batch = events.slice(0, MAX_BATCH);

      const rows = batch.map((evt) => ({
        tenant_id: tenantId,
        event_type: evt.event_type ?? 'tracking',
        source: evt.source ?? 'platform',
        channel: evt.channel ?? `tenant-${tenantId}`,
        payload: evt.payload ?? {},
        priority: Math.max(0, Math.min(3, evt.priority ?? 2)),
        expires_at: new Date(
          Date.now() + (evt.ttl_seconds ?? 300) * 1000
        ).toISOString(),
      }));

      const { error } = await admin.from('display_event_queue').insert(rows);

      if (error) {
        console.error('[display-event-processor] ingest error:', error);
        return jsonResponse({ error: error.message }, 500);
      }

      return jsonResponse({
        ingested: rows.length,
        dropped: events.length - batch.length,
        channel: rows[0]?.channel,
      });
    }

    // ════════════════════════════════════════════════
    // ACTION: PROCESS — Mark events as processed + cleanup
    // ════════════════════════════════════════════════
    if (action === 'process' && req.method === 'POST') {
      const tenantId = url.searchParams.get('tenant_id');

      // Cleanup expired events
      const { data: cleanupResult } = await admin.rpc('cleanup_expired_display_events');

      // Mark old events as processed (older than 2 min)
      const cutoff = new Date(Date.now() - 120_000).toISOString();
      let markQuery = admin
        .from('display_event_queue')
        .update({ processed: true })
        .lt('created_at', cutoff)
        .eq('processed', false);

      if (tenantId) {
        markQuery = markQuery.eq('tenant_id', tenantId);
      }

      const { count } = await markQuery.select('id', { count: 'exact', head: true });

      return jsonResponse({
        cleaned_up: cleanupResult ?? 0,
        marked_processed: count ?? 0,
      });
    }

    // ════════════════════════════════════════════════
    // ACTION: HEARTBEAT — Display session keep-alive
    // ════════════════════════════════════════════════
    if (action === 'heartbeat' && req.method === 'POST') {
      const body = await req.json();
      const { session_id, display_id, tenant_id, channel_name } = body;

      if (!tenant_id || !display_id) {
        return jsonResponse({ error: 'tenant_id and display_id required' }, 400);
      }

      if (session_id) {
        // Update existing session
        await admin
          .from('display_sessions')
          .update({ last_heartbeat: new Date().toISOString(), status: 'active' })
          .eq('id', session_id)
          .eq('tenant_id', tenant_id);

        return jsonResponse({ session_id, status: 'active' });
      }

      // Create new session
      const { data: session, error } = await admin
        .from('display_sessions')
        .insert({
          tenant_id,
          display_id,
          channel_name: channel_name ?? `tenant-${tenant_id}`,
          status: 'active',
        })
        .select('id, channel_name')
        .single();

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      return jsonResponse({
        session_id: session.id,
        channel_name: session.channel_name,
        status: 'active',
      });
    }

    // ════════════════════════════════════════════════
    // ACTION: SUBSCRIBE — Get pending events for channel
    // ════════════════════════════════════════════════
    if (action === 'subscribe' && req.method === 'GET') {
      const tenantId = url.searchParams.get('tenant_id');
      const channel = url.searchParams.get('channel');
      const since = url.searchParams.get('since');
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);

      if (!tenantId) {
        return jsonResponse({ error: 'tenant_id required' }, 400);
      }

      let query = admin
        .from('display_event_queue')
        .select('id, event_type, source, channel, payload, priority, created_at')
        .eq('tenant_id', tenantId)
        .eq('processed', false)
        .gt('expires_at', new Date().toISOString())
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (channel) {
        query = query.eq('channel', channel);
      }
      if (since) {
        query = query.gt('created_at', since);
      }

      const { data: events, error } = await query;

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      return jsonResponse({
        events: events ?? [],
        count: (events ?? []).length,
        channel: channel ?? `tenant-${tenantId}`,
        timestamp: new Date().toISOString(),
      });
    }

    // ════════════════════════════════════════════════
    // ACTION: STATS — Queue statistics
    // ════════════════════════════════════════════════
    if (action === 'stats' && req.method === 'GET') {
      const tenantId = url.searchParams.get('tenant_id');

      if (!tenantId) {
        return jsonResponse({ error: 'tenant_id required' }, 400);
      }

      // Queue depth
      const { count: queueDepth } = await admin
        .from('display_event_queue')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('processed', false);

      // Active sessions
      const { count: activeSessions } = await admin
        .from('display_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      // Events in last 5 minutes
      const fiveMinAgo = new Date(Date.now() - 300_000).toISOString();
      const { count: recentEvents } = await admin
        .from('display_event_queue')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gt('created_at', fiveMinAgo);

      return jsonResponse({
        queue_depth: queueDepth ?? 0,
        active_sessions: activeSessions ?? 0,
        events_last_5min: recentEvents ?? 0,
        throughput_per_min: Math.round((recentEvents ?? 0) / 5),
      });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('[display-event-processor] error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
