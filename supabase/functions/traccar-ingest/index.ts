import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-tenant-id',
};

// ── SHA-256 Integrity Hash ──
async function computeIntegrityHash(
  deviceId: string, timestamp: string, lat: number, lon: number, speed: number
): Promise<string> {
  const input = `${deviceId}|${timestamp}|${lat}|${lon}|${speed}`;
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Event Normalizer (Platform Layer logic) ──
function normalizeEvent(raw: Record<string, unknown>) {
  const pos = (raw.position ?? raw) as Record<string, unknown>;
  const device = (raw.device ?? {}) as Record<string, unknown>;

  return {
    device_id: String(pos.deviceId ?? device.uniqueId ?? device.id ?? raw.deviceId ?? raw.device_id ?? raw.id ?? ''),
    latitude: Number(pos.latitude ?? pos.lat ?? raw.latitude ?? raw.lat ?? 0),
    longitude: Number(pos.longitude ?? pos.lon ?? pos.lng ?? raw.longitude ?? raw.lon ?? raw.lng ?? 0),
    speed: Number(pos.speed ?? raw.speed ?? 0),
    ignition: pos.ignition != null ? Boolean(pos.ignition) : (raw.ignition != null ? Boolean(raw.ignition) : null),
    event_timestamp: String(
      pos.deviceTime ?? raw.deviceTime ?? raw.event_timestamp ?? raw.timestamp ?? new Date().toISOString()
    ),
    course: pos.course != null ? Number(pos.course) : (raw.bearing != null ? Number(raw.bearing) : null),
    altitude: pos.altitude != null ? Number(pos.altitude) : (raw.altitude != null ? Number(raw.altitude) : null),
    raw_payload: raw,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── 1. Webhook Authentication (Platform Layer) ──
    const webhookSecret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get('TRACCAR_WEBHOOK_SECRET');

    if (expectedSecret && webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Tenant Resolution ──
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id') || req.headers.get('x-tenant-id');

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenant_id is required (query param or x-tenant-id header)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const rawEvents = Array.isArray(body) ? body : [body];

    if (rawEvents.length === 0) {
      return new Response(JSON.stringify({ error: 'No events provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Normalize + Integrity Hash (Platform Layer) ──
    const normalized = [];
    let rejected = 0;

    for (const raw of rawEvents) {
      const evt = normalizeEvent(raw);
      if (!evt.device_id || (evt.latitude === 0 && evt.longitude === 0)) {
        rejected++;
        continue;
      }

      const integrity_hash = await computeIntegrityHash(
        evt.device_id, evt.event_timestamp, evt.latitude, evt.longitude, evt.speed
      );

      normalized.push({
        tenant_id: tenantId,
        device_id: evt.device_id,
        latitude: evt.latitude,
        longitude: evt.longitude,
        speed: evt.speed,
        ignition: evt.ignition,
        event_timestamp: evt.event_timestamp,
        raw_payload: evt.raw_payload,
        integrity_hash,
      });
    }

    if (normalized.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid events after normalization', rejected }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Dispatch to Tenant Storage ──
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error } = await supabase
      .from('raw_tracking_events')
      .insert(normalized);

    if (error) {
      console.error('Insert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Push to Display Event Queue (async, non-blocking) ──
    try {
      const displayEvents = normalized.map(e => ({
        event_type: 'tracking_position',
        source: 'traccar',
        channel: `tenant-${tenantId}`,
        payload: {
          device_id: e.device_id,
          latitude: e.latitude,
          longitude: e.longitude,
          speed: e.speed,
          ignition: e.ignition,
          event_timestamp: e.event_timestamp,
          integrity_hash: e.integrity_hash,
        },
        priority: (e.speed > 100 ? 0 : e.speed > 80 ? 1 : 2),
        ttl_seconds: 300,
      }));

      // Fire-and-forget to display pipeline
      const processorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/display-event-processor?action=ingest&tenant_id=${tenantId}`;
      fetch(processorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify(displayEvents),
      }).catch(() => { /* non-blocking */ });
    } catch { /* display pipeline is non-critical */ }

    // ── 6. Response with dispatch manifest ──
    return new Response(JSON.stringify({
      ingested: normalized.length,
      rejected,
      integrity_hashes: normalized.map(e => e.integrity_hash),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Traccar ingest error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
