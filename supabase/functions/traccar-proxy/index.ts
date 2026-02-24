/**
 * traccar-proxy — Authenticated proxy to the Traccar REST API.
 * Multi-strategy auth: session-cookie (primary) → token-param → bearer header.
 * Strict Content-Type validation to detect HTML error pages.
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
  return s ? `?${s}` : '';
}

const ACTION_MAP: Record<string, ActionDef> = {
  'test-connection':    { buildPath: () => '/api/server' },
  'server-info':        { buildPath: () => '/api/server' },
  'devices':            { buildPath: () => '/api/devices' },
  'device-detail':      { buildPath: (p) => `/api/devices${qs({ id: String(p.deviceId ?? '') })}` },
  'device-create':      { buildPath: () => '/api/devices', method: 'POST', hasBody: true },
  'device-update':      { buildPath: () => '/api/devices', method: 'PUT', hasBody: true },
  'device-delete':      { buildPath: (p) => `/api/devices/${p.deviceId}`, method: 'DELETE' },
  'groups':             { buildPath: () => '/api/groups' },
  'group-create':       { buildPath: () => '/api/groups', method: 'POST', hasBody: true },
  'group-update':       { buildPath: () => '/api/groups', method: 'PUT', hasBody: true },
  'group-delete':       { buildPath: (p) => `/api/groups/${p.groupId}`, method: 'DELETE' },
  'positions':          { buildPath: (p) => `/api/positions${qs({ deviceId: String(p.deviceId ?? ''), from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'event-detail':       { buildPath: (p) => `/api/events/${p.eventId}` },
  'reports-events':     { buildPath: (p) => `/api/reports/events${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], type: p.eventType as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-route':      { buildPath: (p) => `/api/reports/route${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-summary':    { buildPath: (p) => `/api/reports/summary${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-trips':      { buildPath: (p) => `/api/reports/trips${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-stops':      { buildPath: (p) => `/api/reports/stops${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'notifications':      { buildPath: () => '/api/notifications' },
  'notification-types': { buildPath: () => '/api/notifications/types' },
  'notification-create':{ buildPath: () => '/api/notifications', method: 'POST', hasBody: true },
  'notification-update':{ buildPath: (p) => `/api/notifications/${p.notificationId}`, method: 'PUT', hasBody: true },
  'notification-delete':{ buildPath: (p) => `/api/notifications/${p.notificationId}`, method: 'DELETE' },
  'geofences':          { buildPath: () => '/api/geofences' },
  'geofence-create':    { buildPath: () => '/api/geofences', method: 'POST', hasBody: true },
  'geofence-update':    { buildPath: () => '/api/geofences', method: 'PUT', hasBody: true },
  'geofence-delete':    { buildPath: (p) => `/api/geofences/${p.geofenceId}`, method: 'DELETE' },
  'commands':           { buildPath: () => '/api/commands' },
  'commands-send':      { buildPath: () => '/api/commands/send', method: 'POST', hasBody: true },
  'commands-types':     { buildPath: (p) => `/api/commands/types${qs({ deviceId: String(p.deviceId ?? '') })}` },
  'drivers':            { buildPath: () => '/api/drivers' },
  'driver-create':      { buildPath: () => '/api/drivers', method: 'POST', hasBody: true },
  'driver-update':      { buildPath: () => '/api/drivers', method: 'PUT', hasBody: true },
  'driver-delete':      { buildPath: (p) => `/api/drivers/${p.driverId}`, method: 'DELETE' },
  'maintenance':        { buildPath: () => '/api/maintenance' },
  'maintenance-create': { buildPath: () => '/api/maintenance', method: 'POST', hasBody: true },
  'maintenance-update': { buildPath: () => '/api/maintenance', method: 'PUT', hasBody: true },
  'maintenance-delete': { buildPath: (p) => `/api/maintenance/${p.maintenanceId}`, method: 'DELETE' },
  'permission-link':    { buildPath: () => '/api/permissions', method: 'POST', hasBody: true },
  'permission-unlink':  { buildPath: () => '/api/permissions', method: 'DELETE', hasBody: true },
  'statistics':         { buildPath: (p) => `/api/statistics${qs({ from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
};

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Safely parse response, validating Content-Type and detecting HTML */
async function parseResponse(resp: Response, label: string): Promise<{ ok: boolean; status: number; data: unknown; isHtml: boolean }> {
  const contentType = resp.headers.get('content-type') || '';
  const textBody = await resp.text();

  // Detect HTML error pages
  const trimmed = textBody.trim();
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.toLowerCase().includes('<!doctype')) {
    console.error(`[traccar-proxy] [${label}] HTML response (status ${resp.status}): ${trimmed.substring(0, 200)}`);
    return {
      ok: false,
      status: resp.status,
      data: {
        error: `Traccar retornou HTML em vez de JSON (HTTP ${resp.status}). Verifique se a URL do servidor está correta e acessível.`,
        hint: 'Possíveis causas: proxy reverso interceptando, URL incorreta, ou servidor Traccar inacessível.',
      },
      isHtml: true,
    };
  }

  // Try JSON parse
  try {
    const parsed = JSON.parse(textBody);
    return { ok: resp.ok, status: resp.status, data: parsed, isHtml: false };
  } catch {
    // Not JSON, not HTML — unknown format
    console.error(`[traccar-proxy] [${label}] Non-JSON response (${contentType}): ${textBody.substring(0, 200)}`);
    return {
      ok: false,
      status: resp.status,
      data: {
        error: `Formato de resposta inesperado do Traccar (Content-Type: ${contentType || 'ausente'}).`,
        raw: textBody.substring(0, 300),
      },
      isHtml: false,
    };
  }
}

