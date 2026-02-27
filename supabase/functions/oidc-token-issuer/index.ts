/**
 * UIFE — OIDC Token Issuer (Edge Function)
 *
 * Thin proxy that delegates to federation-jwks for RS256 signed tokens.
 * Kept for backwards compatibility — new integrations should use
 * federation-jwks directly.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? req.headers.get("x-action") ?? "issue";

  // Forward to federation-jwks
  const targetUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/federation-jwks?action=${action}`;

  try {
    const body = req.method === "POST" ? await req.text() : undefined;

    const resp = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "x-action": action,
      },
      body,
    });

    const data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "proxy_error", error_description: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
