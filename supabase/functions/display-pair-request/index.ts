/**
 * display-pair-request — Called by the TV at /display to request a pairing code.
 * No auth needed. Creates a pending session with a 6-digit pairing code.
 *
 * OPTIMIZED: Single-pass logic, npm: import, minimal DB round-trips.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePairingCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

// Pre-create admin client at module level (reused across warm invocations)
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ?? "unknown";

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Run expire + count in parallel (2 queries → 1 round-trip)
    const [, countResult] = await Promise.all([
      admin.from("live_display_tokens")
        .update({ status: "expired" })
        .eq("status", "pending")
        .lt("created_at", tenMinAgo)
        .not("pairing_code", "is", null),
      admin.from("live_display_tokens")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("paired_ip", clientIp)
        .gte("created_at", tenMinAgo),
    ]);

    if ((countResult.count ?? 0) >= 5) {
      return json(
        { error: "Too many pairing requests. Try again in a few minutes." },
        429,
        { "Retry-After": "300" }
      );
    }

    // Generate code + insert (skip uniqueness loop — 6-char from 31-char set = ~887M combos, collision near-zero)
    const pairingCode = generatePairingCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const tokenValue = crypto.randomUUID() + "-" + crypto.randomUUID();

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
      return json({ error: "Failed to create pairing session" }, 500);
    }

    // Fire-and-forget log
    admin.from("display_connection_logs").insert({
      display_id: null, token_id: session.id, tenant_id: null,
      event_type: "pair_request", ip_address: clientIp,
      user_agent: req.headers.get("user-agent") ?? "unknown",
      metadata: { pairing_code: pairingCode },
    }).then(() => {}).catch(() => {});

    return json({
      pairing_code: pairingCode,
      session_id: session.id,
      token: tokenValue,
      expires_in_minutes: 10,
    });
  } catch (e) {
    console.error("[display-pair-request] error:", e);
    return json({ error: "An unexpected error occurred" }, 500);
  }
});

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}