/**
 * Multi-strategy Traccar auth:
 * 1. Session cookie via /api/session?token=... (most reliable)
 * 2. Token as query parameter fallback
 * 3. Basic Auth fallback (email:password style tokens)
 */
async function traccarFetch(
  baseUrl: string,
  path: string,
  token: string,
  method: string,
  body?: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  // ── Strategy 1: Establish session via /api/session, then use JSESSIONID cookie ──
  console.log(`[traccar-proxy] Strategy 1: session cookie for ${method} ${path}`);
  try {
    const sessionUrl = `${baseUrl}/api/session?token=${encodeURIComponent(token)}`;
    const sessionResp = await fetch(sessionUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'manual', // Don't follow redirects to catch HTML pages
    });

    const setCookie = sessionResp.headers.get('set-cookie') || '';
    const cookieMatch = setCookie.match(/JSESSIONID=[^;]+/);

    // Consume session response body
    const sessionParsed = await parseResponse(sessionResp, 'session');

    if (cookieMatch && sessionResp.ok) {
      console.log(`[traccar-proxy] Session established, cookie obtained`);
      const cookieHeaders = { ...headers, 'Cookie': cookieMatch[0] };
      const opts: RequestInit = { method, headers: cookieHeaders, redirect: 'manual' };
      if (body) opts.body = body;

      const resp = await fetch(`${baseUrl}${path}`, opts);
      const result = await parseResponse(resp, 'cookie-request');

      if (result.ok && !result.isHtml) {
        return result;
      }
      console.warn(`[traccar-proxy] Cookie request failed (${result.status}), trying next strategy...`);
    } else {
      console.warn(`[traccar-proxy] Session creation failed: status=${sessionResp.status}, cookie=${!!cookieMatch}, body=${JSON.stringify(sessionParsed.data).substring(0, 150)}`);
    }
  } catch (e) {
    console.warn(`[traccar-proxy] Strategy 1 (session) error:`, e);
  }

  // ── Strategy 2: Token as query parameter ──
  console.log(`[traccar-proxy] Strategy 2: token-as-param for ${method} ${path}`);
  try {
    const separator = path.includes('?') ? '&' : '?';
    const urlWithToken = `${baseUrl}${path}${separator}token=${encodeURIComponent(token)}`;
    const opts: RequestInit = { method, headers, redirect: 'manual' };
    if (body) opts.body = body;

    const resp = await fetch(urlWithToken, opts);
    const result = await parseResponse(resp, 'token-param');

    if (result.ok && !result.isHtml) {
      return result;
    }
    console.warn(`[traccar-proxy] Token-param failed (${result.status})`);
  } catch (e) {
    console.warn(`[traccar-proxy] Strategy 2 (token-param) error:`, e);
  }

  // ── Strategy 3: Authorization Bearer header ──
  console.log(`[traccar-proxy] Strategy 3: bearer header for ${method} ${path}`);
  try {
    const bearerHeaders = { ...headers, 'Authorization': `Bearer ${token}` };
    const opts: RequestInit = { method, headers: bearerHeaders, redirect: 'manual' };
    if (body) opts.body = body;

    const resp = await fetch(`${baseUrl}${path}`, opts);
    const result = await parseResponse(resp, 'bearer');

    // Return whatever we got — it's the last strategy
    return result;
  } catch (e) {
    console.error(`[traccar-proxy] All strategies failed:`, e);
    return {
      ok: false,
      status: 502,
      data: {
        error: 'Todas as estratégias de autenticação falharam. Verifique: 1) URL do Traccar correta e acessível, 2) Token de API válido, 3) Servidor Traccar online.',
        details: e instanceof Error ? e.message : String(e),
      },
    };
  }
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
    let reqBody: Record<string, unknown> = {};
    try {
      reqBody = await req.json();
    } catch {
      const url = new URL(req.url);
      reqBody = {
        action: url.searchParams.get('action') || 'test-connection',
        tenantId: url.searchParams.get('tenantId') || '',
      };
    }

    const action = String(reqBody.action || 'test-connection');
    const tenantId = String(reqBody.tenantId || '');

    if (!tenantId) {
      return jsonResp({ error: 'tenantId is required' }, 400);
    }

    const actionDef = ACTION_MAP[action];
    if (!actionDef) {
      return jsonResp({ error: `Ação desconhecida: ${action}. Disponíveis: ${Object.keys(ACTION_MAP).join(', ')}` }, 400);
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
      return jsonResp({
        success: false,
        error: 'Configuração do Traccar não encontrada. Salve a URL e o token na aba Configurações.',
      }, 400);
    }

    const cfg = configRow.config as Record<string, string>;
    const TRACCAR_BASE_URL = cfg.api_url;
    const TRACCAR_API_TOKEN = cfg.api_token;

    if (!TRACCAR_BASE_URL || !TRACCAR_API_TOKEN) {
      return jsonResp({ success: false, error: 'URL ou Token do Traccar não configurados.' }, 400);
    }

    const baseUrl = TRACCAR_BASE_URL.replace(/\/+$/, '');
    const traccarPath = actionDef.buildPath(reqBody);
    const httpMethod = actionDef.method || 'GET';
    const actionBody = actionDef.hasBody && reqBody.payload ? JSON.stringify(reqBody.payload) : undefined;

    console.log(`[traccar-proxy] action=${action}, tenant=${tenantId}, url=${baseUrl}${traccarPath}`);

    // ── Make the API call ──
    const result = await traccarFetch(baseUrl, traccarPath, TRACCAR_API_TOKEN, httpMethod, actionBody);

    if (!result.ok) {
      const errorData = result.data as Record<string, unknown>;
      return jsonResp(
        {
          success: false,
          error: errorData?.error || `Traccar API retornou HTTP ${result.status}`,
          details: errorData,
        },
        result.status >= 400 && result.status < 600 ? result.status : 502
      );
    }

    // Validate list endpoints return arrays
    const listActions = [
      'devices', 'groups', 'positions', 'notifications', 'geofences', 'drivers',
      'maintenance', 'commands', 'reports-events', 'reports-route', 'reports-summary',
      'reports-trips', 'reports-stops', 'statistics',
    ];
    if (listActions.includes(action) && !Array.isArray(result.data)) {
      console.warn(`[traccar-proxy] Expected array for "${action}" but got ${typeof result.data}: ${JSON.stringify(result.data).substring(0, 200)}`);
      return jsonResp({
        success: false,
        error: `Resposta inesperada para "${action}": esperava uma lista, recebeu ${typeof result.data}.`,
        details: result.data,
      }, 502);
    }

    return jsonResp({ success: true, action, data: result.data });
  } catch (err) {
    console.error('[traccar-proxy] Unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return jsonResp({ success: false, error: message }, 500);
  }
});
