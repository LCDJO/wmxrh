import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const BRASILAPI_BASE = 'https://brasilapi.com.br/api';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { action, tenant_id, cnpj, cep, cnae_code } = await req.json();

    // ── Auth ──
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return json({ error: 'Não autorizado' }, 401);

    // ── Test connection ──
    if (action === 'test_connection') {
      try {
        const res = await fetch(`${BRASILAPI_BASE}/cep/v1/01001000`);
        if (res.ok) return json({ data: { success: true, message: 'BrasilAPI acessível.' } });
        return json({ data: { success: false, message: `Status ${res.status}` } });
      } catch (e) {
        return json({ data: { success: false, message: (e as Error).message } });
      }
    }

    // ── CNPJ lookup ──
    if (action === 'lookup_cnpj') {
      if (!cnpj) return json({ error: 'CNPJ obrigatório' }, 400);
      const cleaned = cnpj.replace(/\D/g, '');
      if (cleaned.length !== 14) return json({ error: 'CNPJ inválido' }, 400);

      const res = await fetch(`${BRASILAPI_BASE}/cnpj/v1/${cleaned}`);
      if (!res.ok) return json({ error: `Falha na consulta: ${res.status}` }, res.status === 404 ? 404 : 502);
      const data = await res.json();

      return json({
        data: {
          cnpj: cleaned,
          razao_social: data.razao_social ?? null,
          nome_fantasia: data.nome_fantasia ?? null,
          cnae_fiscal: data.cnae_fiscal ?? null,
          situacao_cadastral: data.descricao_situacao_cadastral ?? null,
          uf: data.uf ?? null,
          municipio: data.municipio ?? null,
          source: 'brasilapi',
          resolved_at: new Date().toISOString(),
        },
      });
    }

    // ── CEP lookup ──
    if (action === 'lookup_cep') {
      if (!cep) return json({ error: 'CEP obrigatório' }, 400);
      const cleaned = cep.replace(/\D/g, '');
      if (cleaned.length !== 8) return json({ error: 'CEP inválido' }, 400);

      const res = await fetch(`${BRASILAPI_BASE}/cep/v1/${cleaned}`);
      if (!res.ok) return json({ error: `CEP não encontrado: ${res.status}` }, res.status === 404 ? 404 : 502);
      const data = await res.json();

      return json({ data });
    }

    // ── CNAE lookup ──
    if (action === 'lookup_cnae') {
      if (!cnae_code) return json({ error: 'Código CNAE obrigatório' }, 400);
      const cleaned = cnae_code.replace(/\D/g, '');

      const res = await fetch(`${BRASILAPI_BASE}/cnae/v1/${cleaned}`);
      if (!res.ok) return json({ error: `CNAE não encontrado: ${res.status}` }, res.status === 404 ? 404 : 502);
      const data = await res.json();

      return json({ data });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || 'Erro interno' }, 500);
  }
});
