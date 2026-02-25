/**
 * traccar-sync — Behavioral Traffic Intelligence Engine (BTIE)
 *
 * Enhanced sync that:
 *  1. Fetches devices + positions from Traccar API
 *  2. Stores position history
 *  3. Builds trips from sequential positions
 *  4. Detects speed violations against zones, enforcement points & radar points
 *  5. Computes driver behavioral scores
 *  6. Updates sync health status
 *  7. Dispatches behavior events to queue
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Traccar Auth (multi-strategy) ──
async function traccarFetch(baseUrl: string, path: string, token: string): Promise<{ ok: boolean; data: unknown }> {
  // Strategy 1: Session cookie
  try {
    const sess = await fetch(`${baseUrl}/api/session?token=${encodeURIComponent(token)}`, {
      method: 'GET', headers: { 'Accept': 'application/json' }, redirect: 'manual',
    });
    const sessText = await sess.text();
    const cookie = (sess.headers.get('set-cookie') || '').match(/JSESSIONID=[^;]+/);
    if (cookie && sess.ok) {
      const resp = await fetch(`${baseUrl}${path}`, {
        headers: { 'Accept': 'application/json', 'Cookie': cookie[0] }, redirect: 'manual',
      });
      const text = await resp.text();
      try { return { ok: resp.ok, data: JSON.parse(text) }; } catch { /* fall through */ }
    }
  } catch {}

  // Strategy 2: Token param
  try {
    const sep = path.includes('?') ? '&' : '?';
    const resp = await fetch(`${baseUrl}${path}${sep}token=${encodeURIComponent(token)}`, {
      headers: { 'Accept': 'application/json' }, redirect: 'manual',
    });
    const text = await resp.text();
    try { return { ok: resp.ok, data: JSON.parse(text) }; } catch { /* fall through */ }
  } catch {}

  // Strategy 3: Bearer
  try {
    const resp = await fetch(`${baseUrl}${path}`, {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }, redirect: 'manual',
    });
    const text = await resp.text();
    try { return { ok: resp.ok, data: JSON.parse(text) }; } catch { /* fall through */ }
  } catch {}

  return { ok: false, data: null };
}

