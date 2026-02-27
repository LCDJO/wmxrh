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
    const externalId = body.externalId || body.userName;
    const email = body.emails?.[0]?.value || body.userName;
    const scimId = crypto.randomUUID();

    // Insert provisioned user record immediately (for SCIM response)
    const { data, error } = await db
      .from("scim_provisioned_users")
      .insert({
        tenant_id: tenantId,
        scim_client_id: clientId,
        external_id: externalId,
        scim_id: scimId,
        display_name: body.displayName || body.userName,
        email,
        active: body.active !== false,
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
    return scimResponse(user, 201);
  }

  if ((method === "PUT" || method === "PATCH") && resourceId) {
    // Determine operation type based on active status
    const isDeactivation = body.active === false;
    const isReactivation = body.active === true;
    const now = new Date().toISOString();

    const updates: any = {
      display_name: body.displayName,
      email: body.emails?.[0]?.value,
      active: body.active,
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
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return scimError(405, "invalidMethod", "Method not allowed");
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
    const { data, error } = await db
      .from("scim_provisioned_groups")
      .insert({
        tenant_id: tenantId,
        scim_client_id: clientId,
        external_id: externalId,
        scim_id: scimId,
        display_name: body.displayName,
        members: body.members || [],
        scim_data: body,
      })
      .select()
      .single();
    if (error) {
      await logOperation(client, "CREATE", "Group", null, externalId, body, 409, null, error.message, ip, startTime);
      return scimError(409, "uniqueness", error.message);
    }
    const group = toScimGroup(data);
    await logOperation(client, "CREATE", "Group", scimId, externalId, body, 201, group, null, ip, startTime);
    return scimResponse(group, 201);
  }

  if ((method === "PUT" || method === "PATCH") && resourceId) {
    const updates: any = {
      display_name: body.displayName,
      members: body.members,
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
    const group = toScimGroup(data);
    await logOperation(client, method === "PUT" ? "UPDATE" : "PATCH", "Group", resourceId, data.external_id, body, 200, group, null, ip, startTime);
    return scimResponse(group);
  }

  if (method === "DELETE" && resourceId) {
    const { error } = await db
      .from("scim_provisioned_groups")
      .delete()
      .eq("scim_client_id", clientId)
      .eq("scim_id", resourceId);
    if (error) return scimError(500, "serverError", error.message);
    await logOperation(client, "DELETE", "Group", resourceId, null, null, 204, null, null, ip, startTime);
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
    if (!client) return scimError(401, "unauthorized", "Invalid or missing bearer token");

    let body = null;
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      try { body = await req.json(); } catch { body = {}; }
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
  if (!client) return scimError(401, "unauthorized", "Invalid or missing bearer token");

  let body = null;
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    try { body = await req.json(); } catch { body = {}; }
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
