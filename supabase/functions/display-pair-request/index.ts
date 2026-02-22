/**
 * display-pair-request — Called by the TV at /display to request a pairing code.
 * No auth needed. Creates a pending session with a 6-digit pairing code.
 *
 * POST — body: {} (empty)
 * Returns: { pairing_code, session_id, expires_in_minutes }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generatePairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Expire any old pending sessions with same pairing codes older than 10 min
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await admin
      .from("live_display_tokens")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("created_at", tenMinAgo)
      .not("pairing_code", "is", null);

    // Generate unique pairing code
    let pairingCode = generatePairingCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await admin
        .from("live_display_tokens")
        .select("id")
        .eq("pairing_code", pairingCode)
        .eq("status", "pending")
        .maybeSingle();
      if (!existing) break;
      pairingCode = generatePairingCode();
      attempts++;
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
    const tokenValue = crypto.randomUUID() + "-" + crypto.randomUUID();

    // Create a pending session without display_id (will be set on pairing)
    const { data: session, error } = await admin
      .from("live_display_tokens")
      .insert({
        display_id: null,
        tenant_id: null,
        token_temporario: tokenValue,
        expira_em: expiresAt,
        status: "pending",
        pairing_code: pairingCode,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[display-pair-request] insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create pairing session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        pairing_code: pairingCode,
        session_id: session.id,
        token: tokenValue,
        expires_in_minutes: 10,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[display-pair-request] error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