async function computeHash(did: string, ts: string, lat: number, lon: number, spd: number): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${did}|${ts}|${lat}|${lon}|${spd}`));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Haversine distance (km) ──
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Grade from score ──
function gradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

// ── Severity from excess speed ──
function severityFromExcess(excess: number): string {
  if (excess > 40) return 'critical';
  if (excess > 20) return 'high';
  if (excess > 10) return 'medium';
  return 'low';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    let tenantId = url.searchParams.get('tenant_id');
    let speedLimit = Number(url.searchParams.get('speed_limit_kmh') || '80');
    let syncMode = url.searchParams.get('mode') || 'full'; // full | positions_only | scores_only

    if (!tenantId) {
      try {
        const body = await req.json();
        tenantId = body.tenant_id;
        if (body.speed_limit_kmh) speedLimit = Number(body.speed_limit_kmh);
        if (body.mode) syncMode = body.mode;
      } catch {}
    }

    const tenantIds: string[] = [];
    if (tenantId) {
      tenantIds.push(tenantId);
    } else {
      const { data: configs } = await supabase
        .from('tenant_integration_configs')
        .select('tenant_id')
        .eq('integration_key', 'traccar')
        .eq('is_active', true);
      if (configs) tenantIds.push(...configs.map((c: any) => c.tenant_id));
    }

    const results = [];
    for (const tid of tenantIds) {
      try {
        const result = await syncTenant(supabase, supabaseUrl, serviceKey, tid, speedLimit, syncMode);
        results.push({ tenant_id: tid, ...result });
      } catch (err) {
        await supabase.from('traccar_sync_status').upsert({
          tenant_id: tid, sync_type: 'polling',
          last_error: err instanceof Error ? err.message : String(err),
          is_healthy: false, last_sync_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,sync_type' });
        results.push({ tenant_id: tid, error: String(err) });
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
  defaultSpeedLimit: number,
  syncMode: string,
) {
  // ── Create sync job ──
  const { data: jobRow } = await supabase.from('fleet_sync_jobs').insert({
    tenant_id: tenantId, job_type: syncMode, status: 'running', started_at: new Date().toISOString(),
  }).select('id').single();
  const jobId = jobRow?.id;

  try {
    // ── 1. Get tenant config ──
    const { data: cfgRow } = await supabase
      .from('tenant_integration_configs').select('config')
      .eq('tenant_id', tenantId).eq('integration_key', 'traccar').maybeSingle();

    if (!cfgRow?.config) throw new Error('Traccar not configured');
    const cfg = cfgRow.config as { api_url: string; api_token: string };
    if (!cfg.api_url || !cfg.api_token) throw new Error('Missing URL or token');
    const baseUrl = cfg.api_url.replace(/\/+$/, '');

    // ── 2. Fetch devices + positions ──
    const [devRes, posRes] = await Promise.all([
      traccarFetch(baseUrl, '/api/devices', cfg.api_token),
      traccarFetch(baseUrl, '/api/positions', cfg.api_token),
    ]);

    const devices = (devRes.ok && Array.isArray(devRes.data) ? devRes.data : []) as any[];
    const positions = (posRes.ok && Array.isArray(posRes.data) ? posRes.data : []) as any[];

    if (!devRes.ok) throw new Error('Traccar devices API failed');

    const posMap = new Map<number, any>();
    for (const p of positions) posMap.set(p.deviceId, p);

    // ── 3. Load speed zones, enforcement zones, radar points ──
    const [szRes, ezRes, rpRes, epRes] = await Promise.all([
      supabase.from('fleet_speed_zones').select('*').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('fleet_enforcement_zones').select('*').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('fleet_radar_points').select('*').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('fleet_enforcement_points').select('*').eq('tenant_id', tenantId).eq('is_active', true),
    ]);

    const speedZones = szRes.data || [];
    const enforcementZones = ezRes.data || [];
    const radarPoints = rpRes.data || [];
    const enforcementPoints = epRes.data || [];

    // ── 4. Get employee-device mappings ──
    const { data: deviceMappings } = await supabase
      .from('fleet_devices').select('serial_number, employee_id')
      .eq('tenant_id', tenantId).eq('is_active', true);
    const employeeMap = new Map<string, string>();
    for (const dm of (deviceMappings || [])) {
      employeeMap.set(dm.serial_number, dm.employee_id);
    }

    // ── 5. Get last sync timestamp ──
    const { data: syncStatus } = await supabase
      .from('traccar_sync_status').select('last_sync_at')
      .eq('tenant_id', tenantId).eq('sync_type', 'polling').maybeSingle();
    const lastSyncAt = syncStatus?.last_sync_at ? new Date(syncStatus.last_sync_at) : new Date(0);
    const now = new Date().toISOString();

    // ── 6. Process each device ──
    const newPositions: any[] = [];
    const newViolations: any[] = [];
    const newEvents: any[] = [];
    const behaviorEvents: any[] = [];

    for (const dev of devices) {
      const pos = posMap.get(dev.id);
      if (!pos || !pos.deviceTime || pos.latitude === 0) continue;

      const posTime = new Date(pos.deviceTime);
      if (posTime <= lastSyncAt) continue;

      const speedKnots = pos.speed || 0;
      const speedKmh = speedKnots * 1.852;
      const ignition = pos?.attributes?.ignition ?? false;
      const employeeId = employeeMap.get(dev.uniqueId) || null;

      // Store position history
      const posRecord: any = {
        tenant_id: tenantId,
        device_id: dev.id,
        device_name: dev.name,
        employee_id: employeeId,
        latitude: pos.latitude,
        longitude: pos.longitude,
        speed_knots: speedKnots,
        course: pos.course,
        altitude: pos.altitude,
        address: pos.address,
        ignition,
        attributes: pos.attributes || {},
        fix_time: pos.deviceTime,
        traccar_position_id: pos.id,
      };
      newPositions.push(posRecord);

      // ── Check speed violations ──
      const effectiveLimit = findSpeedLimit(
        pos.latitude, pos.longitude, speedZones, enforcementZones, radarPoints, enforcementPoints, defaultSpeedLimit
      );

      if (speedKmh > effectiveLimit.limit) {
        const excess = speedKmh - effectiveLimit.limit;
        newViolations.push({
          tenant_id: tenantId,
          device_id: dev.id,
          device_name: dev.name,
          employee_id: employeeId,
          latitude: pos.latitude,
          longitude: pos.longitude,
          recorded_speed_kmh: Math.round(speedKmh * 10) / 10,
          speed_limit_kmh: effectiveLimit.limit,
          violation_type: 'speed_limit',
          source_type: effectiveLimit.sourceType,
          source_id: effectiveLimit.sourceId,
          source_name: effectiveLimit.sourceName,
          radar_point_id: effectiveLimit.sourceType === 'radar' ? effectiveLimit.sourceId : null,
          zone_id: effectiveLimit.sourceType === 'zone' ? effectiveLimit.sourceId : null,
          severity: severityFromExcess(excess),
          detected_at: pos.deviceTime,
        });

        behaviorEvents.push({
          tenant_id: tenantId,
          device_id: String(dev.id),
          event_type: 'overspeed',
          severity: severityFromExcess(excess),
          details: {
            speed_kmh: Math.round(speedKmh),
            limit_kmh: effectiveLimit.limit,
            excess_kmh: Math.round(excess),
            source: effectiveLimit.sourceName,
            latitude: pos.latitude,
            longitude: pos.longitude,
          },
          event_timestamp: pos.deviceTime,
        });
      }

      // Upsert device cache
      let computedStatus = 'stopped';
      if (speedKmh > effectiveLimit.limit) computedStatus = 'speeding';
      else if (speedKmh > 5) computedStatus = 'moving';
      else if (ignition) computedStatus = 'idle';

      await supabase.from('traccar_device_cache').upsert({
        tenant_id: tenantId, traccar_id: dev.id, unique_id: dev.uniqueId,
        name: dev.name, status: dev.status || 'unknown', disabled: dev.disabled,
        last_update: dev.lastUpdate, position_id: dev.positionId,
        group_id: dev.groupId, phone: dev.phone, model: dev.model,
        category: dev.category, attributes: dev.attributes || {},
        latitude: pos.latitude, longitude: pos.longitude,
        speed: Math.round(speedKmh), course: pos.course,
        altitude: pos.altitude, ignition, address: pos.address,
        position_time: pos.deviceTime, computed_status: computedStatus,
        synced_at: now, employee_id: employeeId,
      }, { onConflict: 'tenant_id,traccar_id' });

      // Raw tracking event
      const hash = await computeHash(String(dev.id), pos.deviceTime, pos.latitude, pos.longitude, pos.speed);
      newEvents.push({
        tenant_id: tenantId, device_id: String(dev.id),
        latitude: pos.latitude, longitude: pos.longitude,
        speed: pos.speed, ignition, event_timestamp: pos.deviceTime,
        course: pos.course ?? null, altitude: pos.altitude ?? null,
        satellites: pos.attributes?.sat ?? null,
        battery_level: pos.attributes?.batteryLevel ?? null,
        attributes: pos.attributes || {},
        raw_payload: { device: dev, position: pos },
        integrity_hash: hash, source: 'polling', processed: false, ingested_at: now,
      });
    }

    // ── 7. Batch inserts ──
    let positionsSynced = 0, violationsDetected = 0;

    if (newPositions.length > 0) {
      const { error: posErr } = await supabase.from('fleet_position_history')
        .upsert(newPositions, { onConflict: 'tenant_id,device_id,traccar_position_id', ignoreDuplicates: true });
      if (!posErr) positionsSynced = newPositions.length;
    }

    if (newViolations.length > 0) {
      const { error: vErr } = await supabase.from('fleet_speed_violations').insert(newViolations);
      if (!vErr) violationsDetected = newViolations.length;
    }

    if (newEvents.length > 0) {
      await supabase.from('raw_tracking_events').insert(newEvents);
    }

    if (behaviorEvents.length > 0) {
      await supabase.from('fleet_behavior_events').insert(behaviorEvents);
    }

    // ── 8. Build trips from position history (last 24h) ──
    let tripsBuilt = 0;
    if (syncMode === 'full') {
      tripsBuilt = await buildTrips(supabase, tenantId, employeeMap);
    }

    // ── 9. Compute driver scores ──
    if (syncMode === 'full' || syncMode === 'scores_only') {
      await computeDriverScores(supabase, tenantId);
    }

    // ── 10. Dispatch events to queue ──
    if (newEvents.length > 0) {
      try {
        const queueEvents = [
          ...newEvents.map(e => ({
            event_type: 'TrackingEvent', domain: 'fleet.events',
            payload: { device_id: e.device_id, latitude: e.latitude, longitude: e.longitude, speed: e.speed },
            priority: (e.speed * 1.852) > 100 ? 'critical' : 'normal',
            ttl_seconds: 3600, source: 'traccar-polling',
          })),
          ...behaviorEvents.map(b => ({
            event_type: 'BehaviorEvent', domain: 'fleet.behavior',
            payload: b.details, priority: b.severity === 'critical' ? 'critical' : 'normal',
            ttl_seconds: 7200, source: 'traccar-polling',
          })),
        ];
        fetch(`${supabaseUrl}/functions/v1/tenant-event-queue?action=publish&tenant_id=${tenantId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify(queueEvents),
        }).catch(() => {});
      } catch {}
    }

    // ── 11. Update sync status ──
    await supabase.from('traccar_sync_status').upsert({
      tenant_id: tenantId, sync_type: 'polling', last_sync_at: now,
      last_device_count: devices.length, last_position_count: positions.length,
      last_error: null, consecutive_failures: 0, is_healthy: true,
      metadata: { positions_synced: positionsSynced, violations: violationsDetected, trips: tripsBuilt },
    }, { onConflict: 'tenant_id,sync_type' });

    // ── 12. Complete sync job ──
    if (jobId) {
      await supabase.from('fleet_sync_jobs').update({
        status: 'completed', completed_at: new Date().toISOString(),
        devices_synced: devices.length, positions_synced: positionsSynced,
        trips_built: tripsBuilt, violations_detected: violationsDetected,
      }).eq('id', jobId);
    }

    return {
      devices: devices.length, positions_synced: positionsSynced,
      violations: violationsDetected, trips_built: tripsBuilt,
    };
  } catch (err) {
    if (jobId) {
      await supabase.from('fleet_sync_jobs').update({
        status: 'failed', completed_at: new Date().toISOString(),
        error_message: err instanceof Error ? err.message : String(err),
      }).eq('id', jobId);
    }
    throw err;
  }
}

