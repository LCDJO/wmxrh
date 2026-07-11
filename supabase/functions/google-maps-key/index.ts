/**
 * google-maps-key — Returns the Google Maps API key for a tenant.
 *
 * Requires an authenticated user that either belongs to the tenant
 * (has a row in user_roles for that tenant) or is an active platform user.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { tenantId } = await req.json();
    if (!tenantId) {
      return jsonResponse({ error: "tenantId required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: tenantRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();

    if (!tenantRole) {
      const { data: platformUser } = await supabase
        .from("platform_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (!platformUser) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
    }

    const { data, error } = await supabase
      .from("tenant_integration_configs")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("integration_key", "traccar")
      .maybeSingle();

    if (error) throw error;

    const config = data?.config as Record<string, any> | null;
    const key = config?.google_maps_api_key || Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!key) {
      return jsonResponse({ error: "Google Maps API Key não configurada" }, 404);
    }

    return new Response(JSON.stringify({ key }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "private, max-age=3600" },
    });
  } catch (err) {
    console.error("[google-maps-key]", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
