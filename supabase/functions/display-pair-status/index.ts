/**
 * display-pair-status — Polled by TV to check if pairing was confirmed.
 * No auth needed.
 *
 * GET ?session_id=<id>&token=<token>
 * Returns: { status: "pending"|"active"|"expired", token?: string }
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
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    const token = url.searchParams.get("token");

    if (!sessionId || !token) {
      return new Response(
        JSON.stringify({ error: "session_id and token are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: session, error } = await admin
      .from("live_display_tokens")
      .select("id, status, token_temporario, expira_em")
      .eq("id", sessionId)
      .eq("token_temporario", token)
      .maybeSingle();

    if (error || !session) {
      return new Response(
        JSON.stringify({ status: "expired", error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check time expiration for pending sessions
    if (session.status === "pending" && new Date(session.expira_em) < new Date()) {
      await admin.from("live_display_tokens").update({ status: "expired" }).eq("id", session.id);
      return new Response(
        JSON.stringify({ status: "expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: session.status,
        token: session.status === "active" ? session.token_temporario : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[display-pair-status] error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
