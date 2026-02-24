/**
 * traccar-proxy — Authenticated proxy to the Traccar REST API.
 * Uses token-as-query-param auth (most reliable) with session cookie fallback.
 * Validates response Content-Type to detect HTML error pages.
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
  method?: string;
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
  return s ? `&${s}` : '';
}

const ACTION_MAP: Record<string, ActionDef> = {
  // ── Server ──
  'test-connection':    { buildPath: () => '/api/server' },
  'server-info':        { buildPath: () => '/api/server' },

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

  // ── Notifications ──
  'notifications':      { buildPath: () => '/api/notifications' },
  'notification-types': { buildPath: () => '/api/notifications/types' },
  'notification-create':{ buildPath: () => '/api/notifications', method: 'POST', hasBody: true },
  'notification-update':{ buildPath: (p) => `/api/notifications/${p.notificationId}`, method: 'PUT', hasBody: true },
  'notification-delete':{ buildPath: (p) => `/api/notifications/${p.notificationId}`, method: 'DELETE' },

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

  // ── Permissions ──
  'permission-link':    { buildPath: () => '/api/permissions', method: 'POST', hasBody: true },
  'permission-unlink':  { buildPath: () => '/api/permissions', method: 'DELETE', hasBody: true },

  // ── Statistics ──
  'statistics':         { buildPath: (p) => `/api/statistics${qs({ from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
};

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Multi-strategy Traccar auth:
 * 1. Token as query parameter (most reliable, works on all Traccar versions)
 * 2. Session cookie fallback
 * 3. Bearer header fallback
 */
async function traccarFetch(
  baseUrl: string,
  path: string,
  token: string,
  method: string,
  body?: string
): Promise<{ ok: boolean; status: number; data: unknown; contentType: string }> {
  // Strategy 1: Token as query parameter (primary)
  const separator = path.includes('?') ? '&' : '?';
  const urlWithToken = `${baseUrl}${path}${separator}token=${encodeURIComponent(token)}`;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  const opts: RequestInit = { method, headers };
  if (body) opts.body = body;

  console.log(`[traccar-proxy] ${method} ${path} (token-as-param)`);

  let resp = await fetch(urlWithToken, opts);

  // If token-as-param returns 401/403, try session cookie
  if (resp.status === 401 || resp.status === 403) {
    console.log('[traccar-proxy] Token-param auth failed, trying session cookie...');
    await resp.text(); // consume body

    try {
      const sessionResp = await fetch(`${baseUrl}/api/session?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (sessionResp.ok) {
        const setCookie = sessionResp.headers.get('set-cookie') || '';
        const cookieMatch = setCookie.match(/JSESSIONID=[^;]+/);
        await sessionResp.text(); // consume

        if (cookieMatch) {
          const cookieHeaders = { ...headers, 'Cookie': cookieMatch[0] };
          const cookieOpts: RequestInit = { method, headers: cookieHeaders };
          if (body) cookieOpts.body = body;

          resp = await fetch(`${baseUrl}${path}`, cookieOpts);
        }
      } else {
        await sessionResp.text(); // consume
      }
    } catch (e) {
      console.warn('[traccar-proxy] Session fallback failed:', e);
    }
  }

  // Validate response
  const contentType = resp.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const textBody = await resp.text();
    const preview = textBody.substring(0, 300);

    // Detect HTML error pages
    if (textBody.trim().startsWith('<!') || textBody.includes('<html')) {
      console.error(`[traccar-proxy] HTML response detected (status ${resp.status}):`, preview);
      return {
        ok: false,
        status: resp.status,
        data: {
          error: `Traccar retornou HTML em vez de JSON (HTTP ${resp.status}). Isso geralmente indica: redirecionamento de autenticação, erro do servidor ou proxy reverso mal configurado.`,
          htmlPreview: preview,
        },
        contentType,
      };
    }

    // Try to parse as JSON anyway (some servers don't set content-type)
    try {
      const parsed = JSON.parse(textBody);
      return { ok: resp.ok, status: resp.status, data: parsed, contentType: 'application/json' };
    } catch {
      console.error(`[traccar-proxy] Unexpected response format (${contentType}):`, preview);
      return {
        ok: false,
        status: resp.status,
        data: { error: `Formato de resposta inesperado: ${contentType || 'sem content-type'}`, raw: preview },
        contentType,
      };
    }
  }

  const jsonData = await resp.json();
  return { ok: resp.ok, status: resp.status, data: jsonData, contentType };
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
    const traccarPath = actionDef.buildPath(body);
    const httpMethod = actionDef.method || 'GET';
    const reqBody = actionDef.hasBody && body.payload ? JSON.stringify(body.payload) : undefined;

    // ── Make the API call with multi-strategy auth ──
    const result = await traccarFetch(baseUrl, traccarPath, TRACCAR_API_TOKEN, httpMethod, reqBody);

    if (!result.ok) {
      return jsonResp(
        { error: `Traccar API retornou ${result.status}`, details: result.data },
        result.status >= 400 && result.status < 600 ? result.status : 502
      );
    }

    // Validate expected array for list endpoints
    const listActions = ['devices', 'groups', 'positions', 'notifications', 'geofences', 'drivers', 'maintenance', 'commands',
      'reports-events', 'reports-route', 'reports-summary', 'reports-trips', 'reports-stops', 'statistics'];
    if (listActions.includes(action) && !Array.isArray(result.data)) {
      console.warn(`[traccar-proxy] Expected array for ${action} but got:`, typeof result.data, JSON.stringify(result.data).substring(0, 200));
      return jsonResp({
        error: `Resposta inesperada do Traccar para "${action}". Esperava uma lista, recebeu ${typeof result.data}.`,
        details: result.data,
      }, 502);
    }

    return jsonResp({ success: true, action, data: result.data });
  } catch (err) {
    console.error('traccar-proxy error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResp({ error: message }, 500);
  }
});
