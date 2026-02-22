/**
 * display-pair-confirm — Called by admin to confirm pairing.
 * Requires JWT auth. Links the pending session to a display.
 *
 * POST — body: { pairing_code, display_id }
 * Returns: { success, token }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Verify JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { pairing_code, display_id } = body;

    if (!pairing_code || !display_id) {
      return new Response(
        JSON.stringify({ error: "pairing_code and display_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the pending session by pairing code
    const { data: session, error: sessErr } = await admin
      .from("live_display_tokens")
      .select("id, token_temporario, expira_em")
      .eq("pairing_code", pairing_code.toUpperCase())
      .eq("status", "pending")
      .maybeSingle();

    if (sessErr || !session) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired pairing code" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(session.expira_em) < new Date()) {
      await admin.from("live_display_tokens").update({ status: "expired" }).eq("id", session.id);
      return new Response(
        JSON.stringify({ error: "Pairing code expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get display to extract tenant_id
    const { data: display, error: dispErr } = await admin
      .from("live_displays")
      .select("id, tenant_id")
      .eq("id", display_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (dispErr || !display) {
      return new Response(
        JSON.stringify({ error: "Display not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to this tenant
    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", display.tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Unauthorized for this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Expire previous tokens for this display
    await admin
      .from("live_display_tokens")
      .update({ status: "expired" })
      .eq("display_id", display_id)
      .neq("id", session.id);

    // Update the session: link to display, set active, extend expiration
    const newExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const { error: updateErr } = await admin
      .from("live_display_tokens")
      .update({
        display_id: display_id,
        tenant_id: display.tenant_id,
        status: "active",
        expira_em: newExpiry,
        paired_at: new Date().toISOString(),
        pairing_code: null, // clear code after pairing
      })
      .eq("id", session.id);

    if (updateErr) {
      console.error("[display-pair-confirm] update error:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to confirm pairing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update display status
    await admin
      .from("live_displays")
      .update({ status: "active", last_seen_at: new Date().toISOString() })
      .eq("id", display_id);

    return new Response(
      JSON.stringify({
        success: true,
        token: session.token_temporario,
        display_id: display_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[display-pair-confirm] error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