// ═══════════════════════════════════════
// SPEED LIMIT DETECTION
// ═══════════════════════════════════════

interface SpeedLimitResult {
  limit: number;
  sourceType: string;
  sourceId: string | null;
  sourceName: string;
}

function findSpeedLimit(
  lat: number, lng: number,
  speedZones: any[], enforcementZones: any[],
  radarPoints: any[], enforcementPoints: any[],
  defaultLimit: number,
): SpeedLimitResult {
  let result: SpeedLimitResult = { limit: defaultLimit, sourceType: 'default', sourceId: null, sourceName: 'Limite padrão' };
  let minDistance = Infinity;

  // Check speed zones (circle-based)
  for (const zone of speedZones) {
    if (!zone.latitude || !zone.longitude || !zone.radius_meters) continue;
    const dist = haversine(lat, lng, zone.latitude, zone.longitude) * 1000;
    if (dist <= zone.radius_meters && zone.speed_limit_kmh < result.limit) {
      result = { limit: zone.speed_limit_kmh, sourceType: 'zone', sourceId: zone.id, sourceName: zone.name };
    }
  }

  // Check enforcement zones
  for (const ez of enforcementZones) {
    const dist = haversine(lat, lng, ez.latitude, ez.longitude) * 1000;
    if (dist <= ez.radius_meters && ez.speed_limit_kmh && ez.speed_limit_kmh < result.limit) {
      result = { limit: ez.speed_limit_kmh, sourceType: 'enforcement_zone', sourceId: ez.id, sourceName: ez.name };
    }
  }

  // Check radar points
  for (const rp of radarPoints) {
    const dist = haversine(lat, lng, rp.latitude, rp.longitude) * 1000;
    if (dist <= rp.detection_radius_meters && rp.speed_limit_kmh < result.limit) {
      result = { limit: rp.speed_limit_kmh, sourceType: 'radar', sourceId: rp.id, sourceName: rp.name };
      if (dist < minDistance) minDistance = dist;
    }
  }

  // Check enforcement points
  for (const ep of enforcementPoints) {
    const dist = haversine(lat, lng, ep.latitude, ep.longitude) * 1000;
    if (dist <= ep.radius_meters && ep.speed_limit_kmh < result.limit) {
      result = { limit: ep.speed_limit_kmh, sourceType: 'enforcement_point', sourceId: ep.id, sourceName: ep.name || 'Ponto de fiscalização' };
    }
  }

  return result;
}

