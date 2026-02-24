/**
 * traccar-sync — Polling-based device/position synchronization.
 *
 * Called periodically (cron or manual) to:
 *  1. Fetch devices + positions from Traccar API
 *  2. Upsert into traccar_device_cache
 *  3. Insert new positions into raw_tracking_events
 *  4. Dispatch behavior events (speed violations)
 *  5. Update sync health status
 *
 * This is the FALLBACK mechanism when webhooks are unreliable.
 *
 * Auth: service-role (for cron) or user JWT (for manual trigger)
 * Params: tenant_id (required), speed_limit_kmh (optional, default 80)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Traccar Auth (same multi-strategy as traccar-proxy) ──
async function traccarFetch(baseUrl: string, path: string, token: string): Promise<{ ok: boolean; data: unknown }> {
  // Strategy 1: Session cookie
  try {
    console.log(`[traccar-sync] Strategy 1: session cookie for ${baseUrl}${path}`);
    const sessUrl = `${baseUrl}/api/session?token=${encodeURIComponent(token)}`;
    const sess = await fetch(sessUrl, {
      method: 'GET', headers: { 'Accept': 'application/json' }, redirect: 'manual',
    });
    const sessText = await sess.text();
    const cookie = (sess.headers.get('set-cookie') || '').match(/JSESSIONID=[^;]+/);
    console.log(`[traccar-sync] Session status=${sess.status}, hasCookie=${!!cookie}, body=${sessText.substring(0, 200)}`);

    if (cookie && sess.ok) {
      const resp = await fetch(`${baseUrl}${path}`, {
        headers: { 'Accept': 'application/json', 'Cookie': cookie[0] }, redirect: 'manual',
      });
      const text = await resp.text();
      console.log(`[traccar-sync] Cookie fetch status=${resp.status}, body=${text.substring(0, 300)}`);
      try { return { ok: resp.ok, data: JSON.parse(text) }; } catch { return { ok: false, data: null }; }
    }
  } catch (e) {
    console.error(`[traccar-sync] Strategy 1 failed:`, e);
  }

  // Strategy 2: Token param
  try {
    console.log(`[traccar-sync] Strategy 2: token param for ${baseUrl}${path}`);
    const sep = path.includes('?') ? '&' : '?';
    const resp = await fetch(`${baseUrl}${path}${sep}token=${encodeURIComponent(token)}`, {
      headers: { 'Accept': 'application/json' }, redirect: 'manual',
    });
    const text = await resp.text();
    console.log(`[traccar-sync] Token-param fetch status=${resp.status}, body=${text.substring(0, 300)}`);
    try { return { ok: resp.ok, data: JSON.parse(text) }; } catch { return { ok: false, data: null }; }
  } catch (e) {
    console.error(`[traccar-sync] Strategy 2 failed:`, e);
  }

  // Strategy 3: Bearer header
  try {
    console.log(`[traccar-sync] Strategy 3: bearer for ${baseUrl}${path}`);
    const resp = await fetch(`${baseUrl}${path}`, {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }, redirect: 'manual',
    });
    const text = await resp.text();
    console.log(`[traccar-sync] Bearer fetch status=${resp.status}, body=${text.substring(0, 300)}`);
    try { return { ok: resp.ok, data: JSON.parse(text) }; } catch { return { ok: false, data: null }; }
  } catch (e) {
    console.error(`[traccar-sync] Strategy 3 failed:`, e);
  }

  console.error(`[traccar-sync] All strategies failed for ${path}`);
  return { ok: false, data: null };
}

async function computeHash(did: string, ts: string, lat: number, lon: number, spd: number): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${did}|${ts}|${lat}|${lon}|${spd}`));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // ── Resolve parameters ──
    const url = new URL(req.url);
    let tenantId = url.searchParams.get('tenant_id');
    let speedLimit = Number(url.searchParams.get('speed_limit_kmh') || '80');

    if (!tenantId) {
      try {
        const body = await req.json();
        tenantId = body.tenant_id;
        if (body.speed_limit_kmh) speedLimit = Number(body.speed_limit_kmh);
      } catch {}
    }

    // If no specific tenant, sync ALL active tenants
    const tenantIds: string[] = [];
    if (tenantId) {
      tenantIds.push(tenantId);
    } else {
      const { data: configs } = await supabase
        .from('tenant_integration_configs')
        .select('tenant_id')
        .eq('integration_key', 'traccar')
        .eq('is_active', true);
      if (configs) tenantIds.push(...configs.map(c => c.tenant_id));
    }

    const results = [];

    for (const tid of tenantIds) {
      try {
        const result = await syncTenant(supabase, supabaseUrl, serviceKey, tid, speedLimit);
        results.push({ tenant_id: tid, ...result });
      } catch (err) {
        // Update sync status with failure
        await supabase.from('traccar_sync_status').upsert({
          tenant_id: tid,
          sync_type: 'polling',
          last_error: err instanceof Error ? err.message : String(err),
          is_healthy: false,
          last_sync_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,sync_type' });

        results.push({ tenant_id: tid, error: String(err), devices: 0, positions: 0, events_created: 0 });
      }
    }

    return new Response(JSON.stringify({ synced: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[traccar-sync] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function syncTenant(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  tenantId: string,
  speedLimit: number,
) {
  // ── 1. Get tenant Traccar config ──
  const { data: cfgRow } = await supabase
    .from('tenant_integration_configs')
    .select('config')
    .eq('tenant_id', tenantId)
    .eq('integration_key', 'traccar')
    .maybeSingle();

  if (!cfgRow?.config) throw new Error('Traccar not configured');
  const cfg = cfgRow.config as { api_url: string; api_token: string };
  if (!cfg.api_url || !cfg.api_token) throw new Error('Missing URL or token');

  const baseUrl = cfg.api_url.replace(/\/+$/, '');

  // ── 2. Identify token owner via /api/session ──
  let tokenOwner: { id: number; name: string; email: string; administrator: boolean; readonly: boolean } | null = null;
  try {
    const sessRes = await traccarFetch(baseUrl, '/api/session', cfg.api_token);
    if (sessRes.ok && sessRes.data && typeof sessRes.data === 'object') {
      const s = sessRes.data as any;
      tokenOwner = {
        id: s.id,
        name: s.name || '',
        email: s.email || '',
        administrator: !!s.administrator,
        readonly: !!s.readonly,
      };
      console.log(`[traccar-sync] Token owner: ${tokenOwner.email}, admin=${tokenOwner.administrator}, readonly=${tokenOwner.readonly}`);
    }
  } catch (e) {
    console.warn(`[traccar-sync] Could not identify token owner:`, e);
  }

  // ── 3. Fetch devices + positions in parallel ──
  const [devRes, posRes] = await Promise.all([
    traccarFetch(baseUrl, '/api/devices', cfg.api_token),
    traccarFetch(baseUrl, '/api/positions', cfg.api_token),
  ]);

  const devices = (devRes.ok && Array.isArray(devRes.data) ? devRes.data : []) as any[];
  const positions = (posRes.ok && Array.isArray(posRes.data) ? posRes.data : []) as any[];

  console.log(`[traccar-sync] Tenant ${tenantId}: devRes.ok=${devRes.ok}, devices=${devices.length}, posRes.ok=${posRes.ok}, positions=${positions.length}`);

  if (!devRes.ok) {
    throw new Error(`Traccar devices API failed. Check server URL and token.`);
  }

  // Build position lookup
  const posMap = new Map<number, any>();
  for (const p of positions) posMap.set(p.deviceId, p);

  // ── 3. Get last sync to determine new positions ──
  const { data: syncStatus } = await supabase
    .from('traccar_sync_status')
    .select('last_sync_at')
    .eq('tenant_id', tenantId)
    .eq('sync_type', 'polling')
    .maybeSingle();

  const lastSyncAt = syncStatus?.last_sync_at ? new Date(syncStatus.last_sync_at) : new Date(0);
  const now = new Date().toISOString();

  // ── 4. Upsert device cache + create tracking events ──
  const newEvents = [];
  const behaviorEvents = [];

  for (const dev of devices) {
    const pos = posMap.get(dev.id);
    const speedKmh = pos ? pos.speed * 1.852 : 0;
    const ignition = pos?.attributes?.ignition ?? null;

    let computedStatus = 'stopped';
    if (speedKmh > speedLimit) computedStatus = 'speeding';
    else if (speedKmh > 5) computedStatus = 'moving';
    else if (ignition) computedStatus = 'idle';

    // Upsert device cache
    await supabase.from('traccar_device_cache').upsert({
      tenant_id: tenantId,
      traccar_id: dev.id,
      unique_id: dev.uniqueId,
      name: dev.name,
      status: dev.status || 'unknown',
      disabled: dev.disabled,
      last_update: dev.lastUpdate,
      position_id: dev.positionId,
      group_id: dev.groupId,
      phone: dev.phone,
      model: dev.model,
      category: dev.category,
      attributes: dev.attributes || {},
      latitude: pos?.latitude,
      longitude: pos?.longitude,
      speed: Math.round(speedKmh),
      course: pos?.course,
      altitude: pos?.altitude,
      ignition,
      address: pos?.address,
      position_time: pos?.deviceTime,
      computed_status: computedStatus,
      synced_at: now,
    }, { onConflict: 'tenant_id,traccar_id' });

    // Create tracking event if position is newer than last sync
    if (pos && pos.deviceTime) {
      const posTime = new Date(pos.deviceTime);
      if (posTime > lastSyncAt && pos.latitude !== 0 && pos.longitude !== 0) {
        const hash = await computeHash(
          String(dev.id), pos.deviceTime, pos.latitude, pos.longitude, pos.speed
        );

        newEvents.push({
          tenant_id: tenantId,
          device_id: String(dev.id),
          latitude: pos.latitude,
          longitude: pos.longitude,
          speed: pos.speed,
          ignition,
          event_timestamp: pos.deviceTime,
          course: pos.course ?? null,
          altitude: pos.altitude ?? null,
          satellites: pos.attributes?.sat ?? null,
          battery_level: pos.attributes?.batteryLevel ?? null,
          attributes: pos.attributes || {},
          raw_payload: { device: dev, position: pos },
          integrity_hash: hash,
          source: 'polling',
          processed: false,
          ingested_at: now,
        });

        // Detect speed violation → behavior event
        if (speedKmh > speedLimit) {
          behaviorEvents.push({
            tenant_id: tenantId,
            device_id: String(dev.id),
            event_type: 'overspeed',
            severity: speedKmh > speedLimit * 1.5 ? 'critical' : speedKmh > speedLimit * 1.2 ? 'high' : 'medium',
            details: {
              speed_kmh: Math.round(speedKmh),
              limit_kmh: speedLimit,
              excess_kmh: Math.round(speedKmh - speedLimit),
              latitude: pos.latitude,
              longitude: pos.longitude,
              event_timestamp: pos.deviceTime,
            },
            event_timestamp: pos.deviceTime,
          });
        }
      }
    }
  }

  // ── 5. Batch insert new events ──
  if (newEvents.length > 0) {
    await supabase.from('raw_tracking_events').insert(newEvents);
  }

  // ── 6. Insert behavior events ──
  if (behaviorEvents.length > 0) {
    await supabase.from('fleet_behavior_events').insert(behaviorEvents);
  }

  // ── 7. Dispatch to event queue (non-blocking) ──
  if (newEvents.length > 0) {
    try {
      // fleet.events topic
      const trackingQueue = newEvents.map(e => ({
        event_type: 'TrackingEvent',
        domain: 'fleet.events',
        payload: {
          device_id: e.device_id,
          latitude: e.latitude,
          longitude: e.longitude,
          speed: e.speed,
          ignition: e.ignition,
          event_timestamp: e.event_timestamp,
          integrity_hash: e.integrity_hash,
        },
        priority: (e.speed * 1.852) > 100 ? 'critical' : (e.speed * 1.852) > 80 ? 'high' : 'normal',
        ttl_seconds: 3600,
        source: 'traccar-polling',
      }));

      // fleet.behavior topic
      const behaviorQueue = behaviorEvents.map(b => ({
        event_type: 'BehaviorEvent',
        domain: 'fleet.behavior',
        payload: {
          device_id: b.device_id,
          event_type: b.event_type,
          severity: b.severity,
          speed_kmh: (b.details as Record<string, unknown>).speed_kmh,
          speed_limit_kmh: (b.details as Record<string, unknown>).limit_kmh,
          description: `Excesso: ${(b.details as Record<string, unknown>).speed_kmh} km/h`,
        },
        priority: b.severity === 'critical' ? 'critical' : 'normal',
        ttl_seconds: 7200,
        source: 'traccar-polling',
      }));

      const allEvents = [...trackingQueue, ...behaviorQueue];

      fetch(`${supabaseUrl}/functions/v1/tenant-event-queue?action=publish&tenant_id=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify(allEvents),
      }).catch(() => {});
    } catch {}
  }

  // ── 8. Update sync status ──
  await supabase.from('traccar_sync_status').upsert({
    tenant_id: tenantId,
    sync_type: 'polling',
    last_sync_at: now,
    last_device_count: devices.length,
    last_position_count: positions.length,
    last_error: null,
    consecutive_failures: 0,
    is_healthy: true,
    metadata: {
      events_created: newEvents.length,
      behavior_events: behaviorEvents.length,
      token_owner: tokenOwner,
    },
  }, { onConflict: 'tenant_id,sync_type' });

  return {
    devices: devices.length,
    positions: positions.length,
    events_created: newEvents.length,
    behavior_events: behaviorEvents.length,
    token_owner: tokenOwner,
  };
}
