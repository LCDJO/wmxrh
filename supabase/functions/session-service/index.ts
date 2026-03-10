/**
 * session-service — Edge Function
 * 
 * Architecture:
 *   Frontend → API Gateway (Supabase) → Auth Service (JWT) → Session Service → PostgreSQL + PostGIS
 * 
 * Endpoints (via action param):
 *   - start:     Create session with server-side IP resolution + geo enrichment
 *   - heartbeat: Update last_activity + status
 *   - end:       Mark session offline, compute duration
 *   - status:    Bulk expire stale sessions (cron-compatible)
 * 
 * Server-side IP: Extracted from request headers (X-Forwarded-For, CF-Connecting-IP)
 * Geo enrichment: ip-api.com for country/state/city/vpn/proxy detection
 * Events:         PostgreSQL NOTIFY emits realtime events via Supabase Realtime
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ════════════════════════════════════
// IP EXTRACTION
// ════════════════════════════════════

function extractClientIP(req: Request): { ipv4: string | null; ipv6: string | null } {
  // Priority: CF-Connecting-IP > X-Real-IP > X-Forwarded-For > Fly-Client-IP
  const cfIp = req.headers.get('cf-connecting-ip');
  const realIp = req.headers.get('x-real-ip');
  const forwarded = req.headers.get('x-forwarded-for');
  const flyIp = req.headers.get('fly-client-ip');

  const raw = cfIp || realIp || forwarded?.split(',')[0]?.trim() || flyIp || null;

  if (!raw) return { ipv4: null, ipv6: null };

  // Detect IPv6 vs IPv4
  const isV6 = raw.includes(':');
  return {
    ipv4: isV6 ? null : raw,
    ipv6: isV6 ? raw : null,
  };
}

// ════════════════════════════════════
// GEO ENRICHMENT (server-side)
// ════════════════════════════════════

interface GeoResult {
  latitude: number | null;
  longitude: number | null;
  country: string | null;
  state: string | null;
  city: string | null;
  is_vpn: boolean;
  is_proxy: boolean;
}

async function enrichGeo(ip: string | null): Promise<GeoResult> {
  const empty: GeoResult = {
    latitude: null, longitude: null,
    country: null, state: null, city: null,
    is_vpn: false, is_proxy: false,
  };

  if (!ip) return empty;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,proxy,hosting`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) { await res.text(); return empty; }
    const data = await res.json();
    if (data.status !== 'success') return empty;

    return {
      latitude: data.lat ?? null,
      longitude: data.lon ?? null,
      country: data.country ?? null,
      state: data.regionName ?? null,
      city: data.city ?? null,
      is_vpn: !!data.proxy,
      is_proxy: !!data.hosting,
    };
  } catch {
    return empty;
  }
}

// ════════════════════════════════════
// SUPABASE CLIENT (service_role)
// ════════════════════════════════════

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

function getUserFromJWT(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = JSON.parse(atob(auth.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// ════════════════════════════════════
// ACTION HANDLERS
// ════════════════════════════════════

async function handleStart(req: Request, body: any): Promise<Response> {
  const userId = getUserFromJWT(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabase = getServiceClient();
  const { ipv4, ipv6 } = extractClientIP(req);
  const ip = ipv4 || ipv6;

  // Geo enrichment: merge browser geo (from frontend) with server-side IP geo
  const [ipGeo] = await Promise.all([enrichGeo(ip)]);

  const latitude = body.latitude ?? ipGeo.latitude;
  const longitude = body.longitude ?? ipGeo.longitude;

  const sessionToken = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('user_sessions')
    .insert({
      user_id: userId,
      tenant_id: body.tenant_id ?? null,
      session_token: sessionToken,
      login_at: now,
      last_activity: now,
      ip_address: ipv4,
      ipv6: ipv6,
      country: ipGeo.country,
      state: ipGeo.state,
      city: ipGeo.city,
      latitude,
      longitude,
      browser: body.browser ?? null,
      browser_version: body.browser_version ?? null,
      os: body.os ?? null,
      device_type: body.device_type ?? null,
      user_agent: body.user_agent ?? null,
      login_method: body.login_method ?? 'password',
      sso_provider: body.sso_provider ?? null,
      is_mobile: body.is_mobile ?? false,
      is_vpn: ipGeo.is_vpn,
      is_proxy: ipGeo.is_proxy,
      status: 'online',
    })
    .select('id, session_token')
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  // Emit event via pg_notify for realtime listeners
  await supabase.rpc('pg_notify_session_event', {
    event_type: 'session_started',
    session_id: data.id,
    user_id: userId,
  }).catch(() => { /* non-critical */ });

  return new Response(JSON.stringify({
    session_id: data.id,
    session_token: data.session_token,
    geo: { country: ipGeo.country, state: ipGeo.state, city: ipGeo.city, is_vpn: ipGeo.is_vpn, is_proxy: ipGeo.is_proxy },
  }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleHeartbeat(req: Request, body: any): Promise<Response> {
  const userId = getUserFromJWT(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabase = getServiceClient();
  const sessionId = body.session_id;
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'session_id required' }), { status: 400, headers: corsHeaders });
  }

  const { error } = await supabase
    .from('user_sessions')
    .update({
      last_activity: new Date().toISOString(),
      status: 'online',
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleEnd(req: Request, body: any): Promise<Response> {
  const userId = getUserFromJWT(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabase = getServiceClient();
  const sessionId = body.session_id;
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'session_id required' }), { status: 400, headers: corsHeaders });
  }

  // Get login_at to compute duration
  const { data: session } = await supabase
    .from('user_sessions')
    .select('login_at')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  const now = new Date();
  const duration = session?.login_at
    ? Math.floor((now.getTime() - new Date(session.login_at).getTime()) / 1000)
    : null;

  const { error } = await supabase
    .from('user_sessions')
    .update({
      status: 'offline',
      logout_at: now.toISOString(),
      session_duration: duration,
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  // Emit event
  await supabase.rpc('pg_notify_session_event', {
    event_type: 'session_ended',
    session_id: sessionId,
    user_id: userId,
  }).catch(() => {});

  return new Response(JSON.stringify({ ok: true, duration }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleExpireStale(_req: Request): Promise<Response> {
  const supabase = getServiceClient();

  // Expire sessions with no heartbeat in last 5 minutes
  const threshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('user_sessions')
    .update({ status: 'expired' })
    .in('status', ['online', 'idle'])
    .lt('last_activity', threshold)
    .select('id');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ expired: data?.length ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ════════════════════════════════════
// ROUTER
// ════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = req.method === 'POST' ? await req.json() : {};
    const action = body.action ?? new URL(req.url).searchParams.get('action') ?? '';

    switch (action) {
      case 'start':
        return await handleStart(req, body);
      case 'heartbeat':
        return await handleHeartbeat(req, body);
      case 'end':
        return await handleEnd(req, body);
      case 'expire_stale':
        return await handleExpireStale(req);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: corsHeaders });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
