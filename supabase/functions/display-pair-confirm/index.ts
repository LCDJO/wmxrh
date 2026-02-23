/**
 * display-pair-confirm — Called by admin to confirm pairing.
 * Requires JWT auth. OPTIMIZED: npm: import, parallel queries, module-level client.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const [{ data: { user }, error: authErr }, body] = await Promise.all([
      userClient.auth.getUser(),
      req.json(),
    ]);

    if (authErr || !user) return json({ error: "Invalid authentication" }, 401);

    const { pairing_code, display_id } = body;
    if (!pairing_code || !display_id) return json({ error: "pairing_code and display_id are required" }, 400);

    // Fetch session + display in parallel
    const [sessionResult, displayResult] = await Promise.all([
      admin.from("live_display_tokens")
        .select("id, token_temporario, expira_em")
        .eq("pairing_code", pairing_code.toUpperCase())
        .eq("status", "pending")
        .maybeSingle(),
      admin.from("live_displays")
        .select("id, tenant_id")
        .eq("id", display_id)
        .is("deleted_at", null)
        .maybeSingle(),
    ]);

    if (sessionResult.error || !sessionResult.data) return json({ error: "Invalid or expired pairing code" }, 404);
    if (displayResult.error || !displayResult.data) return json({ error: "Display not found" }, 404);

    const session = sessionResult.data;
    const display = displayResult.data;

    if (new Date(session.expira_em) < new Date()) {
      admin.from("live_display_tokens").update({ status: "expired" }).eq("id", session.id).then(() => {}).catch(() => {});
      return json({ error: "Pairing code expired" }, 410);
    }

    // Verify membership
    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", display.tenant_id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) return json({ error: "Unauthorized for this tenant" }, 403);

    // Expire old tokens + activate new one + update display — all in parallel
    const newExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await Promise.all([
      admin.from("live_display_tokens")
        .update({ status: "expired" })
        .eq("display_id", display_id)
        .neq("id", session.id),
      admin.from("live_display_tokens")
        .update({
          display_id, tenant_id: display.tenant_id,
          status: "active", expira_em: newExpiry,
          paired_at: new Date().toISOString(), pairing_code: null,
        })
        .eq("id", session.id),
      admin.from("live_displays")
        .update({ status: "active", last_seen_at: new Date().toISOString() })
        .eq("id", display_id),
    ]);

    return json({ success: true, token: session.token_temporario, display_id });
  } catch (e) {
    console.error("[display-pair-confirm] error:", e);
    return json({ error: "An unexpected error occurred" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
