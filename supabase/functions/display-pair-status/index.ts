/**
 * display-pair-status — Polled by TV to check if pairing was confirmed.
 * No auth needed.
 *
 * SECURITY:
 *   ✅ Requires both session_id AND token (dual-key)
 *   ✅ No tenant data leaked for pending sessions
 *   ✅ Auto-expires stale sessions
 *   ✅ Read-only — GET only
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

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    const token = url.searchParams.get("token");

    if (!sessionId || !token || token.length < 30) {
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
        JSON.stringify({ status: "expired" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-expire stale pending sessions
    if (session.status === "pending" && new Date(session.expira_em) < new Date()) {
      await admin.from("live_display_tokens").update({ status: "expired" }).eq("id", session.id);
      return new Response(
        JSON.stringify({ status: "expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Only return token when active, never leak tenant/display info
    return new Response(
      JSON.stringify({
        status: session.status,
        token: session.status === "active" ? session.token_temporario : undefined,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e) {
    console.error("[display-pair-status] error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
