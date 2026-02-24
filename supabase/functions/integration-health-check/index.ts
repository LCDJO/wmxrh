/**
 * integration-health-check — Runs all 6 health checks for Traccar integration per tenant.
 *
 * Checks:
 *  1. Server connection
 *  2. API authentication
 *  3. Device sync validation
 *  4. Event flow (last event received)
 *  5. Queue health (lag)
 *  6. Alert generation
 *
 * Computes health_score (0-100) and stores results.
 *
 * Modes:
 *  - POST { tenant_id } → check single tenant
 *  - POST { all: true }  → check all configured tenants
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckResult {
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  message: string;
  duration_ms?: number;
  details?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth: require platform admin or service role
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ') && !authHeader.includes(serviceKey)) {
      const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonClient.auth.getUser();
      if (!user) {
        return json({ error: 'Unauthorized' }, 401);
      }
      const { data: pu } = await supabase
        .from('platform_users')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!pu || !['platform_super_admin', 'platform_operations'].includes(pu.role)) {
        return json({ error: 'Forbidden: platform admin required' }, 403);
      }
    }

    const body = await req.json().catch(() => ({}));
    const checkAll = body.all === true;
    const singleTenantId = body.tenant_id as string | undefined;

    // Get tenants with Traccar configured
    let tenantIds: string[] = [];
    if (singleTenantId) {
      tenantIds = [singleTenantId];
    } else if (checkAll) {
      const { data: configs } = await supabase
        .from('tenant_integration_configs')
        .select('tenant_id')
        .eq('integration_key', 'traccar')
        .eq('is_active', true);
      tenantIds = (configs || []).map((c: any) => c.tenant_id);
    } else {
      return json({ error: 'Provide tenant_id or all:true' }, 400);
    }

    const results = [];
    for (const tenantId of tenantIds) {
      const startTime = Date.now();
      const result = await runHealthChecks(supabase, supabaseUrl, serviceKey, tenantId);
      result.check_duration_ms = Date.now() - startTime;

      // Store in DB
      await supabase.from('integration_health_checks').insert({
        tenant_id: tenantId,
        server_connection: result.server_connection,
        api_authentication: result.api_authentication,
        device_sync: result.device_sync,
        event_flow: result.event_flow,
        queue_health: result.queue_health,
        alert_generation: result.alert_generation,
        devices_synced: result.devices_synced,
        events_last_24h: result.events_last_24h,
        alerts_last_24h: result.alerts_last_24h,
        last_event_received: result.last_event_received,
        queue_lag: result.queue_lag,
        server_response_time_ms: result.server_response_time_ms,
        health_score: result.health_score,
        health_status: result.health_status,
        check_duration_ms: result.check_duration_ms,
        error_summary: result.error_summary,
      });

      results.push({ tenant_id: tenantId, ...result });
    }

    return json({ checked: results.length, results });
  } catch (err) {
    console.error('Health check error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function runHealthChecks(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  tenantId: string
) {
  // Get tenant Traccar config
  const { data: config } = await supabase
    .from('tenant_integration_configs')
    .select('config')
    .eq('tenant_id', tenantId)
    .eq('integration_key', 'traccar')
    .maybeSingle();

  const traccarConfig = (config?.config || {}) as Record<string, unknown>;
  const serverUrl = String(traccarConfig.server_url || '');
  const apiToken = String(traccarConfig.api_token || '');

  const checks = {
    server_connection: { status: 'unknown', message: 'Not checked' } as CheckResult,
    api_authentication: { status: 'unknown', message: 'Not checked' } as CheckResult,
    device_sync: { status: 'unknown', message: 'Not checked' } as CheckResult,
    event_flow: { status: 'unknown', message: 'Not checked' } as CheckResult,
    queue_health: { status: 'unknown', message: 'Not checked' } as CheckResult,
    alert_generation: { status: 'unknown', message: 'Not checked' } as CheckResult,
  };

  let serverResponseTime = 0;

  // ── 1. Server Connection ──
  if (!serverUrl) {
    checks.server_connection = { status: 'fail', message: 'Server URL not configured' };
  } else {
    try {
      const t0 = Date.now();
      const resp = await fetch(`${serverUrl}/api/server`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      serverResponseTime = Date.now() - t0;
      if (resp.ok) {
        checks.server_connection = {
          status: 'pass',
          message: `Server reachable (${serverResponseTime}ms)`,
          duration_ms: serverResponseTime,
        };
      } else {
        checks.server_connection = {
          status: 'warn',
          message: `Server returned ${resp.status}`,
          duration_ms: serverResponseTime,
        };
      }
    } catch (err: any) {
      checks.server_connection = {
        status: 'fail',
        message: `Connection failed: ${err.message}`,
      };
    }
  }

  // ── 2. API Authentication ──
  if (!apiToken) {
    checks.api_authentication = { status: 'fail', message: 'API token not configured' };
  } else if (checks.server_connection.status === 'fail') {
    checks.api_authentication = { status: 'fail', message: 'Skipped: server unreachable' };
  } else {
    try {
      const resp = await fetch(`${serverUrl}/api/session?token=${encodeURIComponent(apiToken)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        checks.api_authentication = { status: 'pass', message: 'Authentication successful' };
      } else {
        checks.api_authentication = { status: 'fail', message: `Auth failed: HTTP ${resp.status}` };
      }
    } catch (err: any) {
      checks.api_authentication = { status: 'fail', message: `Auth error: ${err.message}` };
    }
  }

  // ── 3. Device Sync ──
  const { data: devices, count: deviceCount } = await supabase
    .from('traccar_device_cache')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId);

  const devicesSynced = deviceCount || 0;

  if (devicesSynced === 0) {
    checks.device_sync = { status: 'warn', message: 'No devices synced', details: { count: 0 } };
  } else {
    // Check freshness of sync
    const latestSync = devices?.[0]?.synced_at;
    const syncAge = latestSync ? (Date.now() - new Date(latestSync).getTime()) / 60000 : Infinity;

    if (syncAge < 30) {
      checks.device_sync = {
        status: 'pass',
        message: `${devicesSynced} devices synced (${Math.round(syncAge)}min ago)`,
        details: { count: devicesSynced, last_sync_age_min: Math.round(syncAge) },
      };
    } else if (syncAge < 120) {
      checks.device_sync = {
        status: 'warn',
        message: `${devicesSynced} devices, last sync ${Math.round(syncAge)}min ago`,
        details: { count: devicesSynced, last_sync_age_min: Math.round(syncAge) },
      };
    } else {
      checks.device_sync = {
        status: 'fail',
        message: `Stale sync: ${Math.round(syncAge)}min since last update`,
        details: { count: devicesSynced, last_sync_age_min: Math.round(syncAge) },
      };
    }
  }

  // ── 4. Event Flow ──
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { count: eventsCount } = await supabase
    .from('raw_tracking_events')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('ingested_at', yesterday.toISOString());

  const eventsLast24h = eventsCount || 0;

  const { data: lastEvent } = await supabase
    .from('raw_tracking_events')
    .select('ingested_at')
    .eq('tenant_id', tenantId)
    .order('ingested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastEventReceived = lastEvent?.ingested_at || null;
  const eventAge = lastEventReceived
    ? (Date.now() - new Date(lastEventReceived).getTime()) / 60000
    : Infinity;

  if (eventsLast24h === 0 && devicesSynced > 0) {
    checks.event_flow = { status: 'fail', message: 'No events in 24h despite active devices' };
  } else if (eventAge > 60) {
    checks.event_flow = {
      status: 'warn',
      message: `Last event ${Math.round(eventAge)}min ago (${eventsLast24h} in 24h)`,
    };
  } else if (eventsLast24h > 0) {
    checks.event_flow = {
      status: 'pass',
      message: `${eventsLast24h} events in 24h, last ${Math.round(eventAge)}min ago`,
    };
  } else {
    checks.event_flow = { status: 'unknown', message: 'No devices or events to evaluate' };
  }

  // ── 5. Queue Health ──
  const { count: pendingCount } = await supabase
    .from('tenant_events')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'retry']);

  const queueLag = pendingCount || 0;

  if (queueLag === 0) {
    checks.queue_health = { status: 'pass', message: 'Queue clear' };
  } else if (queueLag < 50) {
    checks.queue_health = { status: 'pass', message: `${queueLag} pending events (normal)` };
  } else if (queueLag < 200) {
    checks.queue_health = { status: 'warn', message: `${queueLag} pending events (elevated)` };
  } else {
    checks.queue_health = { status: 'fail', message: `Queue backlog: ${queueLag} events` };
  }

  // ── 6. Alert Generation ──
  const { count: alertsCount } = await supabase
    .from('fleet_behavior_events')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('event_timestamp', yesterday.toISOString());

  const alertsLast24h = alertsCount || 0;

  if (devicesSynced === 0) {
    checks.alert_generation = { status: 'unknown', message: 'No devices to evaluate' };
  } else if (eventsLast24h > 0 && alertsLast24h === 0) {
    // Events flowing but no alerts — could be normal (no violations) or warn
    checks.alert_generation = {
      status: 'pass',
      message: `No alerts in 24h (${eventsLast24h} events processed)`,
    };
  } else if (alertsLast24h > 0) {
    checks.alert_generation = {
      status: 'pass',
      message: `${alertsLast24h} alerts generated in 24h`,
    };
  } else {
    checks.alert_generation = { status: 'unknown', message: 'Insufficient data' };
  }

  // ── Compute Health Score ──
  const weights: Record<string, number> = {
    server_connection: 25,
    api_authentication: 20,
    device_sync: 20,
    event_flow: 15,
    queue_health: 10,
    alert_generation: 10,
  };

  let score = 0;
  const errors: string[] = [];

  for (const [key, weight] of Object.entries(weights)) {
    const check = checks[key as keyof typeof checks];
    if (check.status === 'pass') score += weight;
    else if (check.status === 'warn') score += weight * 0.5;
    else if (check.status === 'fail') {
      errors.push(`${key}: ${check.message}`);
    }
    // unknown contributes 0
  }

  const healthScore = Math.round(score);
  const healthStatus = healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'degraded' : healthScore > 0 ? 'critical' : 'unknown';

  return {
    ...checks,
    devices_synced: devicesSynced,
    events_last_24h: eventsLast24h,
    alerts_last_24h: alertsLast24h,
    last_event_received: lastEventReceived,
    queue_lag: queueLag,
    server_response_time_ms: serverResponseTime || null,
    health_score: healthScore,
    health_status: healthStatus,
    check_duration_ms: 0,
    error_summary: errors.length > 0 ? errors.join('; ') : null,
  };
}
