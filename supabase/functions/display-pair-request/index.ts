/**
 * display-pair-request — Called by the TV at /display to request a pairing code.
 * No auth needed. Creates a pending session with a 6-digit pairing code.
 *
 * SECURITY:
 *   ✅ Rate limited: max 5 pending sessions per IP per 10 min
 *   ✅ Pairing code expires in 10 min
 *   ✅ Token is random UUID, not guessable
 *   ✅ No tenant data exposed until paired
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

const MAX_PENDING_PER_WINDOW = 5;

function generatePairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("cf-connecting-ip")
      ?? "unknown";

    // ── Rate limiting: max pending sessions per IP ──
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Expire old pending sessions
    await admin
      .from("live_display_tokens")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("created_at", tenMinAgo)
      .not("pairing_code", "is", null);

    // Count recent pending from same IP
    const { count: recentCount } = await admin
      .from("live_display_tokens")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("paired_ip", clientIp)
      .gte("created_at", tenMinAgo);

    if ((recentCount ?? 0) >= MAX_PENDING_PER_WINDOW) {
      return new Response(
        JSON.stringify({ error: "Too many pairing requests. Try again in a few minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "300" } }
      );
    }

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

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const tokenValue = crypto.randomUUID() + "-" + crypto.randomUUID();

    // Create a pending session — NO tenant data, NO display link
    const { data: session, error } = await admin
      .from("live_display_tokens")
      .insert({
        display_id: null,
        tenant_id: null,
        token_temporario: tokenValue,
        expira_em: expiresAt,
        status: "pending",
        pairing_code: pairingCode,
        paired_ip: clientIp,
        paired_user_agent: req.headers.get("user-agent") ?? "unknown",
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

    // SECURITY: Only return minimal info — no tenant/display data
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
