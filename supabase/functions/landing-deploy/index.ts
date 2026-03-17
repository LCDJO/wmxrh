import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ── Cloudflare Service ─────────────────────────────────

interface CloudflareDNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
}

class CloudflareService {
  private apiToken: string;
  private zoneId: string;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor(apiToken: string, zoneId: string) {
    this.apiToken = apiToken;
    this.zoneId = zoneId;
  }

  private headers() {
    return {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  /** List existing DNS records matching a name */
  async listDNS(name: string): Promise<CloudflareDNSRecord[]> {
    const res = await fetch(
      `${this.baseUrl}/zones/${this.zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`,
      { headers: this.headers() },
    );
    const data = await res.json();
    if (!data.success) {
      throw new Error(`Cloudflare listDNS failed: ${JSON.stringify(data.errors)}`);
    }
    return data.result ?? [];
  }

  async createDNS(subdomain: string, target: string): Promise<CloudflareDNSRecord> {
    const res = await fetch(`${this.baseUrl}/zones/${this.zoneId}/dns_records`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        type: 'CNAME',
        name: subdomain,
        content: target,
        proxied: true,
        ttl: 1, // auto
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(`Cloudflare createDNS failed: ${JSON.stringify(data.errors)}`);
    }
    return data.result;
  }

  async updateDNS(recordId: string, subdomain: string, target: string): Promise<CloudflareDNSRecord> {
    const res = await fetch(`${this.baseUrl}/zones/${this.zoneId}/dns_records/${recordId}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({
        type: 'CNAME',
        name: subdomain,
        content: target,
        proxied: true,
        ttl: 1,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(`Cloudflare updateDNS failed: ${JSON.stringify(data.errors)}`);
    }
    return data.result;
  }

  async deleteDNS(recordId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/zones/${this.zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(`Cloudflare deleteDNS failed: ${JSON.stringify(data.errors)}`);
    }
  }
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

    const body = await req.json();
    const { action, landing_page_id, tenant_id } = body;

    // Actions that don't require authentication
    const publicActions = ['lookup_domain', 'validate_cloudflare'];

    let user: any = null;
    if (!publicActions.includes(action)) {
      // Auth check
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      user = authUser;

      // Verify platform role
      const { data: platformUser } = await supabase
        .from('platform_users')
        .select('role')
        .eq('id', user.id)
        .single();

      const ALLOWED_PLATFORM_ROLES = ['platform_super_admin', 'platform_operations', 'platform_marketing_team', 'platform_marketing_director'];
      if (!platformUser || !ALLOWED_PLATFORM_ROLES.includes(platformUser.role)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fix #5: Tenant isolation — non-super-admins must be members of the target tenant
      if (tenant_id && !['platform_super_admin', 'platform_operations'].includes(platformUser.role)) {
        const { data: membership } = await supabase
          .from('tenant_memberships')
          .select('id')
          .eq('user_id', user.id)
          .eq('tenant_id', tenant_id)
          .eq('status', 'active')
          .maybeSingle();

        if (!membership) {
          return new Response(JSON.stringify({ error: 'Forbidden: not a member of this tenant' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // ── ACTION: lookup_domain (no token needed — public DNS analysis) ──
    if (action === 'lookup_domain') {
      const { domain } = body;
      if (!domain) {
        return new Response(JSON.stringify({ error: 'domain is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      try {
        // Use DNS-over-HTTPS to detect NS records
        const dnsRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`, {
          headers: { 'Accept': 'application/dns-json' },
        });
        const dnsData = await dnsRes.json();
        const nsRecords = (dnsData.Answer || [])
          .filter((r: any) => r.type === 2)
          .map((r: any) => r.data?.replace(/\.$/, ''));

        const isCloudflare = nsRecords.some((ns: string) => ns?.includes('cloudflare'));

        // Also check A records
        const aRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
          headers: { 'Accept': 'application/dns-json' },
        });
        const aData = await aRes.json();
        const aRecords = (aData.Answer || [])
          .filter((r: any) => r.type === 1)
          .map((r: any) => r.data);

        return new Response(JSON.stringify({
          domain,
          nameservers: nsRecords,
          a_records: aRecords,
          dns_provider: isCloudflare ? 'Cloudflare' : 'Outro',
          is_cloudflare: isCloudflare,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── ACTION: validate_cloudflare (requires token) ──
    if (action === 'validate_cloudflare') {
      const { api_token, domain } = body;
      if (!api_token || !domain) {
        return new Response(JSON.stringify({ error: 'api_token and domain are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      try {
        const verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
          headers: { 'Authorization': `Bearer ${api_token}`, 'Content-Type': 'application/json' },
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          return new Response(JSON.stringify({ error: 'Token inválido', details: verifyData.errors }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const zonesRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}&status=active`, {
          headers: { 'Authorization': `Bearer ${api_token}`, 'Content-Type': 'application/json' },
        });
        const zonesData = await zonesRes.json();
        const zones = (zonesData.result || []).map((z: any) => ({
          id: z.id, name: z.name, status: z.status, name_servers: z.name_servers, plan: z.plan?.name,
        }));
        const matchedZone = zones.find((z: any) => z.name === domain) || zones[0] || null;

        const accountRes = await fetch('https://api.cloudflare.com/client/v4/accounts?page=1&per_page=5', {
          headers: { 'Authorization': `Bearer ${api_token}`, 'Content-Type': 'application/json' },
        });
        const accountData = await accountRes.json();
        const account = accountData.result?.[0] || null;

        return new Response(JSON.stringify({
          valid: true,
          token_status: verifyData.result?.status,
          account: account ? { id: account.id, name: account.name } : null,
          zones,
          matched_zone: matchedZone,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get white label config for this tenant (or global fallback)
    const { data: wlConfig } = await supabase
      .from('white_label_config')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .single();

    // Fallback to env secrets if no white label config
    const apiToken = wlConfig?.cloudflare_api_token || Deno.env.get('CLOUDFLARE_API_TOKEN');
    const zoneId = wlConfig?.cloudflare_zone_id || Deno.env.get('CLOUDFLARE_ZONE_ID');
    const domainPrincipal = wlConfig?.domain_principal || Deno.env.get('CLOUDFLARE_DOMAIN') || 'minha-plataforma.com';

    if (!apiToken || !zoneId) {
      return new Response(JSON.stringify({ error: 'Cloudflare not configured. Set white_label_config or environment secrets.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cf = new CloudflareService(apiToken, zoneId);

    // ── ACTION: deploy ──
    if (action === 'deploy') {
      const { data: page } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('id', landing_page_id)
        .single();

      if (!page) {
        return new Response(JSON.stringify({ error: 'Landing page not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify page belongs to the requested tenant
      if (page.tenant_id && page.tenant_id !== tenant_id) {
        return new Response(JSON.stringify({ error: 'Page does not belong to this tenant' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── SECURITY 1: Validate slug (strict) ──
      const RESERVED_SLUGS = ['www', 'api', 'app', 'admin', 'mail', 'ftp', 'ns1', 'ns2', 'cdn', 'staging', 'dev', 'test', 'builder'];
      if (!page.slug || page.slug.length < 2 || page.slug.length > 63 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(page.slug)) {
        return new Response(JSON.stringify({ error: 'Slug inválido. Use 2-63 caracteres: letras minúsculas, números e hífens (não pode começar/terminar com hífen).' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (RESERVED_SLUGS.includes(page.slug)) {
        return new Response(JSON.stringify({ error: `Slug "${page.slug}" é reservado e não pode ser usado.` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── SECURITY 2: Validate domain ownership ──
      if (tenant_id) {
        const { data: tenantConfig } = await supabase
          .from('white_label_config')
          .select('domain_principal')
          .eq('tenant_id', tenant_id)
          .eq('is_active', true)
          .single();
        if (tenantConfig && tenantConfig.domain_principal !== domainPrincipal) {
          return new Response(JSON.stringify({ error: 'Domínio não pertence a este tenant.' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const subdomain = `${page.slug}.${domainPrincipal}`;
      const builderHost = wlConfig?.builder_host || Deno.env.get('CLOUDFLARE_BUILDER_HOST') || 'builder.minha-plataforma.com';
      const target = builderHost;

      // ── SECURITY 3: Check duplicate DNS in Cloudflare ──
      const existingRecords = await cf.listDNS(subdomain);
      if (existingRecords.length > 0) {
        // Check if it belongs to another landing page in our DB
        const { data: existingPage } = await supabase
          .from('landing_pages')
          .select('id, name')
          .eq('subdomain', subdomain)
          .neq('id', landing_page_id)
          .maybeSingle();

        if (existingPage) {
          return new Response(JSON.stringify({
            error: `Subdomínio "${subdomain}" já está em uso pela landing page "${existingPage.name}".`,
          }), {
            status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // External conflict — record exists but not in our DB
        return new Response(JSON.stringify({
          error: `Registro DNS "${subdomain}" já existe no Cloudflare. Remova-o manualmente ou escolha outro slug.`,
        }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── SECURITY 4: Create DNS with rollback on DB failure ──
      let record: CloudflareDNSRecord;
      try {
        record = await cf.createDNS(page.slug, target);
      } catch (dnsErr) {
        console.error('DNS creation failed:', dnsErr);
        return new Response(JSON.stringify({ error: `Falha ao criar DNS: ${dnsErr.message}` }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update landing_pages — rollback DNS if DB update fails
      const { error: updateError } = await supabase
        .from('landing_pages')
        .update({
          subdomain,
          cloudflare_record_id: record.id,
          deploy_url: `https://${subdomain}`,
          deployed_at: new Date().toISOString(),
          status: 'published',
        })
        .eq('id', landing_page_id);

      if (updateError) {
        // ROLLBACK: remove the DNS record we just created
        console.error('DB update failed, rolling back DNS:', updateError);
        try { await cf.deleteDNS(record.id); } catch (rbErr) {
          console.error('CRITICAL: DNS rollback also failed:', rbErr);
        }
        return new Response(JSON.stringify({ error: `Falha ao atualizar banco de dados. DNS revertido. ${updateError.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create deployment log (non-critical, don't rollback on failure)
      await supabase
        .from('landing_deployments')
        .insert({
          landing_page_id,
          subdomain,
          full_url: `https://${subdomain}`,
          cloudflare_record_id: record.id,
          status: 'deployed',
          deployed_by: user.id,
        });

      return new Response(JSON.stringify({
        success: true,
        subdomain,
        url: `https://${subdomain}`,
        cloudflare_record_id: record.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: undeploy ──
    if (action === 'undeploy') {
      const { data: page } = await supabase
        .from('landing_pages')
        .select('cloudflare_record_id, subdomain')
        .eq('id', landing_page_id)
        .single();

      if (page?.cloudflare_record_id) {
        await cf.deleteDNS(page.cloudflare_record_id);
      }

      await supabase
        .from('landing_pages')
        .update({
          cloudflare_record_id: null,
          deploy_url: null,
          deployed_at: null,
          status: 'draft',
        })
        .eq('id', landing_page_id);

      // Update deployment log
      await supabase
        .from('landing_deployments')
        .update({ status: 'removed', removed_at: new Date().toISOString() })
        .eq('landing_page_id', landing_page_id)
        .eq('status', 'deployed');

      return new Response(JSON.stringify({ success: true, message: 'DNS removed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: update ──
    if (action === 'update') {
      const { new_slug } = body;
      const { data: page } = await supabase
        .from('landing_pages')
        .select('cloudflare_record_id, subdomain')
        .eq('id', landing_page_id)
        .single();

      if (!page?.cloudflare_record_id) {
        return new Response(JSON.stringify({ error: 'Page not deployed yet' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newSubdomain = `${new_slug}.${domainPrincipal}`;
      await cf.updateDNS(page.cloudflare_record_id, new_slug, domainPrincipal);

      await supabase
        .from('landing_pages')
        .update({
          subdomain: newSubdomain,
          deploy_url: `https://${newSubdomain}`,
          slug: new_slug,
        })
        .eq('id', landing_page_id);

      return new Response(JSON.stringify({
        success: true,
        subdomain: newSubdomain,
        url: `https://${newSubdomain}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: deploy, undeploy, update' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('landing-deploy error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
