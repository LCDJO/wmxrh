/**
 * External Data Resolver Edge Function
 *
 * Proxies calls to external government/public APIs:
 *   1. Receita Federal / BrasilAPI (CNPJ lookup)
 *   2. SERPRO / CPFHub Consulta CPF (tenant-configured)
 *   3. IBGE CNAE catalog
 *   4. NR updates feed (future)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_ROLES = ['superadmin', 'owner', 'admin', 'tenant_admin'];
const EMPLOYEE_MANAGER_ROLES = [
  ...ADMIN_ROLES,
  'group_admin',
  'company_admin',
  'rh',
];

type CpfProvider = 'serpro' | 'cpfhub';

const CPF_PROVIDER_DEFAULTS = {
  serpro: {
    provider: 'serpro' as const,
    is_active: false,
    has_consumer_key: false,
    has_consumer_secret: false,
    has_api_key: false,
    api_base_url: 'https://gateway.apiserpro.serpro.gov.br',
    endpoint_path_template: '/consulta-cpf-df-trial/v1/cpf/{cpf}',
    docs_url: 'https://apicenter.estaleiro.serpro.gov.br/documentacao/consulta-cpf/',
  },
  cpfhub: {
    provider: 'cpfhub' as const,
    is_active: false,
    has_consumer_key: false,
    has_consumer_secret: false,
    has_api_key: false,
    api_base_url: 'https://api.cpfhub.io',
    endpoint_path_template: '/cpf/{cpf}',
    docs_url: 'https://cpfhub.io/documentacao/api-reference/cpf',
  },
} as const;

const PROVIDER_MODULE_MAP: Record<CpfProvider, string> = {
  serpro: 'cpf_lookup_serpro',
  cpfhub: 'cpf_lookup_cpfhub',
};

type SupabaseClient = ReturnType<typeof createClient>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser();

    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json();
    const { action } = body;

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roleList = (roles ?? []).map((row) => String(row.role));
    const isAllowed = hasAnyRole(
      roleList,
      action === 'resolve_cpf' ? EMPLOYEE_MANAGER_ROLES : ADMIN_ROLES,
    );

    if (!isAllowed) {
      return json({ error: 'Forbidden' }, 403);
    }

    switch (action) {
      case 'resolve_cnpj':
        return await handleResolveCnpj(body, supabase);
      case 'resolve_cpf':
        return await handleResolveCpf(body, supabase);
      case 'get_cpf_config':
        return await handleGetCpfConfig(body, supabase);
      case 'save_cpf_config':
        return await handleSaveCpfConfig(body, supabase, user.id);
      case 'lookup_cnae':
        return await handleLookupCnae(body);
      case 'check_nr_updates':
        return await handleCheckNrUpdates();
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('[external-data-resolver] Error:', err);
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});

async function handleResolveCnpj(
  body: { cnpj: string; tenant_id?: string; company_id?: string },
  supabase: SupabaseClient,
) {
  const { cnpj, tenant_id, company_id } = body;
  if (!cnpj) return json({ error: 'cnpj is required' }, 400);

  const cleaned = cnpj.replace(/\D/g, '').slice(0, 14);
  if (cleaned.length !== 14) return json({ error: 'Invalid CNPJ' }, 400);

  const receitaKey = Deno.env.get('RECEITA_FEDERAL_API_KEY');
  let data: any;

  if (receitaKey) {
    console.log('[external-data-resolver] Receita Federal API key configured but not yet implemented, falling back to BrasilAPI');
  }

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleaned}`);
  if (!res.ok) {
    return json({ error: `CNPJ lookup failed: ${res.status}` }, res.status === 404 ? 404 : 502);
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

  if (tenant_id && company_id) {
    const division = result.cnae_principal.replace(/[.\-\/]/g, '').substring(0, 2);
    const GRAU_MAP: Record<string, number> = {
      '01': 3, '02': 3, '03': 3, '05': 4, '06': 4, '07': 4, '08': 4, '09': 3,
      '10': 3, '11': 3, '12': 3, '13': 3, '14': 2, '15': 3, '16': 3, '17': 3, '18': 2, '19': 3, '20': 3, '21': 2,
      '22': 3, '23': 4, '24': 4, '25': 3, '26': 2, '27': 3, '28': 3, '29': 3, '30': 3, '31': 3, '32': 2, '33': 3,
      '35': 3, '36': 3, '37': 3, '38': 3, '39': 3, '41': 3, '42': 4, '43': 3,
      '45': 2, '46': 2, '47': 2, '49': 3, '50': 3, '51': 3, '52': 3, '53': 2,
      '55': 2, '56': 2, '58': 1, '59': 2, '60': 1, '61': 2, '62': 1, '63': 1,
      '64': 1, '65': 1, '66': 1, '68': 1, '69': 1, '70': 1, '71': 2, '72': 1, '73': 1, '74': 1, '75': 1,
      '77': 1, '78': 2, '79': 1, '80': 3, '81': 2, '82': 1, '84': 2, '85': 1,
      '86': 3, '87': 3, '88': 2, '90': 2, '91': 1, '92': 2, '93': 2, '94': 1, '95': 2, '96': 2, '97': 1, '99': 1,
    };
    const grau = GRAU_MAP[division] ?? 2;

    await supabase.from('company_cnae_profiles').upsert([
      {
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
      },
    ], { onConflict: 'tenant_id,company_id' });
  }

  return json({ success: true, data: result });
}

async function handleGetCpfConfig(
  body: { tenant_id?: string },
  supabase: SupabaseClient,
) {
  const tenantId = body.tenant_id;
  if (!tenantId) return json({ error: 'tenant_id is required' }, 400);

  const config = await readCpfConfig(tenantId, supabase);
  return json({ success: true, data: config });
}

async function handleSaveCpfConfig(
  body: {
    tenant_id?: string;
    provider?: CpfProvider;
    consumer_key?: string;
    consumer_secret?: string;
    api_key?: string;
    api_base_url?: string;
    endpoint_path_template?: string;
    is_active?: boolean;
  },
  supabase: SupabaseClient,
  userId: string,
) {
  const tenantId = body.tenant_id;
  if (!tenantId) return json({ error: 'tenant_id is required' }, 400);

  const existingRow = await getCpfConfigRow(tenantId, supabase);
  const existing = normalizeCpfConfig(existingRow?.config ?? null);
  const provider = normalizeProvider(body.provider ?? existing.provider);
  const providerDefaults = CPF_PROVIDER_DEFAULTS[provider];
  const allowedProviders = await getTenantAllowedCpfProviders(tenantId, supabase);

  if (!allowedProviders.includes(provider)) {
    return json({ error: `O provider ${provider.toUpperCase()} não está liberado no plano deste tenant.` }, 403);
  }

  const consumerKey = body.consumer_key?.trim() || existing.consumer_key || '';
  const consumerSecret = body.consumer_secret?.trim() || existing.consumer_secret || '';
  const apiKey = body.api_key?.trim() || existing.api_key || '';
  const apiBaseUrl = sanitizeUrl(
    body.api_base_url || existing.api_base_url || providerDefaults.api_base_url,
    provider,
  );
  const endpointPathTemplate = sanitizePathTemplate(
    body.endpoint_path_template || existing.endpoint_path_template || providerDefaults.endpoint_path_template,
    provider,
  );
  const isActive = Boolean(body.is_active);

  if (isActive && provider === 'serpro' && (!consumerKey || !consumerSecret)) {
    return json({ error: 'Consumer Key e Consumer Secret são obrigatórios para ativar a integração SERPRO.' }, 400);
  }

  if (isActive && provider === 'cpfhub' && !apiKey) {
    return json({ error: 'API Key é obrigatória para ativar a integração CPFHub.' }, 400);
  }

  const configToSave = {
    provider,
    is_active: isActive,
    consumer_key: provider === 'serpro' ? consumerKey : '',
    consumer_secret: provider === 'serpro' ? consumerSecret : '',
    api_key: provider === 'cpfhub' ? apiKey : '',
    api_base_url: apiBaseUrl,
    endpoint_path_template: endpointPathTemplate,
    docs_url: providerDefaults.docs_url,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  if (existingRow?.id) {
    const { error } = await supabase
      .from('tenant_integration_configs')
      .update({ config: configToSave, updated_at: new Date().toISOString() })
      .eq('id', existingRow.id);

    if (error) throw new Error(`Failed to update CPF config: ${error.message}`);
  } else {
    const { error } = await supabase
      .from('tenant_integration_configs')
      .insert({ tenant_id: tenantId, integration_key: 'cpf_consulta', config: configToSave });

    if (error) throw new Error(`Failed to insert CPF config: ${error.message}`);
  }

  return json({
    success: true,
    data: buildPublicCpfConfig(configToSave),
  });
}

async function handleResolveCpf(
  body: { cpf?: string; tenant_id?: string },
  supabase: SupabaseClient,
) {
  const cpf = body.cpf?.replace(/\D/g, '').slice(0, 11) ?? '';
  const tenantId = body.tenant_id;

  if (!tenantId) return json({ error: 'tenant_id is required' }, 400);
  if (cpf.length !== 11) return json({ error: 'Invalid CPF' }, 400);

  const configRow = await getCpfConfigRow(tenantId, supabase);
  const config = normalizeCpfConfig(configRow?.config ?? null);
  const allowedProviders = await getTenantAllowedCpfProviders(tenantId, supabase);

  if (!config.is_active) {
    return json({
      error: 'Integração de CPF desativada para este tenant.',
      errorCode: 'CPF_INTEGRATION_DISABLED',
    }, 200);
  }

  if (!allowedProviders.includes(config.provider)) {
    return json({ error: `O provider ${config.provider.toUpperCase()} não está liberado no plano deste tenant.` }, 403);
  }

  if (config.provider === 'serpro') {
    if (!config.consumer_key || !config.consumer_secret) {
      return json({ error: 'Credenciais SERPRO não configuradas.' }, 400);
    }

    const token = await fetchSerproAccessToken(config.consumer_key, config.consumer_secret);
    const endpointPath = sanitizePathTemplate(config.endpoint_path_template, 'serpro').replace('{cpf}', cpf);
    const requestUrl = `${sanitizeUrl(config.api_base_url, 'serpro')}${endpointPath}`;

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error('[external-data-resolver] CPF lookup failed', response.status, responseText);
      return json({ error: `CPF lookup failed: ${response.status}` }, response.status === 404 ? 404 : 502);
    }

    const payload = await response.json();
    const result = {
      cpf,
      nome: payload?.nome ?? null,
      data_nascimento: formatSerproBirthDate(payload?.nascimento),
      situacao_cadastral: payload?.situacao?.descricao ?? null,
      source: 'serpro' as const,
      resolved_at: new Date().toISOString(),
    };

    return json({ success: true, data: result });
  }

  if (!config.api_key) {
    return json({ error: 'API Key do CPFHub não configurada.' }, 400);
  }

  const endpointPath = sanitizePathTemplate(config.endpoint_path_template, 'cpfhub').replace('{cpf}', cpf);
  const requestUrl = `${sanitizeUrl(config.api_base_url, 'cpfhub')}${endpointPath}`;

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-api-key': config.api_key,
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.error('[external-data-resolver] CPFHub lookup failed', response.status, responseText);
    return json({ error: `CPF lookup failed: ${response.status}` }, response.status === 404 ? 404 : 502);
  }

  const payload = await response.json();
  const data = payload?.data ?? payload;

  if (payload?.success === false) {
    return json({ error: 'CPFHub não retornou dados válidos para o CPF informado.' }, 502);
  }

  const result = {
    cpf,
    nome: data?.name ?? data?.nome ?? null,
    data_nascimento: formatCpfHubBirthDate(data?.birthDate ?? data?.dataNascimento ?? data?.nascimento),
    situacao_cadastral: null,
    source: 'cpfhub' as const,
    resolved_at: new Date().toISOString(),
  };

  return json({ success: true, data: result });
}

async function fetchSerproAccessToken(consumerKey: string, consumerSecret: string) {
  const basicAuth = btoa(`${consumerKey}:${consumerSecret}`);
  const response = await fetch('https://gateway.apiserpro.serpro.gov.br/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`SERPRO token request failed [${response.status}]: ${responseText}`);
  }

  const payload = await response.json();
  if (!payload?.access_token) {
    throw new Error('SERPRO token response missing access_token');
  }

  return String(payload.access_token);
}

async function handleLookupCnae(body: { cnae_code?: string; search?: string }) {
  const { cnae_code, search } = body;

  if (cnae_code) {
    const cleaned = cnae_code.replace(/[.\-\/]/g, '');
    const division = cleaned.substring(0, 2);
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v2/cnae/divisoes/${division}`);
    if (!res.ok) {
      return json({ error: `IBGE CNAE lookup failed: ${res.status}` }, 502);
    }
    const data = await res.json();
    return json({ success: true, data, source: 'ibge' });
  }

  if (search) {
    const res = await fetch('https://servicodados.ibge.gov.br/api/v2/cnae/divisoes');
    if (!res.ok) {
      return json({ error: `IBGE CNAE search failed: ${res.status}` }, 502);
    }
    const allDivisions = await res.json();
    const term = search.toLowerCase();
    const filtered = Array.isArray(allDivisions)
      ? allDivisions.filter((d: any) => d.descricao?.toLowerCase().includes(term) || String(d.id).includes(term))
      : [];
    return json({ success: true, data: filtered, source: 'ibge' });
  }

  return json({ error: 'cnae_code or search required' }, 400);
}

async function handleCheckNrUpdates() {
  const NR_VERSIONS: Record<number, { version: string; last_update: string }> = {
    1: { version: '2024.1', last_update: '2024-01-03' },
    4: { version: '2022.1', last_update: '2022-01-03' },
    5: { version: '2022.1', last_update: '2022-01-03' },
    6: { version: '2022.1', last_update: '2022-01-03' },
    7: { version: '2022.1', last_update: '2022-01-03' },
    9: { version: '2024.1', last_update: '2024-01-03' },
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

async function getCpfConfigRow(tenantId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('tenant_integration_configs')
    .select('id, config')
    .eq('tenant_id', tenantId)
    .eq('integration_key', 'cpf_consulta')
    .maybeSingle();

  if (error) throw new Error(`Failed to read CPF config: ${error.message}`);
  return data;
}

async function readCpfConfig(tenantId: string, supabase: SupabaseClient) {
  const row = await getCpfConfigRow(tenantId, supabase);
  const normalized = normalizeCpfConfig(row?.config ?? null);
  return buildPublicCpfConfig(normalized);
}

async function getTenantAllowedCpfProviders(tenantId: string, supabase: SupabaseClient): Promise<CpfProvider[]> {
  const { data: tenantPlan, error: tenantPlanError } = await supabase
    .from('tenant_plans')
    .select('plan_id, created_at')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tenantPlanError) {
    throw new Error(`Failed to read tenant plan: ${tenantPlanError.message}`);
  }

  if (!tenantPlan?.plan_id) return [];

  const { data: planRow, error: planError } = await supabase
    .from('saas_plans')
    .select('allowed_modules')
    .eq('id', tenantPlan.plan_id)
    .maybeSingle();

  if (planError) {
    throw new Error(`Failed to read tenant plan modules: ${planError.message}`);
  }

  const allowedModules = Array.isArray(planRow?.allowed_modules)
    ? planRow.allowed_modules.map((value) => String(value))
    : [];

  return (Object.keys(PROVIDER_MODULE_MAP) as CpfProvider[]).filter((provider) =>
    allowedModules.includes(PROVIDER_MODULE_MAP[provider]),
  );
}

function normalizeCpfConfig(config: unknown) {
  const value = typeof config === 'object' && config !== null ? config as Record<string, unknown> : {};
  const provider = normalizeProvider(value.provider);
  const defaults = CPF_PROVIDER_DEFAULTS[provider];

  return {
    provider,
    is_active: Boolean(value.is_active),
    consumer_key: String(value.consumer_key ?? ''),
    consumer_secret: String(value.consumer_secret ?? ''),
    api_key: String(value.api_key ?? ''),
    api_base_url: sanitizeUrl(String(value.api_base_url ?? defaults.api_base_url), provider),
    endpoint_path_template: sanitizePathTemplate(String(value.endpoint_path_template ?? defaults.endpoint_path_template), provider),
    docs_url: defaults.docs_url,
  };
}

function buildPublicCpfConfig(config: ReturnType<typeof normalizeCpfConfig>) {
  return {
    provider: config.provider,
    is_active: config.is_active,
    has_consumer_key: Boolean(config.consumer_key),
    has_consumer_secret: Boolean(config.consumer_secret),
    has_api_key: Boolean(config.api_key),
    api_base_url: config.api_base_url,
    endpoint_path_template: config.endpoint_path_template,
    docs_url: config.docs_url,
  };
}

function normalizeProvider(value: unknown): CpfProvider {
  return value === 'cpfhub' ? 'cpfhub' : 'serpro';
}

function sanitizeUrl(value: string, provider: CpfProvider) {
  return value.trim().replace(/\/$/, '') || CPF_PROVIDER_DEFAULTS[provider].api_base_url;
}

function sanitizePathTemplate(value: string, provider: CpfProvider) {
  const sanitized = value.trim();
  if (!sanitized) return CPF_PROVIDER_DEFAULTS[provider].endpoint_path_template;
  return sanitized.startsWith('/') ? sanitized : `/${sanitized}`;
}

function formatSerproBirthDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!/^\d{8}$/.test(raw)) return null;
  const day = raw.slice(0, 2);
  const month = raw.slice(2, 4);
  const year = raw.slice(4, 8);
  return `${year}-${month}-${day}`;
}

function formatCpfHubBirthDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  return null;
}

function hasAnyRole(currentRoles: string[], allowedRoles: string[]) {
  return currentRoles.some((role) => allowedRoles.includes(role));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}