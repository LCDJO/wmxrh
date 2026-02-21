import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const META_API = 'https://graph.facebook.com/v21.0';

// ── Helpers ────────────────────────────────────────────

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function metaFetch(path: string, token: string, method = 'GET', body?: object) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }
  const url = path.startsWith('http') ? path : `${META_API}${path}`;
  const separator = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${separator}access_token=${encodeURIComponent(token)}`, opts);
  const data = await res.json();
  if (data.error) {
    throw new Error(`Meta API: ${data.error.message} (code ${data.error.code})`);
  }
  return data;
}

// ── Handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return jsonResponse({ error: 'Invalid token' }, 401);

    // Role check
    const { data: platformUser } = await supabase
      .from('platform_users')
      .select('role')
      .eq('id', user.id)
      .single();

    const allowedRoles = ['platform_super_admin', 'platform_operations', 'platform_marketing_team', 'platform_marketing_director'];
    if (!platformUser || !allowedRoles.includes(platformUser.role)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const body = await req.json();
    const { action } = body;

    // ── ACTION: save_connection ──
    if (action === 'save_connection') {
      const { tenant_id, access_token, ad_account_id, pixel_id, page_id } = body;

      if (!tenant_id || !access_token || !ad_account_id) {
        return jsonResponse({ error: 'tenant_id, access_token e ad_account_id são obrigatórios.' }, 400);
      }

      // Validate token with Meta
      const tokenInfo = await metaFetch('/me', access_token);
      if (!tokenInfo.id) {
        return jsonResponse({ error: 'Access token inválido.' }, 400);
      }

      const { error: upsertErr } = await supabase
        .from('meta_ads_connections')
        .upsert({
          tenant_id,
          access_token,
          ad_account_id: ad_account_id.startsWith('act_') ? ad_account_id : `act_${ad_account_id}`,
          pixel_id: pixel_id || null,
          page_id: page_id || null,
          connected_by: user.id,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id' });

      if (upsertErr) {
        return jsonResponse({ error: `Erro ao salvar conexão: ${upsertErr.message}` }, 500);
      }

      return jsonResponse({ success: true, meta_user: tokenInfo.name || tokenInfo.id });
    }

    // ── ACTION: promote_landing ──
    if (action === 'promote_landing') {
      const { landing_page_id, tenant_id, daily_budget_cents, targeting } = body;

      if (!landing_page_id || !tenant_id) {
        return jsonResponse({ error: 'landing_page_id e tenant_id são obrigatórios.' }, 400);
      }

      // Get Meta connection
      const { data: conn } = await supabase
        .from('meta_ads_connections')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true)
        .single();

      if (!conn) {
        return jsonResponse({ error: 'Meta Ads não conectado. Configure a conexão primeiro.' }, 400);
      }

      // Get landing page
      const { data: page } = await supabase
        .from('landing_pages')
        .select('id, name, slug, deploy_url, status')
        .eq('id', landing_page_id)
        .single();

      if (!page || !page.deploy_url) {
        return jsonResponse({ error: 'Landing page não está online.' }, 400);
      }

      const budget = daily_budget_cents || 1000; // R$10.00 default
      const campaignName = `LP: ${page.name} — Auto`;
      const token = conn.access_token;
      const adAccountId = conn.ad_account_id;

      // Create campaign record in DB first
      const { data: campaignRecord, error: insertErr } = await supabase
        .from('meta_ad_campaigns')
        .insert({
          landing_page_id,
          tenant_id,
          campaign_name: campaignName,
          daily_budget_cents: budget,
          targeting: targeting || {},
          created_by: user.id,
          status: 'creating',
        })
        .select('id')
        .single();

      if (insertErr || !campaignRecord) {
        return jsonResponse({ error: `Erro ao registrar campanha: ${insertErr?.message}` }, 500);
      }

      try {
        // 1. Create Campaign
        const campaign = await metaFetch(`/${adAccountId}/campaigns`, token, 'POST', {
          name: campaignName,
          objective: 'OUTCOME_TRAFFIC',
          status: 'PAUSED',
          special_ad_categories: [],
        });

        // 2. Create AdSet
        const adSet = await metaFetch(`/${adAccountId}/adsets`, token, 'POST', {
          name: `AdSet: ${page.name}`,
          campaign_id: campaign.id,
          daily_budget: budget,
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
          targeting: targeting || {
            geo_locations: { countries: ['BR'] },
            age_min: 18,
            age_max: 65,
          },
          status: 'PAUSED',
        });

        // 3. Create Ad Creative
        const creative = await metaFetch(`/${adAccountId}/adcreatives`, token, 'POST', {
          name: `Creative: ${page.name}`,
          object_story_spec: {
            link_data: {
              link: page.deploy_url,
              message: `Confira: ${page.name}`,
              name: page.name,
              call_to_action: { type: 'LEARN_MORE', value: { link: page.deploy_url } },
            },
            ...(conn.page_id ? { page_id: conn.page_id } : {}),
          },
        });

        // 4. Create Ad
        const ad = await metaFetch(`/${adAccountId}/ads`, token, 'POST', {
          name: `Ad: ${page.name}`,
          adset_id: adSet.id,
          creative: { creative_id: creative.id },
          status: 'PAUSED',
        });

        // Update campaign record with Meta IDs
        await supabase
          .from('meta_ad_campaigns')
          .update({
            meta_campaign_id: campaign.id,
            meta_adset_id: adSet.id,
            meta_ad_id: ad.id,
            status: 'paused',
          })
          .eq('id', campaignRecord.id);

        return jsonResponse({
          success: true,
          campaign_id: campaign.id,
          adset_id: adSet.id,
          ad_id: ad.id,
          status: 'paused',
          message: 'Campanha criada com sucesso (pausada). Ative no Meta Ads Manager.',
        });

      } catch (metaErr: any) {
        // Rollback: mark campaign as error
        await supabase
          .from('meta_ad_campaigns')
          .update({ status: 'error', error_message: metaErr.message })
          .eq('id', campaignRecord.id);

        return jsonResponse({ error: `Falha ao criar campanha: ${metaErr.message}` }, 502);
      }
    }

    // ── ACTION: get_connection ──
    if (action === 'get_connection') {
      const { tenant_id } = body;
      const { data: conn } = await supabase
        .from('meta_ads_connections')
        .select('id, ad_account_id, pixel_id, page_id, is_active, created_at, updated_at')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true)
        .maybeSingle();

      return jsonResponse({ connection: conn });
    }

    // ── ACTION: list_campaigns ──
    if (action === 'list_campaigns') {
      const { landing_page_id } = body;
      const { data: campaigns } = await supabase
        .from('meta_ad_campaigns')
        .select('*')
        .eq('landing_page_id', landing_page_id)
        .order('created_at', { ascending: false })
        .limit(10);

      return jsonResponse({ campaigns: campaigns ?? [] });
    }

    // ── ACTION: get_ad_accounts ──
    if (action === 'get_ad_accounts') {
      const { tenant_id } = body;
      const { data: conn } = await supabase
        .from('meta_ads_connections')
        .select('access_token')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true)
        .single();

      if (!conn) return jsonResponse({ error: 'Meta Ads não conectado.' }, 400);

      const result = await metaFetch('/me/adaccounts?fields=id,name,account_status,currency,timezone_name', conn.access_token);
      return jsonResponse({ ad_accounts: result.data ?? [] });
    }

    // ── ACTION: get_pixels ──
    if (action === 'get_pixels') {
      const { tenant_id } = body;
      const { data: conn } = await supabase
        .from('meta_ads_connections')
        .select('access_token, ad_account_id')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true)
        .single();

      if (!conn) return jsonResponse({ error: 'Meta Ads não conectado.' }, 400);

      const result = await metaFetch(`/${conn.ad_account_id}/adspixels?fields=id,name,is_unavailable`, conn.access_token);
      return jsonResponse({ pixels: result.data ?? [] });
    }

    // ── ACTION: get_campaign_status ──
    if (action === 'get_campaign_status') {
      const { landing_page_id } = body;
      const { data: campaign } = await supabase
        .from('meta_ad_campaigns')
        .select('id, meta_campaign_id, status, error_message, campaign_name, daily_budget_cents, created_at')
        .eq('landing_page_id', landing_page_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return jsonResponse({ campaign: campaign ?? null });
    }

    return jsonResponse({ error: 'Invalid action. Use: save_connection, promote_landing, get_connection, list_campaigns, get_ad_accounts, get_pixels, get_campaign_status' }, 400);

  } catch (err: any) {
    console.error('meta-ads-engine error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
});
