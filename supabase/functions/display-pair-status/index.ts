/**
 * display-pair-status — Polled by TV to check if pairing was confirmed.
 * No auth needed. OPTIMIZED: npm: import, module-level client, minimal logic.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    const token = url.searchParams.get("token");

    if (!sessionId || !token || token.length < 30) {
      return json({ error: "session_id and token are required" }, 400);
    }

    const { data: session, error } = await admin
      .from("live_display_tokens")
      .select("id, status, token_temporario, expira_em")
      .eq("id", sessionId)
      .eq("token_temporario", token)
      .maybeSingle();

    if (error || !session) return json({ status: "expired" }, 404);

    // Auto-expire stale pending sessions
    if (session.status === "pending" && new Date(session.expira_em) < new Date()) {
      // Fire-and-forget expire update
      admin.from("live_display_tokens").update({ status: "expired" }).eq("id", session.id).then(() => {}).catch(() => {});
      return json({ status: "expired" });
    }

    return json(
      {
        status: session.status,
        token: session.status === "active" ? session.token_temporario : undefined,
      },
      200,
      { "Cache-Control": "no-store" }
    );
  } catch (e) {
    console.error("[display-pair-status] error:", e);
    return json({ error: "An unexpected error occurred" }, 500);
  }
});

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}
