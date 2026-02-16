/**
 * External Data Resolver Edge Function
 *
 * Proxies calls to external government/public APIs:
 *   1. Receita Federal (CNPJ lookup)
 *   2. IBGE CNAE catalog
 *   3. NR updates feed (future)
 *
 * Security: requires authenticated user with tenant_admin role.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── Verify tenant_admin role ──
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = (roles ?? []).some(r =>
      ['superadmin', 'owner', 'admin', 'tenant_admin'].includes(r.role),
    );

    if (!isAdmin) {
      return json({ error: 'Forbidden: requires tenant admin role' }, 403);
    }

    // ── Route by action ──
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'resolve_cnpj':
        return await handleResolveCnpj(body, supabase);
      case 'lookup_cnae':
        return await handleLookupCnae(body);
      case 'check_nr_updates':
        return await handleCheckNrUpdates();
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('[external-data-resolver] Error:', err);
    return json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
    );
  }
});

// ═══════════════════════════════════════════════════════
// 1. RECEITA FEDERAL — CNPJ Resolution
// ═══════════════════════════════════════════════════════

async function handleResolveCnpj(
  body: { cnpj: string; tenant_id?: string; company_id?: string },
  supabase: any,
) {
  const { cnpj, tenant_id, company_id } = body;
  if (!cnpj) return json({ error: 'cnpj is required' }, 400);

  const cleaned = cnpj.replace(/\D/g, '').slice(0, 14);
  if (cleaned.length !== 14) return json({ error: 'Invalid CNPJ' }, 400);

  // Try Receita Federal API key first (future), fallback to BrasilAPI
  const receitaKey = Deno.env.get('RECEITA_FEDERAL_API_KEY');

  let data: any;

  if (receitaKey) {
    // Future: direct Receita Federal integration
    // const res = await fetch(`https://api.receita.../${cleaned}`, {
    //   headers: { Authorization: `Bearer ${receitaKey}` },
    // });
    // data = await res.json();
    console.log('[external-data-resolver] Receita Federal API key configured but not yet implemented, falling back to BrasilAPI');
  }

  // Fallback: BrasilAPI (free, no key)
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleaned}`);
  if (!res.ok) {
    return json(
      { error: `CNPJ lookup failed: ${res.status}` },
      res.status === 404 ? 404 : 502,
    );
  }
  data = await res.json();

  const result = {
    cnpj: cleaned,
    cnae_principal: String(data.cnae_fiscal ?? ''),
    cnaes_secundarios: Array.isArray(data.cnaes_secundarios)
      ? data.cnaes_secundarios.map((c: any) => String(c.codigo ?? '')).filter(Boolean)
      : [],
    descricao_atividade: String(data.cnae_fiscal_descricao ?? ''),
    razao_social: data.razao_social ?? null,
    situacao_cadastral: data.descricao_situacao_cadastral ?? null,
    uf: data.uf ?? null,
    municipio: data.municipio ?? null,
    source: receitaKey ? 'receita_federal' : 'brasilapi',
    resolved_at: new Date().toISOString(),
    raw: data,
  };

  // Persist if tenant_id + company_id provided
  if (tenant_id && company_id) {
    const division = result.cnae_principal.replace(/[.\-\/]/g, '').substring(0, 2);
    const GRAU_MAP: Record<string, number> = {
      '01':3,'02':3,'03':3,'05':4,'06':4,'07':4,'08':4,'09':3,
      '10':3,'11':3,'12':3,'13':3,'14':2,'15':3,'16':3,'17':3,'18':2,'19':3,'20':3,'21':2,
      '22':3,'23':4,'24':4,'25':3,'26':2,'27':3,'28':3,'29':3,'30':3,'31':3,'32':2,'33':3,
      '35':3,'36':3,'37':3,'38':3,'39':3,'41':3,'42':4,'43':3,
      '45':2,'46':2,'47':2,'49':3,'50':3,'51':3,'52':3,'53':2,
      '55':2,'56':2,'58':1,'59':2,'60':1,'61':2,'62':1,'63':1,
      '64':1,'65':1,'66':1,'68':1,'69':1,'70':1,'71':2,'72':1,'73':1,'74':1,'75':1,
      '77':1,'78':2,'79':1,'80':3,'81':2,'82':1,'84':2,'85':1,
      '86':3,'87':3,'88':2,'90':2,'91':1,'92':2,'93':2,'94':1,'95':2,'96':2,'97':1,'99':1,
    };
    const grau = GRAU_MAP[division] ?? 2;

    await supabase.from('company_cnae_profiles').upsert([{
      tenant_id,
      company_id,
      cnpj: cleaned,
      cnae_principal: result.cnae_principal,
      cnaes_secundarios: result.cnaes_secundarios,
      descricao_atividade: result.descricao_atividade,
      grau_risco_sugerido: grau,
      source: result.source,
      raw_response: result.raw,
      resolved_at: result.resolved_at,
    }], { onConflict: 'tenant_id,company_id' });
  }

  return json({ success: true, data: result });
}

// ═══════════════════════════════════════════════════════
// 2. IBGE CNAE Catalog
// ═══════════════════════════════════════════════════════

async function handleLookupCnae(body: { cnae_code?: string; search?: string }) {
  const { cnae_code, search } = body;

  if (cnae_code) {
    // Lookup specific CNAE from IBGE
    const cleaned = cnae_code.replace(/[.\-\/]/g, '');
    const division = cleaned.substring(0, 2);
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v2/cnae/divisoes/${division}`,
    );
    if (!res.ok) {
      return json({ error: `IBGE CNAE lookup failed: ${res.status}` }, 502);
    }
    const data = await res.json();
    return json({ success: true, data, source: 'ibge' });
  }

  if (search) {
    // Search CNAE by description
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v2/cnae/divisoes`,
    );
    if (!res.ok) {
      return json({ error: `IBGE CNAE search failed: ${res.status}` }, 502);
    }
    const allDivisions = await res.json();
    const term = search.toLowerCase();
    const filtered = Array.isArray(allDivisions)
      ? allDivisions.filter((d: any) =>
          d.descricao?.toLowerCase().includes(term) ||
          String(d.id).includes(term),
        )
      : [];
    return json({ success: true, data: filtered, source: 'ibge' });
  }

  return json({ error: 'cnae_code or search required' }, 400);
}

// ═══════════════════════════════════════════════════════
// 3. NR Updates (Preparação Futura)
// ═══════════════════════════════════════════════════════

async function handleCheckNrUpdates() {
  // Future: scrape or call MTE API for NR updates
  // For now, return a stub with metadata about current NR versions
  const NR_VERSIONS: Record<number, { version: string; last_update: string }> = {
    1:  { version: '2024.1', last_update: '2024-01-03' },
    4:  { version: '2022.1', last_update: '2022-01-03' },
    5:  { version: '2022.1', last_update: '2022-01-03' },
    6:  { version: '2022.1', last_update: '2022-01-03' },
    7:  { version: '2022.1', last_update: '2022-01-03' },
    9:  { version: '2024.1', last_update: '2024-01-03' },
    10: { version: '2022.1', last_update: '2022-07-01' },
    11: { version: '2022.1', last_update: '2022-01-03' },
    12: { version: '2023.1', last_update: '2023-06-01' },
    15: { version: '2022.1', last_update: '2022-01-03' },
    16: { version: '2022.1', last_update: '2022-01-03' },
    17: { version: '2022.1', last_update: '2022-01-03' },
    18: { version: '2022.1', last_update: '2022-07-01' },
    20: { version: '2022.1', last_update: '2022-01-03' },
    32: { version: '2022.1', last_update: '2022-01-03' },
    33: { version: '2022.1', last_update: '2022-01-03' },
    35: { version: '2022.1', last_update: '2022-01-03' },
  };

  return json({
    success: true,
    data: {
      nr_versions: NR_VERSIONS,
      last_checked: new Date().toISOString(),
      source: 'static_catalog',
      note: 'Atualização automática via MTE API será implementada quando disponível.',
    },
  });
}

// ─── Helpers ───

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
