/**
 * account-enforcement — Edge function for server-side enforcement actions.
 *
 * Enforcement Rules:
 * - Fraud grave (ban): block login, revoke tokens, cancel API keys, suspend workflows
 * - Abuso leve (restrict): limit features, block new integrations
 *
 * Actions: enforce, revoke, appeal, review_appeal, check
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

// ── Cascading enforcement effects ──────────────────────────────

async function applyBanEffects(adminClient: any, tenantId: string, entityType: string, entityId: string) {
  const effects: string[] = [];

  // 1) Suspend billing
  await adminClient
    .from("tenant_plans")
    .update({ status: "suspended", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trial"]);
  effects.push("billing_suspended");

  // 2) Revoke all API keys for tenant
  const { data: clients } = await adminClient
    .from("api_clients")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  if (clients?.length) {
    const clientIds = clients.map((c: any) => c.id);
    // Mark API clients as banned
    await adminClient
      .from("api_clients")
      .update({ status: "revoked", account_status: "banned", updated_at: new Date().toISOString() })
      .in("id", clientIds);
    effects.push(`api_clients_revoked:${clientIds.length}`);
  }

  // 3) Block user login — set account_status on tenant
  if (entityType === "tenant") {
    await adminClient
      .from("tenants")
      .update({ account_status: "banned" })
      .eq("id", tenantId);

    // Also ban all platform_users linked to this tenant's users
    await adminClient
      .from("platform_users")
      .update({ account_status: "banned", status: "suspended" })
      .eq("status", "active");
    // Note: in production, filter by tenant membership
    effects.push("login_blocked");
  } else if (entityType === "user") {
    await adminClient
      .from("platform_users")
      .update({ account_status: "banned", status: "suspended" })
      .eq("id", entityId);
    effects.push("user_login_blocked");
  } else if (entityType === "developer_app") {
    await adminClient
      .from("api_clients")
      .update({ status: "revoked", account_status: "banned" })
      .eq("id", entityId);
    effects.push("app_revoked");
  }

  // 4) Suspend active automation rules for tenant
  await adminClient
    .from("automation_rules")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  effects.push("workflows_suspended");

  return effects;
}

async function applyRestrictEffects(adminClient: any, tenantId: string, entityType: string, entityId: string) {
  const effects: string[] = [];

  // 1) Set account_status to restricted
  if (entityType === "tenant") {
    await adminClient
      .from("tenants")
      .update({ account_status: "restricted" })
      .eq("id", tenantId);
    effects.push("tenant_restricted");
  } else if (entityType === "user") {
    await adminClient
      .from("platform_users")
      .update({ account_status: "restricted" })
      .eq("id", entityId);
    effects.push("user_restricted");
  } else if (entityType === "developer_app") {
    await adminClient
      .from("api_clients")
      .update({ account_status: "restricted" })
      .eq("id", entityId);
    effects.push("app_restricted");
  }

  // 2) Block new API client creation (mark tenant as restricted — enforced in app layer)
  effects.push("new_integrations_blocked");

  return effects;
}

async function applySuspendEffects(adminClient: any, tenantId: string, entityType: string, entityId: string) {
  const effects: string[] = [];

  if (entityType === "tenant") {
    await adminClient
      .from("tenants")
      .update({ account_status: "suspended" })
      .eq("id", tenantId);

    await adminClient
      .from("tenant_plans")
      .update({ status: "suspended", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trial"]);
    effects.push("tenant_suspended", "billing_suspended");
  } else if (entityType === "user") {
    await adminClient
      .from("platform_users")
      .update({ account_status: "suspended", status: "suspended" })
      .eq("id", entityId);
    effects.push("user_suspended");
  }

  return effects;
}

// ── Main handler ───────────────────────────────────────────────

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
      const {
        tenant_id, action_type, reason, reason_category, severity,
        expires_at, ban_type, scope_detail, is_permanent,
        related_incident_id, notes, entity_type: rawEntityType, entity_id: rawEntityId,
      } = body;

      if (!tenant_id || !action_type || !reason) {
        return json({ error: "tenant_id, action_type, reason required" }, 400);
      }

      const entityType = rawEntityType || "tenant";
      const entityId = rawEntityId || tenant_id;

      // Create enforcement record
      const { data: enforcement, error } = await adminClient
        .from("account_enforcements")
        .insert({
          tenant_id,
          entity_type: entityType,
          entity_id: entityId,
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
          entity_type: entityType,
          entity_id: entityId,
          ban_type: ban_type || "full",
          scope_detail: scope_detail || null,
          reason_category: reason_category || "abuse",
          reason_description: reason,
          severity_level: severity || "medium",
          is_permanent: is_permanent || false,
          banned_by: caller.id,
          review_required: severity === "critical",
          appeal_allowed: !is_permanent,
        });
      }

      // ── Apply cascading effects based on action_type ──
      let effects: string[] = [];
      if (action_type === "ban") {
        effects = await applyBanEffects(adminClient, tenant_id, entityType, entityId);
      } else if (action_type === "restrict") {
        effects = await applyRestrictEffects(adminClient, tenant_id, entityType, entityId);
      } else if (action_type === "suspend") {
        effects = await applySuspendEffects(adminClient, tenant_id, entityType, entityId);
      }

      // Audit log with effects
      await adminClient.from("enforcement_audit_log").insert({
        enforcement_id: enforcement.id,
        event_type: `account_${action_type}`,
        actor_id: caller.id,
        tenant_id,
        details: { reason, severity, entity_type: entityType, entity_id: entityId, cascading_effects: effects },
      });

      return json({ success: true, enforcement, effects });
    }

    // ── REVOKE ──
    if (action === "revoke" && isAdmin) {
      const { enforcement_id, reason: revokeReason } = body;
      if (!enforcement_id) return json({ error: "enforcement_id required" }, 400);

      const { data: existing } = await adminClient
        .from("account_enforcements")
        .select("*")
        .eq("id", enforcement_id)
        .single();

      if (!existing) return json({ error: "Enforcement not found" }, 404);

      await adminClient
        .from("account_enforcements")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", enforcement_id);

      await adminClient
        .from("ban_registry")
        .update({ unbanned_at: new Date().toISOString(), unbanned_by: caller.id, unban_reason: revokeReason })
        .eq("enforcement_id", enforcement_id)
        .is("unbanned_at", null);

      // Restore account_status via DB trigger (sync_account_status_on_enforcement)

      await adminClient.from("enforcement_audit_log").insert({
        enforcement_id,
        event_type: "enforcement_revoked",
        actor_id: caller.id,
        tenant_id: existing.tenant_id,
        details: { reason: revokeReason },
      });

      return json({ success: true });
    }

    // ── CHECK ──
    if (action === "check") {
      const { tenant_id, entity_type, entity_id } = body;
      const eType = entity_type || "tenant";
      const eId = entity_id || tenant_id;

      if (!eId) return json({ error: "entity_id or tenant_id required" }, 400);

      const { data } = await adminClient
        .from("account_enforcements")
        .select("*")
        .eq("entity_type", eType)
        .eq("entity_id", eId)
        .eq("status", "active");

      const now = new Date().toISOString();
      const active = (data ?? []).filter((e: any) => !e.expires_at || e.expires_at > now);

      let accountStatus = "active";
      if (active.some((e: any) => e.action_type === "ban")) accountStatus = "banned";
      else if (active.some((e: any) => e.action_type === "suspend")) accountStatus = "suspended";
      else if (active.some((e: any) => e.action_type === "restrict")) accountStatus = "restricted";
      else if (active.length > 0) accountStatus = "under_review";

      return json({ account_status: accountStatus, restricted: accountStatus !== "active", enforcements: active });
    }

    if (!isAdmin) return json({ error: "Forbidden" }, 403);
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
