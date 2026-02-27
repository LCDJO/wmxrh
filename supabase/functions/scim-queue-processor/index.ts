/**
 * SCIM Queue Processor — Processes pending SCIM provisioning jobs.
 * Called periodically (cron) or manually from the platform.
 * 
 * Responsibilities:
 * - CREATE: Sync user to tenant_memberships + user_roles
 * - UPDATE: Update user metadata
 * - DEACTIVATE: Soft-disable user in tenant (never delete)
 * - REACTIVATE: Re-enable user in tenant
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

async function processJob(db: ReturnType<typeof supabaseAdmin>, job: any) {
  const payload = job.scim_payload;
  const tenantId = job.tenant_id;
  const externalId = job.external_id;

  // Mark as processing
  await db
    .from("scim_provisioning_queue")
    .update({ status: "processing", attempts: job.attempts + 1 })
    .eq("id", job.id);

  try {
    // Load SCIM config for this tenant
    const { data: scimConfig } = await db
      .from("scim_configs")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!scimConfig?.is_enabled) {
      await db
        .from("scim_provisioning_queue")
        .update({ status: "skipped", error_message: "SCIM disabled for tenant", processed_at: new Date().toISOString() })
        .eq("id", job.id);
      return;
    }

    if (job.resource_type === "User") {
      await processUserJob(db, job, payload, tenantId, scimConfig);
    } else if (job.resource_type === "Group") {
      await processGroupJob(db, job, payload, tenantId, scimConfig);
    }

    await db
      .from("scim_provisioning_queue")
      .update({ status: "completed", processed_at: new Date().toISOString() })
      .eq("id", job.id);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const newStatus = job.attempts + 1 >= job.max_attempts ? "failed" : "pending";
    await db
      .from("scim_provisioning_queue")
      .update({ status: newStatus, error_message: errMsg, processed_at: new Date().toISOString() })
      .eq("id", job.id);
  }
}

async function processUserJob(
  db: ReturnType<typeof supabaseAdmin>,
  job: any,
  payload: any,
  tenantId: string,
  scimConfig: any
) {
  const email = payload.emails?.[0]?.value || payload.userName;
  const defaultRole = scimConfig.default_role || "viewer";

  switch (job.operation) {
    case "CREATE": {
      if (!scimConfig.auto_create_users) return;
      // Check if user already exists in auth
      const { data: existingUsers } = await db.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u: any) => u.email === email
      );

      if (existingUser) {
        // User exists — just create membership if missing
        const { data: existingMembership } = await db
          .from("tenant_memberships")
          .select("id")
          .eq("user_id", existingUser.id)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (!existingMembership) {
          await db.from("tenant_memberships").insert({
            user_id: existingUser.id,
            tenant_id: tenantId,
            role: defaultRole,
          });
        }

        // Link provisioned user record
        await db
          .from("scim_provisioned_users")
          .update({ user_id: existingUser.id })
          .eq("scim_client_id", job.scim_client_id)
          .eq("external_id", job.external_id);
      }
      // If user doesn't exist in auth, they'll be linked on first login via federation
      break;
    }

    case "UPDATE":
    case "PATCH": {
      // Update provisioned user metadata (already done in SCIM endpoint)
      // Here we sync any changes to tenant memberships if needed
      const { data: provUser } = await db
        .from("scim_provisioned_users")
        .select("user_id")
        .eq("scim_client_id", job.scim_client_id)
        .eq("external_id", job.external_id)
        .maybeSingle();

      if (provUser?.user_id && scimConfig.sync_groups_to_roles && payload.groups) {
        // Map groups to roles via scim_config role_mapping_rules
        const rules = Array.isArray(scimConfig.role_mapping_rules)
          ? scimConfig.role_mapping_rules
          : [];
        for (const group of payload.groups) {
          const groupName = group.display || group.value;
          const matchedRule = rules.find(
            (r: any) => r.scim_group?.toLowerCase() === groupName?.toLowerCase()
          );
          if (matchedRule) {
            // Upsert user_role
            await db.from("user_roles").upsert(
              {
                user_id: provUser.user_id,
                tenant_id: tenantId,
                role: matchedRule.internal_role,
              },
              { onConflict: "user_id,tenant_id,role" }
            );
          }
        }
      }
      break;
    }

    case "DEACTIVATE": {
      if (!scimConfig.auto_deactivate_users) return;
      // Find linked auth user and deactivate membership
      const { data: provUser } = await db
        .from("scim_provisioned_users")
        .select("user_id")
        .eq("scim_client_id", job.scim_client_id)
        .eq("external_id", job.external_id)
        .maybeSingle();

      if (provUser?.user_id) {
        // Soft-deactivate: update membership status instead of deleting
        await db
          .from("tenant_memberships")
          .update({ role: "inactive" })
          .eq("user_id", provUser.user_id)
          .eq("tenant_id", tenantId);
      }
      break;
    }

    case "REACTIVATE": {
      const { data: provUser } = await db
        .from("scim_provisioned_users")
        .select("user_id")
        .eq("scim_client_id", job.scim_client_id)
        .eq("external_id", job.external_id)
        .maybeSingle();

      if (provUser?.user_id) {
        const defaultRole = scimConfig.default_role || "viewer";
        await db
          .from("tenant_memberships")
          .update({ role: defaultRole })
          .eq("user_id", provUser.user_id)
          .eq("tenant_id", tenantId);
      }
      break;
    }
  }
}

async function processGroupJob(
  db: ReturnType<typeof supabaseAdmin>,
  job: any,
  payload: any,
  tenantId: string,
  scimConfig: any
) {
  if (!scimConfig.sync_groups_to_roles) return;

  // When a group is updated, re-map members to roles
  const rules = Array.isArray(scimConfig.role_mapping_rules)
    ? scimConfig.role_mapping_rules
    : [];

  const groupName = payload.displayName;
  const matchedRule = rules.find(
    (r: any) => r.scim_group?.toLowerCase() === groupName?.toLowerCase()
  );

  if (!matchedRule || !payload.members) return;

  for (const member of payload.members) {
    // Find provisioned user by SCIM ID
    const { data: provUser } = await db
      .from("scim_provisioned_users")
      .select("user_id")
      .eq("scim_id", member.value)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (provUser?.user_id) {
      await db.from("user_roles").upsert(
        {
          user_id: provUser.user_id,
          tenant_id: tenantId,
          role: matchedRule.internal_role,
        },
        { onConflict: "user_id,tenant_id,role" }
      );
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const db = supabaseAdmin();

  // Process up to 50 pending jobs
  const { data: jobs, error } = await db
    .from("scim_provisioning_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  let failed = 0;

  for (const job of jobs || []) {
    try {
      await processJob(db, job);
      processed++;
    } catch {
      failed++;
    }
  }

  // Update last_sync_at on affected SCIM clients
  const clientIds = [...new Set((jobs || []).map((j: any) => j.scim_client_id))];
  for (const cid of clientIds) {
    await db
      .from("scim_clients")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", cid);
  }

  return new Response(
    JSON.stringify({
      processed,
      failed,
      total: (jobs || []).length,
      timestamp: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
