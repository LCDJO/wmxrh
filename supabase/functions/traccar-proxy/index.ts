/**
 * traccar-proxy — Generic authenticated proxy to the full Traccar REST API.
 * Reads credentials from tenant_integration_configs table.
 *
 * Body JSON params:
 *   action     — The API action to perform (see ACTION_MAP below)
 *   tenantId   — tenant UUID to look up config
 *   ...params  — Action-specific parameters (deviceId, from, to, groupId, etc.)
 *   payload    — (optional) JSON body for POST/PUT/DELETE methods
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Action → Traccar path builder ──
type ActionDef = {
  buildPath: (p: Record<string, unknown>) => string;
  method?: string; // defaults to GET
  hasBody?: boolean;
};

function qs(params: Record<string, string | string[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      for (const item of v) sp.append(k, item);
    } else {
      sp.set(k, v);
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const ACTION_MAP: Record<string, ActionDef> = {
  // ── Server ──
  'test-connection':    { buildPath: () => '/api/server' },
  'server-info':        { buildPath: () => '/api/server' },
  'server-geocode':     { buildPath: (p) => `/api/server/geocode${qs({ latitude: String(p.latitude ?? ''), longitude: String(p.longitude ?? '') })}` },

  // ── Devices ──
  'devices':            { buildPath: () => '/api/devices' },
  'device-detail':      { buildPath: (p) => `/api/devices${qs({ id: String(p.deviceId ?? '') })}` },
  'device-create':      { buildPath: () => '/api/devices', method: 'POST', hasBody: true },
  'device-update':      { buildPath: () => '/api/devices', method: 'PUT', hasBody: true },
  'device-delete':      { buildPath: (p) => `/api/devices/${p.deviceId}`, method: 'DELETE' },

  // ── Groups ──
  'groups':             { buildPath: () => '/api/groups' },
  'group-create':       { buildPath: () => '/api/groups', method: 'POST', hasBody: true },
  'group-update':       { buildPath: () => '/api/groups', method: 'PUT', hasBody: true },
  'group-delete':       { buildPath: (p) => `/api/groups/${p.groupId}`, method: 'DELETE' },

  // ── Positions ──
  'positions':          { buildPath: (p) => `/api/positions${qs({ deviceId: String(p.deviceId ?? ''), from: String(p.from ?? ''), to: String(p.to ?? '') })}` },

  // ── Events ──
  'event-detail':       { buildPath: (p) => `/api/events/${p.eventId}` },

  // ── Reports ──
  'reports-events':     { buildPath: (p) => `/api/reports/events${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], type: p.eventType as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-route':      { buildPath: (p) => `/api/reports/route${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-summary':    { buildPath: (p) => `/api/reports/summary${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-trips':      { buildPath: (p) => `/api/reports/trips${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-stops':      { buildPath: (p) => `/api/reports/stops${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-geofences':  { buildPath: (p) => `/api/reports/geofences${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], geofenceId: p.geofenceId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },

  // ── Notifications ──
  'notifications':      { buildPath: () => '/api/notifications' },
  'notification-types': { buildPath: () => '/api/notifications/types' },
  'notification-create':{ buildPath: () => '/api/notifications', method: 'POST', hasBody: true },
  'notification-update':{ buildPath: (p) => `/api/notifications/${p.notificationId}`, method: 'PUT', hasBody: true },
  'notification-delete':{ buildPath: (p) => `/api/notifications/${p.notificationId}`, method: 'DELETE' },
  'notification-test':  { buildPath: () => '/api/notifications/test', method: 'POST' },

  // ── Geofences ──
  'geofences':          { buildPath: () => '/api/geofences' },
  'geofence-create':    { buildPath: () => '/api/geofences', method: 'POST', hasBody: true },
  'geofence-update':    { buildPath: () => '/api/geofences', method: 'PUT', hasBody: true },
  'geofence-delete':    { buildPath: (p) => `/api/geofences/${p.geofenceId}`, method: 'DELETE' },

  // ── Commands ──
  'commands':           { buildPath: () => '/api/commands' },
  'commands-send':      { buildPath: () => '/api/commands/send', method: 'POST', hasBody: true },
  'commands-types':     { buildPath: (p) => `/api/commands/types${qs({ deviceId: String(p.deviceId ?? '') })}` },

  // ── Drivers ──
  'drivers':            { buildPath: () => '/api/drivers' },
  'driver-create':      { buildPath: () => '/api/drivers', method: 'POST', hasBody: true },
  'driver-update':      { buildPath: () => '/api/drivers', method: 'PUT', hasBody: true },
  'driver-delete':      { buildPath: (p) => `/api/drivers/${p.driverId}`, method: 'DELETE' },

  // ── Maintenance ──
  'maintenance':        { buildPath: () => '/api/maintenance' },
  'maintenance-create': { buildPath: () => '/api/maintenance', method: 'POST', hasBody: true },
  'maintenance-update': { buildPath: () => '/api/maintenance', method: 'PUT', hasBody: true },
  'maintenance-delete': { buildPath: (p) => `/api/maintenance/${p.maintenanceId}`, method: 'DELETE' },

  // ── Calendars ──
  'calendars':          { buildPath: () => '/api/calendars' },

  // ── Permissions ──
  'permission-link':    { buildPath: () => '/api/permissions', method: 'POST', hasBody: true },
  'permission-unlink':  { buildPath: () => '/api/permissions', method: 'DELETE', hasBody: true },

  // ── Statistics & Health ──
  'statistics':         { buildPath: (p) => `/api/statistics${qs({ from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'health':             { buildPath: () => '/api/health' },

  // ── Legacy aliases ──
  'events':             { buildPath: (p) => `/api/reports/events${qs({ deviceId: String(p.deviceId ?? ''), from: String(p.from ?? ''), to: String(p.to ?? ''), type: String(p.eventType ?? '') })}` },
};

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResp({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return jsonResp({ error: 'Unauthorized' }, 401);
    }

    // ── Parse body ──
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      const url = new URL(req.url);
      body = {
        action: url.searchParams.get('action') || 'test-connection',
        tenantId: url.searchParams.get('tenantId') || '',
        deviceId: url.searchParams.get('deviceId') || '',
      };
    }

    const action = String(body.action || 'test-connection');
    const tenantId = String(body.tenantId || '');

    if (!tenantId) {
      return jsonResp({ error: 'tenantId is required' }, 400);
    }

    // ── Resolve action ──
    const actionDef = ACTION_MAP[action];
    if (!actionDef) {
      return jsonResp({ error: `Unknown action: ${action}. Available: ${Object.keys(ACTION_MAP).join(', ')}` }, 400);
    }

    // ── Fetch Traccar credentials ──
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: configRow, error: configError } = await supabaseAdmin
      .from('tenant_integration_configs')
      .select('config')
      .eq('tenant_id', tenantId)
      .eq('integration_key', 'traccar')
      .maybeSingle();

    if (configError || !configRow?.config) {
      return jsonResp({ error: 'Configuração do Traccar não encontrada. Salve a URL e o token na aba Configurações.' }, 400);
    }

    const cfg = configRow.config as Record<string, string>;
    const TRACCAR_BASE_URL = cfg.api_url;
    const TRACCAR_API_TOKEN = cfg.api_token;

    if (!TRACCAR_BASE_URL || !TRACCAR_API_TOKEN) {
      return jsonResp({ error: 'URL ou Token do Traccar não configurados.' }, 400);
    }

    const baseUrl = TRACCAR_BASE_URL.replace(/\/+$/, '');

    // ── Build Traccar path ──
    const traccarPath = actionDef.buildPath(body);
    const httpMethod = actionDef.method || 'GET';

    // ── Session-based auth (Traccar requires JSESSIONID cookie) ──
    const sessionResp = await fetch(`${baseUrl}/api/session?token=${encodeURIComponent(TRACCAR_API_TOKEN)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!sessionResp.ok) {
      const errText = await sessionResp.text();
      return jsonResp({ error: `Falha ao autenticar no Traccar (${sessionResp.status})`, details: errText }, sessionResp.status);
    }

    const setCookieHeader = sessionResp.headers.get('set-cookie') || '';
    const cookieMatch = setCookieHeader.match(/JSESSIONID=[^;]+/);
    const sessionCookie = cookieMatch ? cookieMatch[0] : '';

    // ── Make the API call ──
    const traccarHeaders: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (sessionCookie) {
      traccarHeaders['Cookie'] = sessionCookie;
    }

    const fetchOptions: RequestInit = {
      method: httpMethod,
      headers: traccarHeaders,
    };

    if (actionDef.hasBody && body.payload) {
      fetchOptions.body = JSON.stringify(body.payload);
    }

    const traccarResp = await fetch(`${baseUrl}${traccarPath}`, fetchOptions);

    // Handle 204 No Content
    if (traccarResp.status === 204) {
      return jsonResp({ success: true, action, data: null });
    }

    const contentType = traccarResp.headers.get('content-type') || '';
    let responseBody: unknown;

    if (contentType.includes('application/json')) {
      responseBody = await traccarResp.json();
    } else {
      responseBody = { raw: await traccarResp.text() };
    }

    if (!traccarResp.ok) {
      return jsonResp({ error: `Traccar API returned ${traccarResp.status}`, details: responseBody }, traccarResp.status);
    }

    return jsonResp({ success: true, action, data: responseBody });
  } catch (err) {
    console.error('traccar-proxy error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResp({ error: message }, 500);
  }
});