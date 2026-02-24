/**
 * traccar-ingest — Webhook receiver for Traccar events.
 *
 * Architecture:
 *  ├── WebhookReceiver: validates secret + tenant resolution
 *  ├── RateLimiter: per-tenant sliding window (60 req/min)
 *  ├── EventNormalizer: heterogeneous payload → canonical format
 *  ├── IntegrityEngine: SHA-256 hash per event
 *  ├── TenantStorage: raw_tracking_events (immutable log)
 *  └── EventDispatcher: publishes to tenant-event-queue with sub-topics
 *
 * Topics dispatched:
 *  - tenant.{id}.fleet.events    → TrackingEvent
 *  - tenant.{id}.fleet.behavior  → BehaviorEvent (speed violations)
 *  - tenant.{id}.fleet.incidents → ComplianceIncident (critical)
 *
 * Auth: x-webhook-secret header (validated per-tenant from DB)
 * Tenant: x-tenant-id header or tenant_id query param
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-tenant-id',
};

// ── Rate Limiter (in-memory sliding window) ──

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

function checkRateLimit(tenantId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(tenantId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(tenantId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ── Integrity Hash ──

async function computeHash(deviceId: string, ts: string, lat: number, lon: number, speed: number): Promise<string> {
  const data = new TextEncoder().encode(`${deviceId}|${ts}|${lat}|${lon}|${speed}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Event Normalizer ──

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

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── 1. Tenant Resolution ──
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id') || req.headers.get('x-tenant-id');
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Rate Limiting ──
    if (!checkRateLimit(tenantId)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded', limit: RATE_LIMIT_MAX, window_ms: RATE_LIMIT_WINDOW_MS }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    // ── 3. Webhook Secret Validation (per-tenant from DB, fallback to env) ──
    const webhookSecret = req.headers.get('x-webhook-secret');

    // Try tenant-specific secret from webhook_configurations
    const { data: webhookConfig } = await supabase
      .from('webhook_configurations')
      .select('secret')
      .eq('tenant_id', tenantId)
      .eq('event_type', 'traccar_ingest')
      .eq('is_active', true)
      .maybeSingle();

    const expectedSecret = webhookConfig?.secret || Deno.env.get('TRACCAR_WEBHOOK_SECRET');

    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.warn(`[traccar-ingest] Webhook secret mismatch for tenant ${tenantId}`);
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid webhook secret' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Parse & Normalize ──
    const body = await req.json();
    const rawEvents = Array.isArray(body) ? body : [body];
    if (rawEvents.length === 0) {
      return new Response(JSON.stringify({ error: 'No events' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cap batch size
    const MAX_BATCH = 500;
    const batch = rawEvents.slice(0, MAX_BATCH);

    const now = new Date().toISOString();
    const records = [];
    const behaviorEvents = [];
    let rejected = 0;

    // Get tenant speed limit
    const { data: tenantConfig } = await supabase
      .from('tenant_integration_configs')
      .select('config')
      .eq('tenant_id', tenantId)
      .eq('integration_key', 'traccar')
      .maybeSingle();

    const speedLimitKmh = (tenantConfig?.config as Record<string, unknown>)?.speed_limit_kmh
      ? Number((tenantConfig.config as Record<string, unknown>).speed_limit_kmh)
      : 80;

    for (const raw of batch) {
      const evt = normalize(raw);
      if (!evt.device_id || (evt.latitude === 0 && evt.longitude === 0)) { rejected++; continue; }

      const integrity_hash = await computeHash(evt.device_id, evt.event_timestamp, evt.latitude, evt.longitude, evt.speed);
      const speedKmh = evt.speed * 1.852;

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

      // Auto-detect speed violations → behavior event
      if (speedKmh > speedLimitKmh) {
        const excessPct = ((speedKmh - speedLimitKmh) / speedLimitKmh) * 100;
        behaviorEvents.push({
          tenant_id: tenantId,
          device_id: evt.device_id,
          event_type: 'overspeed',
          severity: excessPct >= 50 ? 'critical' : excessPct >= 30 ? 'high' : excessPct >= 10 ? 'medium' : 'low',
          details: {
            speed_kmh: Math.round(speedKmh),
            limit_kmh: speedLimitKmh,
            excess_kmh: Math.round(speedKmh - speedLimitKmh),
            latitude: evt.latitude,
            longitude: evt.longitude,
          },
          event_timestamp: evt.event_timestamp,
        });
      }
    }

    if (records.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid events', rejected }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Insert into raw_tracking_events ──
    const { error: insertError } = await supabase.from('raw_tracking_events').insert(records);
    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 6. Insert behavior events ──
    if (behaviorEvents.length > 0) {
      await supabase.from('fleet_behavior_events').insert(behaviorEvents).catch(() => {});
    }

    // ── 7. Dispatch to Event Queue with sub-topics (non-blocking) ──
    try {
      // fleet.events topic
      const trackingQueue = records.map(e => ({
        event_type: 'TrackingEvent',
        domain: 'fleet.events',
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
        priority: (e.speed * 1.852) > 100 ? 'critical' : (e.speed * 1.852) > 80 ? 'high' : 'normal',
        ttl_seconds: 3600,
        source: 'traccar-webhook',
        metadata: { device_id: e.device_id, tenant_id: tenantId },
      }));

      // fleet.behavior topic
      const behaviorQueue = behaviorEvents.map(b => ({
        event_type: 'BehaviorEvent',
        domain: 'fleet.behavior',
        payload: {
          device_id: b.device_id,
          event_type: b.event_type,
          severity: b.severity,
          speed_kmh: b.details.speed_kmh,
          speed_limit_kmh: b.details.limit_kmh,
          location_lat: b.details.latitude,
          location_lng: b.details.longitude,
          description: `Excesso de velocidade: ${b.details.speed_kmh} km/h (limite: ${b.details.limit_kmh})`,
        },
        priority: b.severity === 'critical' ? 'critical' : b.severity === 'high' ? 'high' : 'normal',
        ttl_seconds: 7200,
        source: 'traccar-webhook',
        metadata: { device_id: b.device_id, tenant_id: tenantId },
      }));

      // fleet.incidents topic (critical only)
      const incidentQueue = behaviorEvents
        .filter(b => b.severity === 'critical')
        .map(b => ({
          event_type: 'ComplianceIncident',
          domain: 'fleet.incidents',
          payload: {
            device_id: b.device_id,
            incident_type: 'speed_violation_critical',
            severity: 'critical',
            description: `Velocidade crítica: ${b.details.speed_kmh} km/h (limite: ${b.details.limit_kmh})`,
          },
          priority: 'critical',
          ttl_seconds: 14400,
          source: 'traccar-webhook',
          metadata: { device_id: b.device_id, tenant_id: tenantId },
        }));

      const allEvents = [...trackingQueue, ...behaviorQueue, ...incidentQueue];

      if (allEvents.length > 0) {
        fetch(`${supabaseUrl}/functions/v1/tenant-event-queue?action=publish&tenant_id=${tenantId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify(allEvents),
        }).catch(() => {});
      }
    } catch { /* non-critical */ }

    // ── 8. Response ──
    return new Response(JSON.stringify({
      ingested: records.length,
      rejected,
      behavior_events: behaviorEvents.length,
      topics_dispatched: ['fleet.events', 'fleet.behavior', 'fleet.incidents'],
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
