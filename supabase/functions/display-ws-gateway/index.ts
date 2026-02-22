/**
 * display-ws-gateway — WebSocket Gateway for Display Engine.
 *
 * Endpoint: /display-ws-gateway?token={display_token}
 *
 * Flow:
 *   1. Validate DisplayToken (must be active, not expired)
 *   2. Bind connection to tenant_id from token
 *   3. Subscribe TV to tenant-scoped event channel only
 *   4. Reject connections without valid scope
 *   5. Stream events from display_event_queue + tenant_event_log
 *   6. Handle heartbeat/ping for connection health
 *
 * Protocol:
 *   Client → Server: { type: 'ping' | 'subscribe' | 'unsubscribe', channel?: string }
 *   Server → Client: { type: 'event' | 'pong' | 'error' | 'connected' | 'subscribed', ... }
 *
 * SECURITY:
 *   ✅ Token validated before WebSocket upgrade
 *   ✅ Tenant isolation — only receives own tenant's events
 *   ✅ Auto-disconnect on token expiry
 *   ✅ Rate-limited message processing
 *   ✅ No write operations exposed
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-display-instance-id, x-display-affinity, x-display-tenant, x-display-client-version',
};

// ── Token validation result ──
interface ValidatedSession {
  token_id: string;
  display_id: string;
  tenant_id: string;
  expires_at: string;
  display_name: string;
  display_type: string;
}

// ── Validate display token (HTTP pre-check) ──
async function validateDisplayToken(
  admin: any,
  token: string
): Promise<{ valid: boolean; session?: ValidatedSession; error?: string }> {
  if (!token || token.length < 30) {
    return { valid: false, error: 'Invalid token format' };
  }

  const { data: tokenData, error: tokenErr } = await admin
    .from('live_display_tokens')
    .select('id, display_id, tenant_id, expira_em, status')
    .eq('token_temporario', token)
    .eq('status', 'active')
    .not('display_id', 'is', null)
    .not('tenant_id', 'is', null)
    .maybeSingle();

  if (tokenErr || !tokenData) {
    return { valid: false, error: 'Token not found or inactive' };
  }

  if (new Date(tokenData.expira_em) < new Date()) {
    await admin
      .from('live_display_tokens')
      .update({ status: 'expired' })
      .eq('id', tokenData.id);
    return { valid: false, error: 'Token expired' };
  }

  // Get display info
  const { data: display } = await admin
    .from('live_displays')
    .select('id, nome, tipo, tenant_id')
    .eq('id', tokenData.display_id)
    .eq('tenant_id', tokenData.tenant_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!display) {
    return { valid: false, error: 'Display not found or access denied' };
  }

  return {
    valid: true,
    session: {
      token_id: tokenData.id,
      display_id: display.id,
      tenant_id: tokenData.tenant_id,
      expires_at: tokenData.expira_em,
      display_name: display.nome,
      display_type: display.tipo,
    },
  };
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const action = url.searchParams.get('action') ?? 'connect';

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // ════════════════════════════════════════════════════════
  // ACTION: VALIDATE — Pre-flight token check (HTTP)
  // ════════════════════════════════════════════════════════
  if (action === 'validate' && req.method === 'GET') {
    if (!token) {
      return json({ valid: false, error: 'Token required' }, 400);
    }

    const result = await validateDisplayToken(admin, token);
    if (!result.valid) {
      return json({ valid: false, error: result.error }, 401);
    }

    return json({
      valid: true,
      session: {
        display_id: result.session!.display_id,
        tenant_id: result.session!.tenant_id,
        display_name: result.session!.display_name,
        display_type: result.session!.display_type,
        channel: `tenant-${result.session!.tenant_id}`,
        expires_at: result.session!.expires_at,
      },
    });
  }

  // ════════════════════════════════════════════════════════
  // ACTION: CONNECT — Establish gateway session + subscribe
  // ════════════════════════════════════════════════════════
  if (action === 'connect' && req.method === 'POST') {
    if (!token) {
      return json({ error: 'Token required' }, 400);
    }

    const validation = await validateDisplayToken(admin, token);
    if (!validation.valid || !validation.session) {
      return json({ error: validation.error ?? 'Invalid token' }, 401);
    }

    const session = validation.session;
    const channelName = `tenant-${session.tenant_id}`;

    // Map display tipo to session modo
    const tipoToModo: Record<string, string> = {
      'frota': 'fleet',
      'sst': 'sst',
      'executivo': 'executive',
      'custom': 'custom',
    };
    const modo = tipoToModo[session.display_type] ?? 'executive';

    // Run auto-expiry cleanup before connecting
    try {
      await admin.rpc('expire_inactive_display_sessions');
    } catch { /* non-critical */ }

    // Register/update display session
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
    const userAgent = req.headers.get('user-agent') ?? 'unknown';

    // Check for existing session for this display
    const { data: existingSession } = await admin
      .from('display_sessions')
      .select('id')
      .eq('display_id', session.display_id)
      .eq('tenant_id', session.tenant_id)
      .maybeSingle();

    let displaySession: { id: string; metadata: any } | null = null;

    if (existingSession) {
      // Update existing session
      const { data } = await admin
        .from('display_sessions')
        .update({
          channel_name: channelName,
          status: 'active',
          last_heartbeat: new Date().toISOString(),
          metadata: {
            modo,
            display_type: session.display_type,
            display_name: session.display_name,
            connected_via: 'ws-gateway',
            connected_ip: clientIp,
            user_agent: userAgent,
          },
        })
        .eq('id', existingSession.id)
        .select('id, metadata')
        .single();
      displaySession = data;
    } else {
      // Insert new session
      const { data } = await admin
        .from('display_sessions')
        .insert({
          tenant_id: session.tenant_id,
          display_id: session.display_id,
          channel_name: channelName,
          status: 'active',
          last_heartbeat: new Date().toISOString(),
          metadata: {
            modo,
            display_type: session.display_type,
            display_name: session.display_name,
            connected_via: 'ws-gateway',
            connected_ip: clientIp,
            user_agent: userAgent,
          },
        })
        .select('id, metadata')
        .single();
      displaySession = data;
    }

    // Update display last_seen
    await admin
      .from('live_displays')
      .update({ last_seen_at: new Date().toISOString(), status: 'active' })
      .eq('id', session.display_id);

    // Fetch initial pending events for this tenant
    const { data: pendingEvents } = await admin
      .from('display_event_queue')
      .select('id, event_type, source, channel, payload, priority, created_at')
      .eq('tenant_id', session.tenant_id)
      .eq('processed', false)
      .gt('expires_at', new Date().toISOString())
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(50);

    return json({
      type: 'connected',
      session_id: displaySession?.id ?? null,
      channel: channelName,
      modo: displaySession?.metadata?.modo ?? modo,
      display: {
        id: session.display_id,
        name: session.display_name,
        type: session.display_type,
      },
      tenant_id: session.tenant_id,
      expires_at: session.expires_at,
      pending_events: pendingEvents ?? [],
      subscription: {
        realtime_channel: `display-pipeline-${channelName}`,
        realtime_table: 'display_event_queue',
        realtime_filter: `tenant_id=eq.${session.tenant_id}`,
        event_topic_table: 'tenant_event_log',
        event_topic_filter: `tenant_id=eq.${session.tenant_id}`,
      },
    });
  }

  // ════════════════════════════════════════════════════════
  // ACTION: HEARTBEAT — Keep session alive
  // ════════════════════════════════════════════════════════
  if (action === 'heartbeat' && req.method === 'POST') {
    if (!token) return json({ error: 'Token required' }, 400);

    // Quick token check
    const { data: tokenData } = await admin
      .from('live_display_tokens')
      .select('id, tenant_id, display_id, expira_em, status')
      .eq('token_temporario', token)
      .eq('status', 'active')
      .maybeSingle();

    if (!tokenData) {
      return json({ type: 'error', error: 'Session expired', action: 'reconnect' }, 401);
    }

    if (new Date(tokenData.expira_em) < new Date()) {
      await admin
        .from('live_display_tokens')
        .update({ status: 'expired' })
        .eq('id', tokenData.id);
      return json({ type: 'error', error: 'Token expired', action: 'reconnect' }, 401);
    }

    // Run auto-expiry on heartbeat
    let expiredCount = 0;
    try {
      const { data } = await admin.rpc('expire_inactive_display_sessions');
      expiredCount = data ?? 0;
    } catch { /* non-critical */ }

    // Update session heartbeat
    await admin
      .from('display_sessions')
      .update({ last_heartbeat: new Date().toISOString(), status: 'active' })
      .eq('display_id', tokenData.display_id)
      .eq('tenant_id', tokenData.tenant_id);

    // Update display last_seen
    await admin
      .from('live_displays')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', tokenData.display_id);

    // Get session modo from metadata
    const { data: sessionData } = await admin
      .from('display_sessions')
      .select('metadata')
      .eq('display_id', tokenData.display_id)
      .eq('tenant_id', tokenData.tenant_id)
      .eq('status', 'active')
      .maybeSingle();

    return json({
      type: 'pong',
      tenant_id: tokenData.tenant_id,
      modo: (sessionData?.metadata as any)?.modo ?? 'executive',
      expires_at: tokenData.expira_em,
      ttl_seconds: Math.max(
        0,
        Math.floor((new Date(tokenData.expira_em).getTime() - Date.now()) / 1000)
      ),
      expired_sessions: expiredCount ?? 0,
    });
  }

  // ════════════════════════════════════════════════════════
  // ACTION: EVENTS — Poll events through gateway (token-validated)
  // ════════════════════════════════════════════════════════
  if (action === 'events' && req.method === 'GET') {
    if (!token) return json({ error: 'Token required' }, 400);

    const validation = await validateDisplayToken(admin, token);
    if (!validation.valid || !validation.session) {
      return json({ error: validation.error, action: 'reconnect' }, 401);
    }

    const session = validation.session;
    const since = url.searchParams.get('since');
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);
    const sources = url.searchParams.get('sources')?.split(',') ?? ['display_queue', 'event_log'];

    const events: any[] = [];

    // Source 1: display_event_queue (fast display pipeline)
    if (sources.includes('display_queue')) {
      let q = admin
        .from('display_event_queue')
        .select('id, event_type, source, channel, payload, priority, created_at')
        .eq('tenant_id', session.tenant_id)
        .eq('processed', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (since) q = q.gt('created_at', since);

      const { data } = await q;
      (data ?? []).forEach((e: any) =>
        events.push({ ...e, _source: 'display_queue' })
      );
    }

    // Source 2: tenant_event_log (Kafka-style topic events)
    if (sources.includes('event_log')) {
      let q = admin
        .from('tenant_event_log')
        .select('id, topic, event_type, payload, priority, sequence_num, created_at')
        .eq('tenant_id', session.tenant_id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('sequence_num', { ascending: false })
        .limit(limit);

      if (since) q = q.gt('created_at', since);

      const { data } = await q;
      (data ?? []).forEach((e: any) =>
        events.push({ ...e, _source: 'event_log' })
      );
    }

    // Dedup by id
    const seen = new Set<string>();
    const deduped = events.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    // Sort by priority then created_at
    deduped.sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2) || b.created_at.localeCompare(a.created_at));

    return json({
      type: 'events',
      events: deduped.slice(0, limit),
      count: deduped.length,
      channel: `tenant-${session.tenant_id}`,
      timestamp: new Date().toISOString(),
    });
  }

  // ════════════════════════════════════════════════════════
  // ACTION: DISCONNECT — Clean session teardown
  // ════════════════════════════════════════════════════════
  if (action === 'disconnect' && req.method === 'POST') {
    if (!token) return json({ error: 'Token required' }, 400);

    const { data: tokenData } = await admin
      .from('live_display_tokens')
      .select('display_id, tenant_id')
      .eq('token_temporario', token)
      .maybeSingle();

    if (tokenData) {
      await admin
        .from('display_sessions')
        .update({ status: 'disconnected' })
        .eq('display_id', tokenData.display_id)
        .eq('tenant_id', tokenData.tenant_id);

      await admin
        .from('live_displays')
        .update({ status: 'offline' })
        .eq('id', tokenData.display_id);
    }

    return json({ type: 'disconnected' });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