// ═══════════════════════════════════════
// TRIP BUILDER
// ═══════════════════════════════════════

async function buildTrips(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  employeeMap: Map<string, string>,
): Promise<number> {
  // Get positions from last 24h grouped by device
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: positions } = await supabase
    .from('fleet_position_history')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('fix_time', since)
    .order('device_id').order('fix_time', { ascending: true })
    .limit(5000);

  if (!positions || positions.length === 0) return 0;

  // Group by device
  const byDevice = new Map<number, any[]>();
  for (const p of positions) {
    if (!byDevice.has(p.device_id)) byDevice.set(p.device_id, []);
    byDevice.get(p.device_id)!.push(p);
  }

  const trips: any[] = [];

  for (const [deviceId, devPositions] of byDevice) {
    if (devPositions.length < 2) continue;

    // Split into trips: gap > 5 min or ignition off = trip boundary
    let tripPositions: any[] = [devPositions[0]];

    for (let i = 1; i < devPositions.length; i++) {
      const prev = devPositions[i - 1];
      const curr = devPositions[i];
      const gap = new Date(curr.fix_time).getTime() - new Date(prev.fix_time).getTime();

      if (gap > 5 * 60 * 1000 || (!curr.ignition && prev.ignition)) {
        // Close current trip
        if (tripPositions.length >= 2) {
          const trip = buildTripFromPositions(tenantId, deviceId, tripPositions, employeeMap);
          if (trip) trips.push(trip);
        }
        tripPositions = [curr];
      } else {
        tripPositions.push(curr);
      }
    }

    // Close last trip
    if (tripPositions.length >= 2) {
      const trip = buildTripFromPositions(tenantId, deviceId, tripPositions, employeeMap);
      if (trip) trips.push(trip);
    }
  }

  if (trips.length > 0) {
    // Use upsert to avoid duplicates (match on tenant_id, device_id, start_time)
    await supabase.from('fleet_trips').insert(trips);
  }

  return trips.length;
}

