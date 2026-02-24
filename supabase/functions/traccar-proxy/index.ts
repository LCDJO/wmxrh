/**
 * traccar-proxy — Authenticated proxy to Traccar REST API.
 * Uses TRACCAR_BASE_URL and TRACCAR_API_TOKEN secrets.
 *
 * Endpoints (via ?action= query param):
 *   test-connection  — GET /api/server (verify connectivity)
 *   devices          — GET /api/devices
 *   positions        — GET /api/positions
 *   device-detail    — GET /api/devices?id=<deviceId>
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Traccar credentials ──
    const TRACCAR_BASE_URL = Deno.env.get('TRACCAR_BASE_URL');
    if (!TRACCAR_BASE_URL) {
      return new Response(JSON.stringify({ error: 'TRACCAR_BASE_URL not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const TRACCAR_API_TOKEN = Deno.env.get('TRACCAR_API_TOKEN');
    if (!TRACCAR_API_TOKEN) {
      return new Response(JSON.stringify({ error: 'TRACCAR_API_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = TRACCAR_BASE_URL.replace(/\/+$/, '');
    const traccarHeaders: Record<string, string> = {
      'Authorization': `Bearer ${TRACCAR_API_TOKEN}`,
      'Accept': 'application/json',
    };

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'test-connection';

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
      case 'device-detail': {
        const deviceId = url.searchParams.get('deviceId');
        traccarPath = deviceId ? `/api/devices?id=${deviceId}` : '/api/devices';
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
