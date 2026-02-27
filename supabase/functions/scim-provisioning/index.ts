/**
 * SCIM 2.0 Provisioning Engine — Edge Function
 * 
 * RFC 7644 compliant endpoints:
 *   GET    /scim/v2/ServiceProviderConfig
 *   GET    /scim/v2/Schemas
 *   GET    /scim/v2/ResourceTypes
 *   GET    /scim/v2/Users
 *   GET    /scim/v2/Users/:id
 *   POST   /scim/v2/Users
 *   PUT    /scim/v2/Users/:id
 *   PATCH  /scim/v2/Users/:id
 *   DELETE /scim/v2/Users/:id
 *   GET    /scim/v2/Groups
 *   GET    /scim/v2/Groups/:id
 *   POST   /scim/v2/Groups
 *   PUT    /scim/v2/Groups/:id
 *   PATCH  /scim/v2/Groups/:id
 *   DELETE /scim/v2/Groups/:id
 * 
 * Authentication: Bearer token matched against scim_clients.bearer_token_hash
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

function scimError(status: number, scimType: string, detail: string) {
  return new Response(
    JSON.stringify({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      status: String(status),
      scimType,
      detail,
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/scim+json" } }
  );
}

function scimResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/scim+json" },
  });
}

// ── Auth: validate bearer token against scim_clients ──
async function authenticateClient(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);

  // Hash the token for comparison (simple SHA-256)
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const db = supabaseAdmin();
  const { data } = await db
    .from("scim_clients")
    .select("*")
    .eq("bearer_token_hash", tokenHash)
    .eq("is_active", true)
    .maybeSingle();

  return data;
}

// ── Log provisioning operation ──
async function logOperation(
  client: { id: string; tenant_id: string },
  operation: string,
  resourceType: string,
  resourceId: string | null,
  externalId: string | null,
  requestPayload: unknown,
  responseStatus: number,
  responsePayload: unknown,
  errorMessage: string | null,
  ipAddress: string | null,
  startTime: number
) {
  const db = supabaseAdmin();
  await db.from("scim_provisioning_logs").insert({
    tenant_id: client.tenant_id,
    scim_client_id: client.id,
    operation,
    resource_type: resourceType,
    resource_id: resourceId,
    external_id: externalId,
    request_payload: requestPayload as any,
    response_status: responseStatus,
    response_payload: responsePayload as any,
    error_message: errorMessage,
    ip_address: ipAddress,
    duration_ms: Date.now() - startTime,
  });
}

// ── Audit: write to audit_logs for compliance ──
async function auditScimEvent(
  tenantId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata: Record<string, any>,
  ipAddress: string | null
) {
  const db = supabaseAdmin();
  await db.from("audit_logs").insert({
    tenant_id: tenantId,
    action: `SCIM_${action}`,
    entity_type: resourceType,
    entity_id: resourceId,
    metadata: { ...metadata, ip_address: ipAddress, source: "scim_provisioning" } as any,
  });
}

// ── Rate Limiting per tenant (sliding window: 120 req/min) ──
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 120;

async function checkRateLimit(tenantId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await db
    .from("scim_provisioning_logs")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", windowStart);
  return (count ?? 0) < RATE_LIMIT_MAX_REQUESTS;
}

// ── Mass Deletion Protection (max 50 deactivations/hour) ──
const MAX_DELETIONS_PER_HOUR = 50;
const MODIFICATION_ALERT_THRESHOLD = 30; // Alert when 30+ modifications/hour

async function checkMassDeletionThreshold(tenantId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("scim_provisioning_logs")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("operation", ["DELETE", "DEACTIVATE"])
    .gte("created_at", oneHourAgo);
  return (count ?? 0) < MAX_DELETIONS_PER_HOUR;
}

// ── High-modification-rate alert ──
async function checkAndAlertHighModificationRate(tenantId: string, ip: string | null): Promise<void> {
  const db = supabaseAdmin();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("scim_provisioning_logs")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("operation", ["CREATE", "UPDATE", "PATCH", "DELETE", "DEACTIVATE"])
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= MODIFICATION_ALERT_THRESHOLD) {
    await db.from("audit_logs").insert({
      tenant_id: tenantId,
      action: "SCIM_HIGH_MODIFICATION_RATE",
      entity_type: "scim_provisioning",
      entity_id: null,
      metadata: {
        modifications_last_hour: count,
        threshold: MODIFICATION_ALERT_THRESHOLD,
        ip_address: ip,
        source: "scim_provisioning",
        severity: "warning",
        message: `High SCIM modification rate detected: ${count} operations in the last hour (threshold: ${MODIFICATION_ALERT_THRESHOLD})`,
      } as any,
    });
  }
}

// ── ServiceProviderConfig ──
function getServiceProviderConfig() {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    documentationUri: "https://docs.lovable.dev",
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: "oauthbearertoken",
        name: "OAuth Bearer Token",
        description: "Authentication scheme using Bearer tokens",
      },
    ],
    meta: { resourceType: "ServiceProviderConfig" },
  };
}

// ── Schemas ──
function getSchemas() {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: 2,
    Resources: [
      {
        id: "urn:ietf:params:scim:schemas:core:2.0:User",
        name: "User",
        description: "User Account",
        attributes: [
          { name: "userName", type: "string", required: true, uniqueness: "server" },
          { name: "displayName", type: "string", required: false },
          { name: "active", type: "boolean", required: false },
          { name: "emails", type: "complex", multiValued: true, required: false },
          { name: "externalId", type: "string", required: false },
        ],
        meta: { resourceType: "Schema" },
      },
      {
        id: "urn:ietf:params:scim:schemas:core:2.0:Group",
        name: "Group",
        description: "Group",
        attributes: [
          { name: "displayName", type: "string", required: true },
          { name: "members", type: "complex", multiValued: true, required: false },
          { name: "externalId", type: "string", required: false },
        ],
        meta: { resourceType: "Schema" },
      },
    ],
  };
}

// ── ResourceTypes ──
function getResourceTypes() {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: 2,
    Resources: [
      {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
        id: "User",
        name: "User",
        endpoint: "/Users",
        schema: "urn:ietf:params:scim:schemas:core:2.0:User",
        meta: { resourceType: "ResourceType" },
      },
      {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
        id: "Group",
        name: "Group",
        endpoint: "/Groups",
        schema: "urn:ietf:params:scim:schemas:core:2.0:Group",
        meta: { resourceType: "ResourceType" },
      },
    ],
  };
}

// ── User helpers ──
function toScimUser(row: any) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: row.scim_id,
    externalId: row.external_id,
    userName: row.email || row.external_id,
    displayName: row.display_name,
    active: row.active,
    emails: row.email ? [{ value: row.email, primary: true }] : [],
    meta: {
      resourceType: "User",
      created: row.created_at,
      lastModified: row.updated_at,
    },
  };
}

function toScimGroup(row: any) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
    id: row.scim_id,
    externalId: row.external_id,
    displayName: row.display_name,
    members: (row.members || []).map((m: any) => ({
      value: m.value || m,
      display: m.display || "",
    })),
    meta: {
      resourceType: "Group",
      created: row.created_at,
      lastModified: row.updated_at,
    },
  };
}

// ── SCIM Attribute Mapping Engine ──
function resolveScimPath(obj: any, path: string): any {
  // Handle paths like "emails[0].value", "name.givenName", "userName"
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function applyAttributeMapping(scimBody: any, mapping: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [scimPath, internalField] of Object.entries(mapping)) {
    const value = resolveScimPath(scimBody, scimPath);
    if (value !== undefined) {
      result[internalField] = value;
    }
  }
  return result;
}

async function loadAttributeMapping(db: ReturnType<typeof supabaseAdmin>, tenantId: string): Promise<Record<string, string>> {
  const { data } = await db
    .from("scim_configs")
    .select("default_attribute_mapping")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (data?.default_attribute_mapping && typeof data.default_attribute_mapping === "object") {
    return data.default_attribute_mapping as Record<string, string>;
  }
  // Fallback defaults
  return {
    "userName": "email",
    "displayName": "display_name",
    "emails[0].value": "email",
    "name.givenName": "first_name",
    "name.familyName": "last_name",
    "active": "active",
    "externalId": "external_id",
  };
}

// ── User CRUD ──
async function handleUsers(
  method: string,
  resourceId: string | null,
  body: any,
  client: any,
  startTime: number,
  ip: string | null
) {
  const db = supabaseAdmin();
  const tenantId = client.tenant_id;
  const clientId = client.id;

  if (method === "GET" && !resourceId) {
    // List users
    const { data, error } = await db
      .from("scim_provisioned_users")
      .select("*")
      .eq("scim_client_id", clientId)
      .limit(200);
    if (error) return scimError(500, "serverError", error.message);
    const resources = (data || []).map(toScimUser);
    const resp = {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: resources.length,
      Resources: resources,
    };
    await logOperation(client, "LIST", "User", null, null, null, 200, resp, null, ip, startTime);
    return scimResponse(resp);
  }

  if (method === "GET" && resourceId) {
    const { data } = await db
      .from("scim_provisioned_users")
      .select("*")
      .eq("scim_client_id", clientId)
      .eq("scim_id", resourceId)
      .maybeSingle();
    if (!data) return scimError(404, "notFound", "User not found");
    const user = toScimUser(data);
    await logOperation(client, "GET", "User", resourceId, data.external_id, null, 200, user, null, ip, startTime);
    return scimResponse(user);
  }

  if (method === "POST") {
    // Apply tenant's attribute mapping
    const attrMapping = await loadAttributeMapping(db, tenantId);
    const mapped = applyAttributeMapping(body, attrMapping);

    const externalId = mapped.external_id || body.externalId || body.userName;
    const email = mapped.email || body.emails?.[0]?.value || body.userName;
    const displayName = mapped.display_name || body.displayName || body.userName;
    const scimId = crypto.randomUUID();

    // Insert provisioned user record immediately (for SCIM response)
    const { data, error } = await db
      .from("scim_provisioned_users")
      .insert({
        tenant_id: tenantId,
        scim_client_id: clientId,
        external_id: externalId,
        scim_id: scimId,
        display_name: displayName,
        email,
        active: mapped.active !== false && body.active !== false,
        scim_data: body,
      })
      .select()
      .single();
    if (error) {
      await logOperation(client, "CREATE", "User", null, externalId, body, 409, null, error.message, ip, startTime);
      return scimError(409, "uniqueness", error.message);
    }

    // Queue async provisioning (tenant IAM sync, role assignment, etc.)
    await db.from("scim_provisioning_queue").insert({
      tenant_id: tenantId,
      scim_client_id: clientId,
      operation: "CREATE",
      resource_type: "User",
      external_id: externalId,
      scim_payload: body,
    });

    const user = toScimUser(data);
    await logOperation(client, "CREATE", "User", scimId, externalId, body, 201, user, null, ip, startTime);
    await auditScimEvent(tenantId, "USER_CREATE", "User", scimId, { external_id: externalId, email }, ip);
    await checkAndAlertHighModificationRate(tenantId, ip);
    return scimResponse(user, 201);
    return scimResponse(user, 201);
  }

  if ((method === "PUT" || method === "PATCH") && resourceId) {
    // Apply tenant's attribute mapping
    const attrMapping = await loadAttributeMapping(db, tenantId);
    const mapped = applyAttributeMapping(body, attrMapping);

    const isDeactivation = (mapped.active === false) || (body.active === false);
    const isReactivation = (mapped.active === true) || (body.active === true);
    const now = new Date().toISOString();

    const updates: any = {
      display_name: mapped.display_name || body.displayName,
      email: mapped.email || body.emails?.[0]?.value,
      active: mapped.active ?? body.active,
      scim_data: body,
      last_synced_at: now,
    };

    // Soft-delete tracking: set deactivated_at when active=false
    if (isDeactivation) {
      updates.deactivated_at = now;
      updates.deactivated_reason = "SCIM provisioning: active=false";
    } else if (isReactivation) {
      updates.deactivated_at = null;
      updates.deactivated_reason = null;
    }

    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

    const { data, error } = await db
      .from("scim_provisioned_users")
      .update(updates)
      .eq("scim_client_id", clientId)
      .eq("scim_id", resourceId)
      .select()
      .single();
    if (error || !data) {
      const op = isDeactivation ? "DEACTIVATE" : method === "PUT" ? "UPDATE" : "PATCH";
      await logOperation(client, op, "User", resourceId, null, body, 404, null, error?.message || "Not found", ip, startTime);
      return scimError(404, "notFound", "User not found");
    }

    // Queue async processing for IAM sync
    const queueOp = isDeactivation ? "DEACTIVATE" : isReactivation ? "REACTIVATE" : "UPDATE";
    await db.from("scim_provisioning_queue").insert({
      tenant_id: tenantId,
      scim_client_id: clientId,
      operation: queueOp,
      resource_type: "User",
      external_id: data.external_id,
      scim_payload: body,
    });

    const user = toScimUser(data);
    await logOperation(client, queueOp, "User", resourceId, data.external_id, body, 200, user, null, ip, startTime);
    await auditScimEvent(tenantId, `USER_${queueOp}`, "User", resourceId, { external_id: data.external_id }, ip);
    return scimResponse(user);
  }

  if (method === "DELETE" && resourceId) {
    // SCIM DELETE → soft-delete (deactivate), never hard delete
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("scim_provisioned_users")
      .update({
        active: false,
        deactivated_at: now,
        deactivated_reason: "SCIM DELETE request — soft-deactivated",
        last_synced_at: now,
      })
      .eq("scim_client_id", clientId)
      .eq("scim_id", resourceId)
      .select()
      .single();

    if (error || !data) {
      await logOperation(client, "DELETE", "User", resourceId, null, null, 404, null, error?.message || "Not found", ip, startTime);
      return scimError(404, "notFound", "User not found");
    }

    // Queue deactivation in tenant IAM
    await db.from("scim_provisioning_queue").insert({
      tenant_id: tenantId,
      scim_client_id: clientId,
      operation: "DEACTIVATE",
      resource_type: "User",
      external_id: data.external_id,
      scim_payload: { active: false, reason: "SCIM DELETE" },
    });

    await logOperation(client, "DEACTIVATE", "User", resourceId, data.external_id, null, 204, null, null, ip, startTime);
    await auditScimEvent(tenantId, "USER_DELETE", "User", resourceId, { external_id: data.external_id, soft_delete: true }, ip);
    await checkAndAlertHighModificationRate(tenantId, ip);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return scimError(405, "invalidMethod", "Method not allowed");
}

// ── Resolve group → role mapping from scim_configs ──
async function resolveGroupRole(db: ReturnType<typeof supabaseAdmin>, tenantId: string, displayName: string): Promise<string | null> {
  const { data: scimConfig } = await db
    .from("scim_configs")
    .select("role_mapping_rules")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!scimConfig) return null;
  const rules = Array.isArray(scimConfig.role_mapping_rules) ? scimConfig.role_mapping_rules : [];
  const matched = rules.find(
    (r: any) => r.scim_group?.toLowerCase() === displayName?.toLowerCase()
  );
  return matched?.internal_role || null;
}

// ── Group CRUD ──
async function handleGroups(
  method: string,
  resourceId: string | null,
  body: any,
  client: any,
  startTime: number,
  ip: string | null
) {
  const db = supabaseAdmin();
  const tenantId = client.tenant_id;
  const clientId = client.id;

  if (method === "GET" && !resourceId) {
    const { data } = await db
      .from("scim_provisioned_groups")
      .select("*")
      .eq("scim_client_id", clientId)
      .limit(200);
    const resources = (data || []).map(toScimGroup);
    const resp = {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: resources.length,
      Resources: resources,
    };
    await logOperation(client, "LIST", "Group", null, null, null, 200, resp, null, ip, startTime);
    return scimResponse(resp);
  }

  if (method === "GET" && resourceId) {
    const { data } = await db
      .from("scim_provisioned_groups")
      .select("*")
      .eq("scim_client_id", clientId)
      .eq("scim_id", resourceId)
      .maybeSingle();
    if (!data) return scimError(404, "notFound", "Group not found");
    const group = toScimGroup(data);
    await logOperation(client, "GET", "Group", resourceId, data.external_id, null, 200, group, null, ip, startTime);
    return scimResponse(group);
  }

  if (method === "POST") {
    const externalId = body.externalId || body.displayName;
    const scimId = crypto.randomUUID();

    // Resolve mapped_role from scim_config role_mapping_rules
    const mappedRole = await resolveGroupRole(db, tenantId, body.displayName);

    const { data, error } = await db
      .from("scim_provisioned_groups")
      .insert({
        tenant_id: tenantId,
        scim_client_id: clientId,
        external_id: externalId,
        scim_id: scimId,
        display_name: body.displayName,
        members: body.members || [],
        mapped_role: mappedRole,
        scim_data: body,
      })
      .select()
      .single();
    if (error) {
      await logOperation(client, "CREATE", "Group", null, externalId, body, 409, null, error.message, ip, startTime);
      return scimError(409, "uniqueness", error.message);
    }

    // Queue role sync for all members
    await db.from("scim_provisioning_queue").insert({
      tenant_id: tenantId,
      scim_client_id: clientId,
      operation: "CREATE",
      resource_type: "Group",
      external_id: externalId,
      scim_payload: { displayName: body.displayName, members: body.members || [], mappedRole },
    });

    const group = toScimGroup(data);
    await logOperation(client, "CREATE", "Group", scimId, externalId, body, 201, group, null, ip, startTime);
    return scimResponse(group, 201);
  }

  if ((method === "PUT" || method === "PATCH") && resourceId) {
    const mappedRole = body.displayName
      ? await resolveGroupRole(db, tenantId, body.displayName)
      : undefined;

    const updates: any = {
      display_name: body.displayName,
      members: body.members,
      mapped_role: mappedRole,
      scim_data: body,
      last_synced_at: new Date().toISOString(),
    };
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

    const { data, error } = await db
      .from("scim_provisioned_groups")
      .update(updates)
      .eq("scim_client_id", clientId)
      .eq("scim_id", resourceId)
      .select()
      .single();
    if (error || !data) {
      await logOperation(client, method === "PUT" ? "UPDATE" : "PATCH", "Group", resourceId, null, body, 404, null, error?.message || "Not found", ip, startTime);
      return scimError(404, "notFound", "Group not found");
    }

    // Queue role re-sync for members
    await db.from("scim_provisioning_queue").insert({
      tenant_id: tenantId,
      scim_client_id: clientId,
      operation: "UPDATE",
      resource_type: "Group",
      external_id: data.external_id,
      scim_payload: { displayName: data.display_name, members: data.members, mappedRole: data.mapped_role },
    });

    const group = toScimGroup(data);
    await logOperation(client, method === "PUT" ? "UPDATE" : "PATCH", "Group", resourceId, data.external_id, body, 200, group, null, ip, startTime);
    return scimResponse(group);
  }

  if (method === "DELETE" && resourceId) {
    // Soft-delete: mark as inactive, never hard-delete historical data
    const now = new Date().toISOString();
    const { data, error } = await db
      .from("scim_provisioned_groups")
      .update({
        members: [],
        mapped_role: null,
        last_synced_at: now,
      })
      .eq("scim_client_id", clientId)
      .eq("scim_id", resourceId)
      .select()
      .single();

    if (error || !data) {
      await logOperation(client, "DELETE", "Group", resourceId, null, null, 404, null, error?.message || "Not found", ip, startTime);
      return scimError(404, "notFound", "Group not found");
    }

    // Queue removal of role assignments for former members
    await db.from("scim_provisioning_queue").insert({
      tenant_id: tenantId,
      scim_client_id: clientId,
      operation: "DEACTIVATE",
      resource_type: "Group",
      external_id: data.external_id,
      scim_payload: { displayName: data.display_name, members: [], reason: "SCIM DELETE" },
    });

    await logOperation(client, "DEACTIVATE", "Group", resourceId, data.external_id, null, 204, null, null, ip, startTime);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return scimError(405, "invalidMethod", "Method not allowed");
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip");
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // Remove function name prefix (e.g. "scim-provisioning")
  // Path: /scim-provisioning/scim/v2/...
  // After split: ["scim-provisioning", "scim", "v2", ...]
  const scimIdx = pathParts.indexOf("scim");
  if (scimIdx === -1 || pathParts[scimIdx + 1] !== "v2") {
    // Try direct paths without /scim/v2 prefix
    // e.g. /scim-provisioning/Users
    const fnName = pathParts[0]; // function name
    const resource = pathParts[1];
    const resourceId = pathParts[2] || null;

    if (!resource) {
      return scimError(400, "invalidPath", "Invalid SCIM path");
    }

    // Authenticate
    const client = await authenticateClient(req);
    if (!client) {
      await auditScimEvent("unknown", "AUTH_FAILURE", resource, null, { path: url.pathname }, ip);
      return scimError(401, "unauthorized", "Invalid or missing bearer token");
    }

    // Rate limit
    if (!(await checkRateLimit(client.tenant_id))) {
      await auditScimEvent(client.tenant_id, "RATE_LIMITED", resource, null, {}, ip);
      return scimError(429, "tooMany", "Rate limit exceeded. Max 120 requests per minute.");
    }

    let body = null;
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      try { body = await req.json(); } catch { body = {}; }
    }

    // Mass deletion protection
    if (req.method === "DELETE" || (body?.active === false)) {
      if (!(await checkMassDeletionThreshold(client.tenant_id))) {
        await auditScimEvent(client.tenant_id, "MASS_DELETE_BLOCKED", resource, resourceId, {}, ip);
        return scimError(429, "tooMany", "Mass deletion threshold exceeded (50/hour). Contact support.");
      }
    }

    switch (resource) {
      case "ServiceProviderConfig":
        return scimResponse(getServiceProviderConfig());
      case "Schemas":
        return scimResponse(getSchemas());
      case "ResourceTypes":
        return scimResponse(getResourceTypes());
      case "Users":
        return handleUsers(req.method, resourceId, body, client, startTime, ip);
      case "Groups":
        return handleGroups(req.method, resourceId, body, client, startTime, ip);
      default:
        return scimError(404, "notFound", `Unknown resource: ${resource}`);
    }
  }

  // Standard /scim/v2/... path
  const resource = pathParts[scimIdx + 2];
  const resourceId = pathParts[scimIdx + 3] || null;

  // Discovery endpoints (no auth required)
  if (resource === "ServiceProviderConfig" && req.method === "GET") {
    return scimResponse(getServiceProviderConfig());
  }
  if (resource === "Schemas" && req.method === "GET") {
    return scimResponse(getSchemas());
  }
  if (resource === "ResourceTypes" && req.method === "GET") {
    return scimResponse(getResourceTypes());
  }

  // Auth required for User/Group operations
  const client = await authenticateClient(req);
  if (!client) {
    await auditScimEvent("unknown", "AUTH_FAILURE", resource || "unknown", null, { path: url.pathname }, ip);
    return scimError(401, "unauthorized", "Invalid or missing bearer token");
  }

  // Rate limit
  if (!(await checkRateLimit(client.tenant_id))) {
    await auditScimEvent(client.tenant_id, "RATE_LIMITED", resource || "unknown", null, {}, ip);
    return scimError(429, "tooMany", "Rate limit exceeded. Max 120 requests per minute.");
  }

  let body = null;
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    try { body = await req.json(); } catch { body = {}; }
  }

  // Mass deletion protection
  if (req.method === "DELETE" || (body?.active === false)) {
    if (!(await checkMassDeletionThreshold(client.tenant_id))) {
      await auditScimEvent(client.tenant_id, "MASS_DELETE_BLOCKED", resource || "unknown", resourceId, {}, ip);
      return scimError(429, "tooMany", "Mass deletion threshold exceeded (50/hour). Contact support.");
    }
  }

  switch (resource) {
    case "Users":
      return handleUsers(req.method, resourceId, body, client, startTime, ip);
    case "Groups":
      return handleGroups(req.method, resourceId, body, client, startTime, ip);
    default:
      return scimError(404, "notFound", `Unknown resource: ${resource}`);
  }
});
