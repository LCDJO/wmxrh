/**
 * account-enforcement — Edge function for server-side enforcement actions.
 *
 * Actions: enforce, revoke, appeal, review_appeal, check, list_bans
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify caller is platform admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Invalid token" }, 401);

    const { data: callerPlatform } = await adminClient
      .from("platform_users")
      .select("role_id, platform_roles(slug)")
      .eq("user_id", caller.id)
      .eq("status", "active")
      .single();

    const callerSlug = (callerPlatform as any)?.platform_roles?.slug;
    const isAdmin = ["platform_super_admin", "platform_admin", "platform_security_admin"].includes(callerSlug);

    const body = await req.json();
    const { action } = body;

    // ── ENFORCE ──
    if (action === "enforce" && isAdmin) {
      const { tenant_id, action_type, reason, reason_category, severity, expires_at, ban_type, scope_detail, is_permanent, related_incident_id, notes } = body;

      if (!tenant_id || !action_type || !reason) {
        return json({ error: "tenant_id, action_type, reason required" }, 400);
      }

      const { data: enforcement, error } = await adminClient
        .from("account_enforcements")
        .insert({
          tenant_id,
          action_type,
          reason,
          reason_category: reason_category || "policy_violation",
          severity: severity || "medium",
          status: "active",
          enforced_by: caller.id,
          expires_at: expires_at || null,
          related_incident_id: related_incident_id || null,
          notes: notes || null,
          metadata: {},
        })
        .select()
        .single();

      if (error) return json({ error: error.message }, 400);

      // Ban registry
      if (action_type === "ban") {
        await adminClient.from("ban_registry").insert({
          tenant_id,
          enforcement_id: enforcement.id,
          ban_type: ban_type || "full",
          scope_detail: scope_detail || null,
          is_permanent: is_permanent || false,
          banned_by: caller.id,
        });
      }

      // Audit log
      await adminClient.from("enforcement_audit_log").insert({
        enforcement_id: enforcement.id,
        event_type: `account_${action_type}`,
        actor_id: caller.id,
        tenant_id,
        details: { reason, severity },
      });

      // Suspend billing if ban/suspend
      if (["ban", "suspend"].includes(action_type)) {
        await adminClient
          .from("tenant_plans")
          .update({ status: "suspended", updated_at: new Date().toISOString() })
          .eq("tenant_id", tenant_id)
          .in("status", ["active", "trial"]);
      }

      return json({ success: true, enforcement });
    }

    // ── REVOKE ──
    if (action === "revoke" && isAdmin) {
      const { enforcement_id, reason: revokeReason } = body;
      if (!enforcement_id) return json({ error: "enforcement_id required" }, 400);

      await adminClient
        .from("account_enforcements")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", enforcement_id);

      await adminClient
        .from("ban_registry")
        .update({ unbanned_at: new Date().toISOString(), unbanned_by: caller.id, unban_reason: revokeReason })
        .eq("enforcement_id", enforcement_id)
        .is("unbanned_at", null);

      await adminClient.from("enforcement_audit_log").insert({
        enforcement_id,
        event_type: "enforcement_revoked",
        actor_id: caller.id,
        details: { reason: revokeReason },
      });

      return json({ success: true });
    }

    // ── CHECK ──
    if (action === "check") {
      const { tenant_id } = body;
      if (!tenant_id) return json({ error: "tenant_id required" }, 400);

      const { data } = await adminClient
        .from("account_enforcements")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("status", "active")
        .in("action_type", ["ban", "suspend"]);

      const now = new Date().toISOString();
      const active = (data ?? []).filter((e: any) => !e.expires_at || e.expires_at > now);

      return json({ restricted: active.length > 0, enforcements: active });
    }

    if (!isAdmin) return json({ error: "Forbidden" }, 403);
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
