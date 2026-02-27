import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

/**
 * api-gateway-validate — Edge function for PAMS API Gateway.
 *
 * Validates incoming API requests:
 *   1. JWT Access Token verification (federation tokens or Supabase auth)
 *   2. Scope validation (hr.employee.read, billing.invoice.read, landing.publish)
 *   3. API key verification (for machine-to-machine)
 *   4. Rate limit metadata
 *
 * Endpoints:
 *   POST /validate    — Full gateway validation
 *   POST /introspect  — Token introspection (RFC 7662)
 */

// ── Known platform scopes ──
const KNOWN_SCOPES = [
  "hr.employee.read",
  "hr.employee.write",
  "hr.department.read",
  "hr.position.read",
  "billing.invoice.read",
  "billing.invoice.write",
  "billing.plan.read",
  "landing.publish",
  "landing.read",
  "fleet.vehicle.read",
  "fleet.vehicle.write",
  "api.client.manage",
] as const;

type KnownScope = (typeof KNOWN_SCOPES)[number];

interface ValidateRequest {
  /** The access token (JWT) to validate */
  access_token?: string;
  /** API key (alternative to JWT) */
  api_key?: string;
  /** Required scopes for this request */
  required_scopes?: string[];
  /** The endpoint being accessed */
  endpoint?: string;
  /** HTTP method */
  method?: string;
}

interface ValidateResponse {
  valid: boolean;
  user_id?: string;
  tenant_id?: string;
  granted_scopes?: string[];
  missing_scopes?: string[];
  client_id?: string;
  environment?: string;
  token_type?: "jwt" | "api_key";
  expires_at?: string;
  error?: string;
  warnings?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body: ValidateRequest = await req.json();

    if (path === "introspect") {
      return await handleIntrospect(req, body);
    }

    // Default: /validate
    return await handleValidate(req, body);
  } catch (err) {
    console.error("[api-gateway-validate] Error:", err);
    return json({ valid: false, error: "Internal validation error" }, 500);
  }
});

// ════════════════════════════════════
// VALIDATE — Full gateway validation
// ════════════════════════════════════

async function handleValidate(
  req: Request,
  body: ValidateRequest
): Promise<Response> {
  const warnings: string[] = [];

  // ── Strategy 1: JWT Access Token ──
  const token =
    body.access_token ||
    req.headers.get("Authorization")?.replace("Bearer ", "");

  if (token) {
    return await validateJWT(token, body.required_scopes, body.endpoint, warnings);
  }

  // ── Strategy 2: API Key ──
  const apiKey = body.api_key || req.headers.get("X-API-Key");

  if (apiKey) {
    return await validateApiKey(apiKey, body.required_scopes, warnings);
  }

  return json(
    {
      valid: false,
      error: "No access_token or api_key provided",
    } as ValidateResponse,
    401
  );
}

// ════════════════════════════════════
// JWT VALIDATION
// ════════════════════════════════════

async function validateJWT(
  token: string,
  requiredScopes: string[] | undefined,
  endpoint: string | undefined,
  warnings: string[]
): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Verify token via Supabase Auth
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims(token);

  if (claimsError || !claimsData?.claims) {
    return json(
      {
        valid: false,
        error: "Invalid or expired access token",
        token_type: "jwt",
      } as ValidateResponse,
      401
    );
  }

  const claims = claimsData.claims;
  const userId = claims.sub as string;
  const email = claims.email as string | undefined;
  const exp = claims.exp as number | undefined;

  // Check expiry
  if (exp && exp < Math.floor(Date.now() / 1000)) {
    return json(
      {
        valid: false,
        error: "Access token has expired",
        token_type: "jwt",
      } as ValidateResponse,
      401
    );
  }

  // Resolve tenant_id from claims or membership
  let tenantId: string | null = (claims as any).tenant_id || null;

  if (!tenantId && userId) {
    // Fallback: resolve from tenant_memberships
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: membership } = await serviceClient
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    tenantId = membership?.tenant_id || null;
  }

  // Resolve scopes from claims, user_roles, or api_keys
  let grantedScopes: string[] = (claims as any).scopes || [];

  if (grantedScopes.length === 0 && userId && tenantId) {
    // Resolve from user_roles → map to API scopes
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role, scope_type")
      .eq("user_id", userId);

    grantedScopes = mapRolesToScopes(roles || []);
  }

  // Validate required scopes
  const requiredList = requiredScopes || [];
  const missingScopes = requiredList.filter(
    (s) => !grantedScopes.includes(s) && !matchesWildcard(s, grantedScopes)
  );

  if (missingScopes.length > 0) {
    return json(
      {
        valid: false,
        error: `Insufficient scopes. Missing: ${missingScopes.join(", ")}`,
        user_id: userId,
        tenant_id: tenantId,
        granted_scopes: grantedScopes,
        missing_scopes: missingScopes,
        token_type: "jwt",
      } as ValidateResponse,
      403
    );
  }

  // Unknown scope warnings
  for (const s of requiredList) {
    if (!KNOWN_SCOPES.includes(s as KnownScope) && !s.includes("*")) {
      warnings.push(`Unknown scope: ${s}`);
    }
  }

  return json({
    valid: true,
    user_id: userId,
    tenant_id: tenantId,
    granted_scopes: grantedScopes,
    missing_scopes: [],
    token_type: "jwt",
    expires_at: exp ? new Date(exp * 1000).toISOString() : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  } as ValidateResponse);
}

