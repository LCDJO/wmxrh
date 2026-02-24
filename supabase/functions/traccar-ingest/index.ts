/**
 * traccar-ingest — Webhook receiver for Traccar events.
 *
 * Architecture:
 *  ├── WebhookReceiver: validates secret + tenant resolution
 *  ├── EventNormalizer: heterogeneous payload → canonical format
 *  ├── IntegrityEngine: SHA-256 hash per event
 *  ├── TenantStorage: raw_tracking_events (immutable log)
 *  └── EventDispatcher: publishes to tenant-event-queue
 *
 * Accepts: POST with array or single event objects
 * Auth: x-webhook-secret header or query param
 * Tenant: x-tenant-id header or tenant_id query param
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-tenant-id',
};

// ══════════════════════════════════════════════════════════
// INTEGRITY HASH ENGINE
// ══════════════════════════════════════════════════════════

async function computeHash(deviceId: string, ts: string, lat: number, lon: number, speed: number): Promise<string> {
  const data = new TextEncoder().encode(`${deviceId}|${ts}|${lat}|${lon}|${speed}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ══════════════════════════════════════════════════════════
// EVENT NORMALIZER
// ══════════════════════════════════════════════════════════

interface NormalizedEvent {
  device_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  ignition: boolean | null;
  event_timestamp: string;
  course: number | null;
  altitude: number | null;
  satellites: number | null;
  battery_level: number | null;
  attributes: Record<string, unknown>;
  raw_payload: Record<string, unknown>;
}

function normalize(raw: Record<string, unknown>): NormalizedEvent {
  const pos = (raw.position ?? raw) as Record<string, unknown>;
  const dev = (raw.device ?? {}) as Record<string, unknown>;
  const attrs = (pos.attributes ?? raw.attributes ?? {}) as Record<string, unknown>;

  return {
    device_id: String(pos.deviceId ?? dev.uniqueId ?? dev.id ?? raw.deviceId ?? raw.device_id ?? raw.id ?? ''),
    latitude: Number(pos.latitude ?? pos.lat ?? raw.latitude ?? raw.lat ?? 0),
    longitude: Number(pos.longitude ?? pos.lon ?? pos.lng ?? raw.longitude ?? raw.lon ?? raw.lng ?? 0),
    speed: Number(pos.speed ?? raw.speed ?? 0),
    ignition: pos.ignition != null ? Boolean(pos.ignition) : (attrs.ignition != null ? Boolean(attrs.ignition) : (raw.ignition != null ? Boolean(raw.ignition) : null)),
    event_timestamp: String(pos.deviceTime ?? raw.deviceTime ?? raw.event_timestamp ?? raw.timestamp ?? new Date().toISOString()),
    course: pos.course != null ? Number(pos.course) : (raw.bearing != null ? Number(raw.bearing) : null),
    altitude: pos.altitude != null ? Number(pos.altitude) : (raw.altitude != null ? Number(raw.altitude) : null),
    satellites: (pos.satellites ?? attrs.sat ?? raw.satellites ?? raw.sat) != null ? Number(pos.satellites ?? attrs.sat ?? raw.satellites ?? raw.sat) : null,
    battery_level: (attrs.batteryLevel ?? attrs.battery ?? raw.batteryLevel ?? raw.battery) != null ? Number(attrs.batteryLevel ?? attrs.battery ?? raw.batteryLevel ?? raw.battery) : null,
    attributes: attrs,
    raw_payload: raw,
  };
}

// ══════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // ── 1. Webhook Authentication ──
    const webhookSecret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get('TRACCAR_WEBHOOK_SECRET');
    if (expectedSecret && webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Tenant Resolution ──
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id') || req.headers.get('x-tenant-id');
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Parse & Normalize ──
    const body = await req.json();
    const rawEvents = Array.isArray(body) ? body : [body];
    if (rawEvents.length === 0) {
      return new Response(JSON.stringify({ error: 'No events' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const records = [];
    let rejected = 0;

    for (const raw of rawEvents) {
      const evt = normalize(raw);
      if (!evt.device_id || (evt.latitude === 0 && evt.longitude === 0)) { rejected++; continue; }

      const integrity_hash = await computeHash(evt.device_id, evt.event_timestamp, evt.latitude, evt.longitude, evt.speed);

      records.push({
        tenant_id: tenantId,
        device_id: evt.device_id,
        latitude: evt.latitude,
        longitude: evt.longitude,
        speed: evt.speed,
        ignition: evt.ignition,
        event_timestamp: evt.event_timestamp,
        course: evt.course,
        altitude: evt.altitude,
        satellites: evt.satellites,
        battery_level: evt.battery_level,
        attributes: evt.attributes,
        raw_payload: evt.raw_payload,
        integrity_hash,
        source: 'webhook',
        processed: false,
        ingested_at: now,
      });
    }

    if (records.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid events', rejected }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Insert into raw_tracking_events ──
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { error: insertError } = await supabase.from('raw_tracking_events').insert(records);
    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Dispatch to Event Queue (non-blocking) ──
    try {
      const queueEvents = records.map(e => ({
        event_type: 'TrackingEvent',
        domain: 'fleet',
        payload: {
          device_id: e.device_id,
          latitude: e.latitude,
          longitude: e.longitude,
          speed: e.speed,
          ignition: e.ignition,
          event_timestamp: e.event_timestamp,
          course: e.course,
          altitude: e.altitude,
          integrity_hash: e.integrity_hash,
        },
        priority: e.speed > 100 ? 'critical' : e.speed > 80 ? 'high' : 'normal',
        ttl_seconds: 3600,
        source: 'traccar-webhook',
        metadata: { device_id: e.device_id, tenant_id: tenantId },
      }));

      const queueUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/tenant-event-queue?action=publish&tenant_id=${tenantId}`;
      fetch(queueUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify(queueEvents),
      }).catch(() => {});
    } catch { /* non-critical */ }

    // ── 6. Response ──
    return new Response(JSON.stringify({
      ingested: records.length,
      rejected,
      integrity_hashes: records.map(e => e.integrity_hash),
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Ingest error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
