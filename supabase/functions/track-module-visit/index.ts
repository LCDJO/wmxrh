import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POINTS_PER_VISIT = 5;
const RATE_LIMIT_MINUTES = 60; // 1 point per module per hour max

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // ── 1. Authenticate user from JWT ────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // User client — respects RLS, identifies the caller
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Parse and validate input ──────────────────────────────
    const { module_key, tenant_id } = await req.json();

    if (!module_key || typeof module_key !== 'string') {
      return new Response(JSON.stringify({ error: 'module_key is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!tenant_id || typeof tenant_id !== 'string') {
      return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize module_key — only allow alphanumeric + underscores
    if (!/^[a-z0-9_]+$/.test(module_key)) {
      return new Response(JSON.stringify({ error: 'Invalid module_key format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Service client for privileged operations ──────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── 4. Verify user belongs to tenant ─────────────────────────
    const { data: membership } = await supabase
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'User is not a member of this tenant' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Verify tenant has access to this module ────────────────
    const { data: moduleAccess } = await supabase
      .from('tenant_module_access')
      .select('module_key')
      .eq('tenant_id', tenant_id)
      .eq('module_key', module_key)
      .maybeSingle();

    if (!moduleAccess) {
      // Module not in tenant's plan — silently ignore (no error, just no points)
      return new Response(JSON.stringify({ awarded: false, reason: 'module_not_in_plan' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 6. Rate limiting — 1 visit point per module per hour ─────
    const rateLimitWindow = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString();

    const { data: recentPoints } = await supabase
      .from('gamification_points')
      .select('id')
      .eq('user_id', user.id)
      .eq('action', 'module_visit')
      .eq('source', `visit:${module_key}`)
      .gte('created_at', rateLimitWindow)
      .maybeSingle();

    if (recentPoints) {
      return new Response(JSON.stringify({ awarded: false, reason: 'rate_limited' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 7. Award points ───────────────────────────────────────────

    // Log the point event
    await supabase.from('gamification_points').insert({
      user_id:     user.id,
      tenant_id:   tenant_id,
      action:      'module_visit',
      points:      POINTS_PER_VISIT,
      source:      `visit:${module_key}`,
      description: `Acessou módulo: ${module_key}`,
    });

    // Update user's gamification profile
    await supabase.rpc('upsert_gamification_profile', {
      p_user_id: user.id,
      p_points:  POINTS_PER_VISIT,
    }).then(() => {
      // Fallback if RPC doesn't exist — direct upsert
    });

    // Direct upsert as reliable fallback
    const { data: profile } = await supabase
      .from('gamification_profiles')
      .select('total_points')
      .eq('user_id', user.id)
      .maybeSingle();

    await supabase.from('gamification_profiles').upsert({
      user_id:         user.id,
      total_points:    (profile?.total_points ?? 0) + POINTS_PER_VISIT,
      last_activity_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // Update tenant_user_engagement
    const { data: engagement } = await supabase
      .from('tenant_user_engagement')
      .select('total_points, actions_count')
      .eq('tenant_id', tenant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    await supabase.from('tenant_user_engagement').upsert({
      tenant_id:     tenant_id,
      user_id:       user.id,
      total_points:  (engagement?.total_points ?? 0) + POINTS_PER_VISIT,
      actions_count: (engagement?.actions_count ?? 0) + 1,
      last_action_at: new Date().toISOString(),
      top_module:    module_key,
    }, { onConflict: 'tenant_id,user_id' });

    // Update tenant_usage_scores total points
    const { data: tenantScore } = await supabase
      .from('tenant_usage_scores')
      .select('total_points')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    await supabase.from('tenant_usage_scores').upsert({
      tenant_id:    tenant_id,
      total_points: (tenantScore?.total_points ?? 0) + POINTS_PER_VISIT,
      last_event_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

    return new Response(JSON.stringify({ awarded: true, points: POINTS_PER_VISIT }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('track-module-visit error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