// ════════════════════════════════════
// API KEY VALIDATION
// ════════════════════════════════════

async function validateApiKey(
  apiKey: string,
  requiredScopes: string[] | undefined,
  warnings: string[]
): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Hash the API key
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Look up the key
  const { data: keyRecord, error } = await serviceClient
    .from("api_keys")
    .select("*, api_clients!inner(id, name, tenant_id, status, environment)")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !keyRecord) {
    return json(
      {
        valid: false,
        error: "Invalid API key",
        token_type: "api_key",
      } as ValidateResponse,
      401
    );
  }

  // Check key expiry
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return json(
      {
        valid: false,
        error: "API key has expired",
        token_type: "api_key",
      } as ValidateResponse,
      401
    );
  }

  // Check client status
  const client = (keyRecord as any).api_clients;
  if (client?.status !== "active") {
    return json(
      {
        valid: false,
        error: `API client is ${client?.status || "inactive"}`,
        token_type: "api_key",
      } as ValidateResponse,
      403
    );
  }

  // Validate scopes
  const grantedScopes: string[] = keyRecord.scopes || [];
  const requiredList = requiredScopes || [];
  const missingScopes = requiredList.filter(
    (s) => !grantedScopes.includes(s) && !matchesWildcard(s, grantedScopes)
  );

  if (missingScopes.length > 0) {
    return json(
      {
        valid: false,
        error: `Insufficient scopes. Missing: ${missingScopes.join(", ")}`,
        client_id: client?.id,
        tenant_id: client?.tenant_id,
        granted_scopes: grantedScopes,
        missing_scopes: missingScopes,
        token_type: "api_key",
      } as ValidateResponse,
      403
    );
  }

  return json({
    valid: true,
    client_id: client?.id,
    tenant_id: client?.tenant_id,
    granted_scopes: grantedScopes,
    missing_scopes: [],
    environment: client?.environment,
    token_type: "api_key",
    expires_at: keyRecord.expires_at,
    warnings: warnings.length > 0 ? warnings : undefined,
  } as ValidateResponse);
}

// ════════════════════════════════════
// INTROSPECT (RFC 7662)
// ════════════════════════════════════

async function handleIntrospect(
  req: Request,
  body: ValidateRequest
): Promise<Response> {
  const token =
    body.access_token ||
    req.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return json({ active: false });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: claimsData, error } = await supabase.auth.getClaims(token);

  if (error || !claimsData?.claims) {
    return json({ active: false });
  }

  const claims = claimsData.claims;
  const exp = claims.exp as number | undefined;
  const isActive = !exp || exp > Math.floor(Date.now() / 1000);

  return json({
    active: isActive,
    sub: claims.sub,
    email: claims.email,
    exp: exp,
    iat: claims.iat,
    iss: claims.iss,
    tenant_id: (claims as any).tenant_id || null,
    scopes: (claims as any).scopes || [],
    token_type: "Bearer",
  });
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

/** Map user roles to API scopes */
function mapRolesToScopes(
  roles: Array<{ role: string; scope_type: string }>
): string[] {
  const scopes = new Set<string>();

  for (const r of roles) {
    switch (r.role) {
      case "superadmin":
      case "owner":
      case "admin":
      case "tenant_admin":
        // Full access
        scopes.add("hr.employee.read");
        scopes.add("hr.employee.write");
        scopes.add("hr.department.read");
        scopes.add("hr.position.read");
        scopes.add("billing.invoice.read");
        scopes.add("billing.invoice.write");
        scopes.add("billing.plan.read");
        scopes.add("landing.publish");
        scopes.add("landing.read");
        scopes.add("fleet.vehicle.read");
        scopes.add("fleet.vehicle.write");
        scopes.add("api.client.manage");
        break;
      case "hr_manager":
      case "manager":
        scopes.add("hr.employee.read");
        scopes.add("hr.employee.write");
        scopes.add("hr.department.read");
        scopes.add("hr.position.read");
        scopes.add("landing.read");
        break;
      case "hr_analyst":
      case "analyst":
        scopes.add("hr.employee.read");
        scopes.add("hr.department.read");
        scopes.add("hr.position.read");
        break;
      case "viewer":
        scopes.add("hr.employee.read");
        scopes.add("hr.department.read");
        scopes.add("landing.read");
        break;
      case "finance":
        scopes.add("billing.invoice.read");
        scopes.add("billing.plan.read");
        break;
      case "fleet_manager":
        scopes.add("fleet.vehicle.read");
        scopes.add("fleet.vehicle.write");
        break;
      default:
        scopes.add("hr.employee.read");
        scopes.add("landing.read");
        break;
    }
  }

  return Array.from(scopes);
}

/** Wildcard matcher for module.resource.action scope format */
function matchesWildcard(scope: string, granted: string[]): boolean {
  const parts = scope.split(".");
  return granted.some((g) => {
    if (g === "*") return true;
    const gParts = g.split(".");
    for (let i = 0; i < gParts.length; i++) {
      if (gParts[i] === "*") return true;
      if (gParts[i] !== parts[i]) return false;
    }
    return gParts.length === parts.length;
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
