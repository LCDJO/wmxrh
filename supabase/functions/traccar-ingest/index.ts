import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
    const webhookSecret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get('TRACCAR_WEBHOOK_SECRET');

    if (expectedSecret && webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    // Support single event or array of events
    const events = Array.isArray(body) ? body : [body];

    if (events.length === 0) {
      return new Response(JSON.stringify({ error: 'No events provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve tenant_id from query param or header
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id') || req.headers.get('x-tenant-id');

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenant_id is required (query param or x-tenant-id header)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Map Traccar payload to our schema
    const rows = events.map((evt: Record<string, unknown>) => ({
      tenant_id: tenantId,
      device_id: String(evt.deviceId ?? evt.device_id ?? ''),
      latitude: Number(evt.latitude ?? evt.lat ?? 0),
      longitude: Number(evt.longitude ?? evt.lng ?? evt.lon ?? 0),
      speed: Number(evt.speed ?? 0),
      ignition: evt.ignition != null ? Boolean(evt.ignition) : null,
      event_timestamp: evt.deviceTime ?? evt.event_timestamp ?? evt.timestamp ?? new Date().toISOString(),
      raw_payload: evt,
    })).filter((r) => r.device_id !== '');

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid events after parsing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase
      .from('raw_tracking_events')
      .insert(rows);

    if (error) {
      console.error('Insert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ingested: rows.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Ingest error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