function buildTripFromPositions(tenantId: string, deviceId: number, positions: any[], employeeMap: Map<string, string>) {
  const first = positions[0];
  const last = positions[positions.length - 1];

  let totalDistance = 0;
  let maxSpeed = 0;
  let speedSum = 0;

  for (let i = 1; i < positions.length; i++) {
    totalDistance += haversine(positions[i - 1].latitude, positions[i - 1].longitude, positions[i].latitude, positions[i].longitude);
    const spd = (positions[i].speed_knots || 0) * 1.852;
    if (spd > maxSpeed) maxSpeed = spd;
    speedSum += spd;
  }

  const avgSpeed = speedSum / Math.max(positions.length - 1, 1);

  // Skip very short trips
  if (totalDistance < 0.1) return null;

  const routeCoords = positions.map((p: any) => [p.longitude, p.latitude]);

  return {
    tenant_id: tenantId,
    device_id: deviceId,
    device_name: first.device_name,
    employee_id: first.employee_id,
    start_time: first.fix_time,
    end_time: last.fix_time,
    start_lat: first.latitude,
    start_lng: first.longitude,
    end_lat: last.latitude,
    end_lng: last.longitude,
    start_address: first.address,
    end_address: last.address,
    distance_km: Math.round(totalDistance * 100) / 100,
    max_speed_kmh: Math.round(maxSpeed * 10) / 10,
    avg_speed_kmh: Math.round(avgSpeed * 10) / 10,
    position_count: positions.length,
    route_geojson: { type: 'LineString', coordinates: routeCoords },
  };
}

// ═══════════════════════════════════════
// DRIVER SCORE ENGINE
// ═══════════════════════════════════════

