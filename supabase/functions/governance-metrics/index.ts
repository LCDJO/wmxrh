import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Collect metrics in parallel
    const [banned, pendingInvalidated, versions, appeals] = await Promise.all([
      supabase.from('ban_registry').select('*', { count: 'exact', head: true }).is('unbanned_at', null),
      supabase.from('platform_policy_acceptances').select('*', { count: 'exact', head: true }).eq('is_current', false),
      supabase.from('platform_policy_versions').select('*', { count: 'exact', head: true }),
      supabase.from('account_enforcements').select('*', { count: 'exact', head: true }).eq('status', 'appealed'),
    ]);

    const lines = [
      '# HELP banned_accounts_total Number of currently banned accounts',
      '# TYPE banned_accounts_total gauge',
      `banned_accounts_total{module="governance"} ${banned.count ?? 0}`,
      '',
      '# HELP policy_acceptance_pending_total Number of invalidated (pending) policy acceptances',
      '# TYPE policy_acceptance_pending_total gauge',
      `policy_acceptance_pending_total{module="governance"} ${pendingInvalidated.count ?? 0}`,
      '',
      '# HELP policy_version_updates_total Total policy versions published',
      '# TYPE policy_version_updates_total gauge',
      `policy_version_updates_total{module="governance"} ${versions.count ?? 0}`,
      '',
      '# HELP appeals_open_total Number of open appeals',
      '# TYPE appeals_open_total gauge',
      `appeals_open_total{module="governance"} ${appeals.count ?? 0}`,
    ];

    // Support JSON format via ?format=json
    const url = new URL(req.url);
    if (url.searchParams.get('format') === 'json') {
      return new Response(JSON.stringify({
        banned_accounts_total: banned.count ?? 0,
        policy_acceptance_pending_total: pendingInvalidated.count ?? 0,
        policy_version_updates_total: versions.count ?? 0,
        appeals_open_total: appeals.count ?? 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(lines.join('\n') + '\n', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
