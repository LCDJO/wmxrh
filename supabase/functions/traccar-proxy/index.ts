/**
 * traccar-proxy — Authenticated proxy to the Traccar REST API.
 *
 * Architecture:
 *  ├── Multi-strategy auth: session-cookie → token-param → bearer
 *  ├── Strict Content-Type validation (HTML detection)
 *  ├── Health check endpoint for monitoring
 *  ├── Audit logging for mutations
 *  └── Array validation for list endpoints
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ══════════════════════════════════════════════════════════
// ACTION MAP — Traccar API path definitions
// ══════════════════════════════════════════════════════════

type ActionDef = {
  buildPath: (p: Record<string, unknown>) => string;
  method?: string;
  hasBody?: boolean;
  isMutation?: boolean;
};

function qs(params: Record<string, string | string[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v)) for (const item of v) sp.append(k, item);
    else sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const ACTION_MAP: Record<string, ActionDef> = {
  // Server
  'test-connection':    { buildPath: () => '/api/server' },
  'server-info':        { buildPath: () => '/api/server' },
  'health-check':       { buildPath: () => '/api/server' },

  // Devices
  'devices':            { buildPath: () => '/api/devices' },
  'device-detail':      { buildPath: (p) => `/api/devices${qs({ id: String(p.deviceId ?? '') })}` },
  'device-create':      { buildPath: () => '/api/devices', method: 'POST', hasBody: true, isMutation: true },
  'device-update':      { buildPath: () => '/api/devices', method: 'PUT', hasBody: true, isMutation: true },
  'device-delete':      { buildPath: (p) => `/api/devices/${p.deviceId}`, method: 'DELETE', isMutation: true },

  // Groups
  'groups':             { buildPath: () => '/api/groups' },
  'group-create':       { buildPath: () => '/api/groups', method: 'POST', hasBody: true, isMutation: true },
  'group-update':       { buildPath: () => '/api/groups', method: 'PUT', hasBody: true, isMutation: true },
  'group-delete':       { buildPath: (p) => `/api/groups/${p.groupId}`, method: 'DELETE', isMutation: true },

  // Positions
  'positions':          { buildPath: (p) => `/api/positions${qs({ deviceId: String(p.deviceId ?? ''), from: String(p.from ?? ''), to: String(p.to ?? '') })}` },

  // Events
  'event-detail':       { buildPath: (p) => `/api/events/${p.eventId}` },

  // Reports
  'reports-events':     { buildPath: (p) => `/api/reports/events${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], type: p.eventType as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-route':      { buildPath: (p) => `/api/reports/route${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-summary':    { buildPath: (p) => `/api/reports/summary${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-trips':      { buildPath: (p) => `/api/reports/trips${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },
  'reports-stops':      { buildPath: (p) => `/api/reports/stops${qs({ deviceId: p.deviceId as string | string[], groupId: p.groupId as string | string[], from: String(p.from ?? ''), to: String(p.to ?? '') })}` },

  // Notifications
  'notifications':      { buildPath: () => '/api/notifications' },
  'notification-types': { buildPath: () => '/api/notifications/types' },
  'notification-create':{ buildPath: () => '/api/notifications', method: 'POST', hasBody: true, isMutation: true },
  'notification-update':{ buildPath: (p) => `/api/notifications/${p.notificationId}`, method: 'PUT', hasBody: true, isMutation: true },
  'notification-delete':{ buildPath: (p) => `/api/notifications/${p.notificationId}`, method: 'DELETE', isMutation: true },

  // Geofences
  'geofences':          { buildPath: () => '/api/geofences' },
  'geofence-create':    { buildPath: () => '/api/geofences', method: 'POST', hasBody: true, isMutation: true },
  'geofence-update':    { buildPath: () => '/api/geofences', method: 'PUT', hasBody: true, isMutation: true },
  'geofence-delete':    { buildPath: (p) => `/api/geofences/${p.geofenceId}`, method: 'DELETE', isMutation: true },

  // Commands
  'commands':           { buildPath: () => '/api/commands' },
  'commands-send':      { buildPath: () => '/api/commands/send', method: 'POST', hasBody: true, isMutation: true },
  'commands-types':     { buildPath: (p) => `/api/commands/types${qs({ deviceId: String(p.deviceId ?? '') })}` },

  // Drivers
  'drivers':            { buildPath: () => '/api/drivers' },
  'driver-create':      { buildPath: () => '/api/drivers', method: 'POST', hasBody: true, isMutation: true },
  'driver-update':      { buildPath: () => '/api/drivers', method: 'PUT', hasBody: true, isMutation: true },
  'driver-delete':      { buildPath: (p) => `/api/drivers/${p.driverId}`, method: 'DELETE', isMutation: true },

  // Maintenance
  'maintenance':        { buildPath: () => '/api/maintenance' },
  'maintenance-create': { buildPath: () => '/api/maintenance', method: 'POST', hasBody: true, isMutation: true },
  'maintenance-update': { buildPath: () => '/api/maintenance', method: 'PUT', hasBody: true, isMutation: true },
  'maintenance-delete': { buildPath: (p) => `/api/maintenance/${p.maintenanceId}`, method: 'DELETE', isMutation: true },

  // Permissions
  'permission-link':    { buildPath: () => '/api/permissions', method: 'POST', hasBody: true, isMutation: true },
  'permission-unlink':  { buildPath: () => '/api/permissions', method: 'DELETE', hasBody: true, isMutation: true },

  // Statistics
  'statistics':         { buildPath: (p) => `/api/statistics${qs({ from: String(p.from ?? ''), to: String(p.to ?? '') })}` },

  // Sync (bulk fetch for polling fallback)
  'sync-devices-positions': { buildPath: () => '/api/devices' },
};

const LIST_ACTIONS = new Set([
  'devices', 'groups', 'positions', 'notifications', 'geofences', 'drivers',
  'maintenance', 'commands', 'reports-events', 'reports-route', 'reports-summary',
  'reports-trips', 'reports-stops', 'statistics', 'sync-devices-positions',
]);

// ══════════════════════════════════════════════════════════
// RESPONSE HELPERS
// ══════════════════════════════════════════════════════════

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface ParseResult {
  ok: boolean;
  status: number;
  data: unknown;
  isHtml: boolean;
}

async function parseResponse(resp: Response, label: string): Promise<ParseResult> {
  const textBody = await resp.text();
  const trimmed = textBody.trim();

  // Detect HTML error pages from reverse proxies
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.toLowerCase().includes('<!doctype')) {
    console.error(`[traccar-proxy] [${label}] HTML response (${resp.status}): ${trimmed.substring(0, 200)}`);
    return {
      ok: false,
      status: resp.status,
      data: {
        error: `Traccar retornou HTML em vez de JSON (HTTP ${resp.status}). Verifique a URL do servidor.`,
        hint: 'Possíveis causas: proxy reverso, URL incorreta, servidor inacessível.',
      },
      isHtml: true,
    };
  }

  try {
    return { ok: resp.ok, status: resp.status, data: JSON.parse(textBody), isHtml: false };
  } catch {
    const ct = resp.headers.get('content-type') || '';
    console.error(`[traccar-proxy] [${label}] Non-JSON (${ct}): ${textBody.substring(0, 200)}`);
    return {
      ok: false,
      status: resp.status,
      data: { error: `Formato inesperado (Content-Type: ${ct || 'ausente'}).`, raw: textBody.substring(0, 300) },
      isHtml: false,
    };
  }
}

// ══════════════════════════════════════════════════════════
// TRACCAR CLIENT — Multi-strategy authentication
// ══════════════════════════════════════════════════════════

async function traccarFetch(
  baseUrl: string, path: string, token: string, method: string, body?: string
): Promise<ParseResult> {
  const headers: Record<string, string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

  // Strategy 1: Session cookie via /api/session
  try {
    const sessionResp = await fetch(`${baseUrl}/api/session?token=${encodeURIComponent(token)}`, {
      method: 'GET', headers: { 'Accept': 'application/json' }, redirect: 'manual',
    });
    const setCookie = sessionResp.headers.get('set-cookie') || '';
    const cookieMatch = setCookie.match(/JSESSIONID=[^;]+/);
    await parseResponse(sessionResp, 'session'); // consume body

    if (cookieMatch && sessionResp.ok) {
      const opts: RequestInit = { method, headers: { ...headers, 'Cookie': cookieMatch[0] }, redirect: 'manual' };
      if (body) opts.body = body;
      const resp = await fetch(`${baseUrl}${path}`, opts);
      const result = await parseResponse(resp, 'cookie');
      if (result.ok && !result.isHtml) return result;
    }
  } catch (e) {
    console.warn(`[traccar-proxy] Session strategy failed:`, e);
  }

  // Strategy 2: Token as query parameter
  try {
    const sep = path.includes('?') ? '&' : '?';
    const opts: RequestInit = { method, headers, redirect: 'manual' };
    if (body) opts.body = body;
    const resp = await fetch(`${baseUrl}${path}${sep}token=${encodeURIComponent(token)}`, opts);
    const result = await parseResponse(resp, 'token-param');
    if (result.ok && !result.isHtml) return result;
  } catch (e) {
    console.warn(`[traccar-proxy] Token-param strategy failed:`, e);
  }

  // Strategy 3: Bearer header (last resort)
  try {
    const opts: RequestInit = { method, headers: { ...headers, 'Authorization': `Bearer ${token}` }, redirect: 'manual' };
    if (body) opts.body = body;
    const resp = await fetch(`${baseUrl}${path}`, opts);
    return await parseResponse(resp, 'bearer');
  } catch (e) {
    return {
      ok: false, status: 502, isHtml: false,
      data: { error: 'Todas as estratégias de autenticação falharam.', details: String(e) },
    };
  }
}

// ══════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResp({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) return jsonResp({ error: 'Unauthorized' }, 401);

    // ── Parse request ──
    let reqBody: Record<string, unknown> = {};
    try { reqBody = await req.json(); } catch {
      const url = new URL(req.url);
      reqBody = { action: url.searchParams.get('action') || 'test-connection', tenantId: url.searchParams.get('tenantId') || '' };
    }

    const action = String(reqBody.action || 'test-connection');
    const tenantId = String(reqBody.tenantId || '');
    if (!tenantId) return jsonResp({ error: 'tenantId is required' }, 400);

    const actionDef = ACTION_MAP[action];
    if (!actionDef) return jsonResp({ error: `Ação desconhecida: ${action}` }, 400);

    // ── Fetch tenant credentials ──
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: configRow, error: configError } = await supabaseAdmin
      .from('tenant_integration_configs')
      .select('config')
      .eq('tenant_id', tenantId)
      .eq('integration_key', 'traccar')
      .maybeSingle();

    if (configError || !configRow?.config) {
      return jsonResp({ success: false, error: 'Configuração do Traccar não encontrada.' }, 400);
    }

    const cfg = configRow.config as Record<string, string>;
    if (!cfg.api_url || !cfg.api_token) {
      return jsonResp({ success: false, error: 'URL ou Token do Traccar não configurados.' }, 400);
    }

    const baseUrl = cfg.api_url.replace(/\/+$/, '');

    // ── Special: sync-devices-positions (fetches both in one call) ──
    if (action === 'sync-devices-positions') {
      const [devResult, posResult] = await Promise.all([
        traccarFetch(baseUrl, '/api/devices', cfg.api_token, 'GET'),
        traccarFetch(baseUrl, '/api/positions', cfg.api_token, 'GET'),
      ]);

      // Update sync status
      const devices = devResult.ok ? devResult.data as unknown[] : [];
      const positions = posResult.ok ? posResult.data as unknown[] : [];
      const isHealthy = devResult.ok && posResult.ok;

      await supabaseAdmin.from('traccar_sync_status').upsert({
        tenant_id: tenantId,
        sync_type: 'full',
        last_sync_at: new Date().toISOString(),
        last_device_count: Array.isArray(devices) ? devices.length : 0,
        last_position_count: Array.isArray(positions) ? positions.length : 0,
        last_error: isHealthy ? null : 'Partial sync failure',
        consecutive_failures: isHealthy ? 0 : 1,
        is_healthy: isHealthy,
      }, { onConflict: 'tenant_id,sync_type' });

      return jsonResp({
        success: true,
        action,
        data: {
          devices: Array.isArray(devices) ? devices : [],
          positions: Array.isArray(positions) ? positions : [],
        },
      });
    }

    // ── Standard proxy call ──
    const traccarPath = actionDef.buildPath(reqBody);
    const httpMethod = actionDef.method || 'GET';
    const actionBody = actionDef.hasBody && reqBody.payload ? JSON.stringify(reqBody.payload) : undefined;

    const result = await traccarFetch(baseUrl, traccarPath, cfg.api_token, httpMethod, actionBody);

    if (!result.ok) {
      return jsonResp({
        success: false,
        error: (result.data as Record<string, unknown>)?.error || `Traccar HTTP ${result.status}`,
        details: result.data,
      }, result.status >= 400 && result.status < 600 ? result.status : 502);
    }

    // Validate list endpoints return arrays
    if (LIST_ACTIONS.has(action) && !Array.isArray(result.data)) {
      return jsonResp({
        success: false,
        error: `Resposta inesperada para "${action}": esperava lista, recebeu ${typeof result.data}.`,
        details: result.data,
      }, 502);
    }

    // ── Audit mutation actions ──
    if (actionDef.isMutation) {
      supabaseAdmin.from('fleet_audit_log').insert({
        tenant_id: tenantId,
        action: `traccar:${action}`,
        entity_type: 'traccar_resource',
        user_id: user.id,
        details: { action, payload: reqBody.payload },
      }).then(() => {}).catch(() => {});
    }

    // ── Health check enrichment ──
    if (action === 'health-check') {
      const serverData = result.data as Record<string, unknown>;
      return jsonResp({
        success: true,
        action,
        data: {
          ...serverData,
          _health: {
            status: 'connected',
            checked_at: new Date().toISOString(),
            proxy_version: '2.0.0',
          },
        },
      });
    }

    return jsonResp({ success: true, action, data: result.data });
  } catch (err) {
    console.error('[traccar-proxy] Error:', err);
    return jsonResp({ success: false, error: err instanceof Error ? err.message : 'Erro desconhecido' }, 500);
  }
});