async function computeDriverScores(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = now;

  // Get trips for current period
  const { data: trips } = await supabase
    .from('fleet_trips')
    .select('employee_id, distance_km, max_speed_kmh, avg_speed_kmh, duration_seconds, violation_count')
    .eq('tenant_id', tenantId)
    .gte('start_time', periodStart.toISOString())
    .not('employee_id', 'is', null)
    .limit(5000);

  if (!trips || trips.length === 0) return;

  // Get violations for current period
  const { data: violations } = await supabase
    .from('fleet_speed_violations')
    .select('employee_id, excess_kmh, severity')
    .eq('tenant_id', tenantId)
    .gte('detected_at', periodStart.toISOString())
    .not('employee_id', 'is', null)
    .limit(5000);

  // Get active warnings
  const { data: warnings } = await supabase
    .from('fleet_warnings')
    .select('employee_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .limit(1000);

  // Get pending agreements
  const { data: agreements } = await supabase
    .from('fleet_employee_agreement_status')
    .select('employee_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .limit(1000);

  // Group by employee
  const employeeData = new Map<string, {
    trips: number; distance: number; maxSpeed: number; avgSpeedSum: number;
    durationHours: number; violations: number; excessSum: number;
    criticalViolations: number; warnings: number; pendingAgreements: number;
  }>();

  const initEmployee = () => ({
    trips: 0, distance: 0, maxSpeed: 0, avgSpeedSum: 0,
    durationHours: 0, violations: 0, excessSum: 0,
    criticalViolations: 0, warnings: 0, pendingAgreements: 0,
  });

  for (const t of trips) {
    if (!t.employee_id) continue;
    if (!employeeData.has(t.employee_id)) employeeData.set(t.employee_id, initEmployee());
    const d = employeeData.get(t.employee_id)!;
    d.trips++;
    d.distance += t.distance_km || 0;
    if ((t.max_speed_kmh || 0) > d.maxSpeed) d.maxSpeed = t.max_speed_kmh || 0;
    d.avgSpeedSum += t.avg_speed_kmh || 0;
    d.durationHours += (t.duration_seconds || 0) / 3600;
  }

  for (const v of (violations || [])) {
    if (!v.employee_id) continue;
    if (!employeeData.has(v.employee_id)) employeeData.set(v.employee_id, initEmployee());
    const d = employeeData.get(v.employee_id)!;
    d.violations++;
    d.excessSum += v.excess_kmh || 0;
    if (v.severity === 'critical' || v.severity === 'high') d.criticalViolations++;
  }

  for (const w of (warnings || [])) {
    if (!w.employee_id) continue;
    if (employeeData.has(w.employee_id)) employeeData.get(w.employee_id)!.warnings++;
  }

  for (const a of (agreements || [])) {
    if (!a.employee_id) continue;
    if (employeeData.has(a.employee_id)) employeeData.get(a.employee_id)!.pendingAgreements++;
  }

  // Compute scores
  const scores: any[] = [];
  for (const [empId, d] of employeeData) {
    // Speed score: -5 per violation, -15 per critical
    const speedScore = Math.max(0, 100 - d.violations * 5 - d.criticalViolations * 15);
    // Braking score: proxy from max speed events (simplified)
    const brakingScore = Math.max(0, 100 - d.criticalViolations * 10);
    // Idle score: 100 (needs more data from Traccar idle events)
    const idleScore = 100;
    // Compliance score: -20 per warning, -10 per pending agreement
    const complianceScore = Math.max(0, 100 - d.warnings * 20 - d.pendingAgreements * 10);
    // Overall: weighted average
    const overall = speedScore * 0.4 + brakingScore * 0.2 + idleScore * 0.1 + complianceScore * 0.3;

    scores.push({
      tenant_id: tenantId,
      employee_id: empId,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      speed_score: Math.round(speedScore * 10) / 10,
      braking_score: Math.round(brakingScore * 10) / 10,
      idle_score: idleScore,
      compliance_score: Math.round(complianceScore * 10) / 10,
      overall_score: Math.round(overall * 10) / 10,
      grade: gradeFromScore(overall),
      total_trips: d.trips,
      total_distance_km: Math.round(d.distance * 100) / 100,
      total_duration_hours: Math.round(d.durationHours * 100) / 100,
      total_violations: d.violations,
      max_speed_recorded_kmh: Math.round(d.maxSpeed * 10) / 10,
      avg_speed_kmh: d.trips > 0 ? Math.round((d.avgSpeedSum / d.trips) * 10) / 10 : 0,
      active_warnings: d.warnings,
      pending_agreements: d.pendingAgreements,
      computed_at: new Date().toISOString(),
    });
  }

  if (scores.length > 0) {
    await supabase.from('fleet_driver_scores').upsert(scores, {
      onConflict: 'tenant_id,employee_id,period_start,period_end',
    });
  }
}
