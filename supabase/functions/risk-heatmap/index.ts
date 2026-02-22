/**
 * risk-heatmap — Computes occupational risk heatmap data.
 *
 * Aggregates GPS coordinates, behavior events, compliance incidents,
 * and operational blocks into a grid-based risk intensity map.
 *
 * Requires JWT auth + tenant membership.
 *
 * GET ?tenant_id=<id>&lat_min=..&lat_max=..&lng_min=..&lng_max=..&grid_size=20&days_back=30
 * Returns: { cells[], summary, bounds }
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

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return json({ error: 'Authorization required' }, 401);
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return json({ error: 'Invalid authentication' }, 401);
    }

    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id');
    if (!tenantId) {
      return json({ error: 'tenant_id is required' }, 400);
    }

    // Verify membership
    const { data: membership } = await admin
      .from('tenant_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (!membership) {
      return json({ error: 'Unauthorized for this tenant' }, 403);
    }

    // Parse params
    const latMin = parseFloat(url.searchParams.get('lat_min') ?? '-90');
    const latMax = parseFloat(url.searchParams.get('lat_max') ?? '90');
    const lngMin = parseFloat(url.searchParams.get('lng_min') ?? '-180');
    const lngMax = parseFloat(url.searchParams.get('lng_max') ?? '180');
    const gridSize = Math.min(50, Math.max(5, parseInt(url.searchParams.get('grid_size') ?? '20')));
    const daysBack = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days_back') ?? '30')));

    // Call the DB aggregation function
    const { data, error } = await admin.rpc('compute_risk_heatmap', {
      p_tenant_id: tenantId,
      p_lat_min: latMin,
      p_lat_max: latMax,
      p_lng_min: lngMin,
      p_lng_max: lngMax,
      p_grid_size: gridSize,
      p_days_back: daysBack,
    });

    if (error) {
      console.error('[risk-heatmap] rpc error:', error);
      return json({ error: 'Failed to compute heatmap' }, 500);
    }

    // Enrich with top risk clusters (top 5 critical zones)
    const cells = data?.cells ?? [];
    const clusters = cells
      .filter((c: any) => c.risk_level === 'critical' || c.risk_level === 'high')
      .slice(0, 10)
      .map((c: any, i: number) => ({
        id: `cluster-${i}`,
        lat: c.lat,
        lng: c.lng,
        risk_level: c.risk_level,
        risk_intensity: c.risk_intensity,
        incidents: c.incidents,
        behavior_events: c.behavior_events,
        severity_breakdown: c.severity_breakdown,
      }));

    return json({
      ...data,
      clusters,
      tenant_id: tenantId,
    });
  } catch (e) {
    console.error('[risk-heatmap] error:', e);
    return json({ error: 'An unexpected error occurred' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' },
  });
}
