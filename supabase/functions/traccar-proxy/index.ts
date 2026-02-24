/**
 * traccar-proxy — Authenticated proxy to Traccar REST API.
 * Reads credentials from tenant_integration_configs table.
 *
 * Body JSON params:
 *   action     — test-connection | devices | positions | device-detail
 *   deviceId   — (optional) for device-detail
 *   tenantId   — tenant UUID to look up config
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User auth client
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse body ──
    let body: Record<string, string> = {};
    try {
      body = await req.json();
    } catch {
      // Also support query params as fallback
      const url = new URL(req.url);
      body = {
        action: url.searchParams.get('action') || 'test-connection',
        tenantId: url.searchParams.get('tenantId') || '',
        deviceId: url.searchParams.get('deviceId') || '',
      };
    }

    const action = body.action || 'test-connection';
    const tenantId = body.tenantId;
    const deviceId = body.deviceId;

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenantId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch Traccar credentials from tenant_integration_configs ──
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: configRow, error: configError } = await supabaseAdmin
      .from('tenant_integration_configs')
      .select('config')
      .eq('tenant_id', tenantId)
      .eq('integration_key', 'traccar')
      .maybeSingle();

    if (configError || !configRow?.config) {
      return new Response(JSON.stringify({
        error: 'Configuração do Traccar não encontrada. Salve a URL e o token na aba Configurações.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cfg = configRow.config as Record<string, string>;
    const TRACCAR_BASE_URL = cfg.api_url;
    const TRACCAR_API_TOKEN = cfg.api_token;

    if (!TRACCAR_BASE_URL || !TRACCAR_API_TOKEN) {
      return new Response(JSON.stringify({
        error: 'URL ou Token do Traccar não configurados.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = TRACCAR_BASE_URL.replace(/\/+$/, '');

    // ── Build Traccar path ──
    let traccarPath = '/api/server';

    switch (action) {
      case 'test-connection':
        traccarPath = '/api/server';
        break;
      case 'devices':
        traccarPath = '/api/devices';
        break;
      case 'positions':
        traccarPath = '/api/positions';
        break;
      case 'device-detail':
        traccarPath = deviceId ? `/api/devices?id=${deviceId}` : '/api/devices';
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // ── First, create a session using the token (Traccar official method) ──
    // Traccar uses session cookies for auth; Bearer token only works for /api/server
    const sessionResp = await fetch(`${baseUrl}/api/session?token=${encodeURIComponent(TRACCAR_API_TOKEN)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!sessionResp.ok) {
      const errText = await sessionResp.text();
      return new Response(JSON.stringify({
        error: `Falha ao autenticar no Traccar (${sessionResp.status})`,
        details: errText,
      }), {
        status: sessionResp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract session cookie from response
    const setCookieHeader = sessionResp.headers.get('set-cookie') || '';
    const cookieMatch = setCookieHeader.match(/JSESSIONID=[^;]+/);
    const sessionCookie = cookieMatch ? cookieMatch[0] : '';

    // ── Now make the actual API call with the session cookie ──
    const traccarHeaders: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (sessionCookie) {
      traccarHeaders['Cookie'] = sessionCookie;
    }

    const traccarResp = await fetch(`${baseUrl}${traccarPath}`, {
      method: 'GET',
      headers: traccarHeaders,
    });

    const contentType = traccarResp.headers.get('content-type') || '';
    let responseBody: unknown;

    if (contentType.includes('application/json')) {
      responseBody = await traccarResp.json();
    } else {
      responseBody = { raw: await traccarResp.text() };
    }

    if (!traccarResp.ok) {
      return new Response(JSON.stringify({
        error: `Traccar API returned ${traccarResp.status}`,
        details: responseBody,
      }), {
        status: traccarResp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      data: responseBody,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('traccar-proxy error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
