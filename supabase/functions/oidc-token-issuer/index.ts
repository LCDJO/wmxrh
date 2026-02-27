/**
 * UIFE — OIDC Token Issuer (Edge Function)
 *
 * Issues signed ID Tokens (JWT), Access Tokens (JWT), and Refresh Tokens
 * with platform-specific claims:
 *   sub, tenant_id, roles, scopes, plan
 *
 * Uses HMAC-SHA256 signing with SUPABASE_JWT_SECRET.
 * Production upgrade path: RS256 with asymmetric key pair.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ── JWT helpers (HMAC-SHA256) ────────────────────

function base64url(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlStr(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

async function getSigningKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SUPABASE_JWT_SECRET");
  if (!secret) throw new Error("SUPABASE_JWT_SECRET not configured");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signJWT(payload: Record<string, unknown>, expiresInSec: number): Promise<string> {
  const key = await getSigningKey();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "HS256", typ: "JWT" };
  const claims = {
    ...payload,
    iat: now,
    exp: now + expiresInSec,
    nbf: now,
  };

  const headerB64 = base64urlStr(JSON.stringify(header));
  const payloadB64 = base64urlStr(JSON.stringify(claims));
  const sigInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign("HMAC", key, sigInput);

  return `${headerB64}.${payloadB64}.${base64url(new Uint8Array(sig))}`;
}

async function verifyJWT(token: string): Promise<Record<string, unknown> | null> {
  try {
    const key = await getSigningKey();
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) return null;

    const sigInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    // Decode signature from base64url
    const sigStr = atob(sigB64.replace(/-/g, "+").replace(/_/g, "/"));
    const sig = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) sig[i] = sigStr.charCodeAt(i);

    const valid = await crypto.subtle.verify("HMAC", key, sig, sigInput);
    if (!valid) return null;

    const payloadStr = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadStr);

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

function generateOpaqueToken(prefix = "rt"): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Main handler ─────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? req.headers.get("x-action") ?? "issue";

  try {
    const body = await req.json().catch(() => ({}));

    // ─── ISSUE TOKENS ────────────────────────────
    if (action === "issue") {
      return await handleIssue(supabaseAdmin, body);
    }

    // ─── REFRESH ─────────────────────────────────
    if (action === "refresh") {
      return await handleRefresh(supabaseAdmin, body);
    }

    // ─── VALIDATE ────────────────────────────────
    if (action === "validate") {
      return await handleValidate(body);
    }

    // ─── USERINFO ────────────────────────────────
    if (action === "userinfo") {
      return await handleUserInfo(body);
    }

    // ─── DISCOVERY ───────────────────────────────
    if (action === "discovery") {
      return handleDiscovery();
    }

    // ─── JWKS ────────────────────────────────────
    if (action === "jwks") {
      // HMAC keys are symmetric — JWKS not applicable.
      // Returns empty for spec compliance; upgrade to RS256 for real JWKS.
      return jsonResponse({ keys: [] });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (err) {
    console.error("[UIFE:OIDC-Issuer] Error:", err);
    return jsonResponse({ error: "server_error", error_description: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════
// HANDLERS
// ════════════════════════════════════════════════

interface IssueRequest {
  user_id: string;
  tenant_id: string;
  client_id: string;
  scopes?: string[];
  nonce?: string;
  session_id?: string;
}

async function handleIssue(db: any, body: IssueRequest) {
  const { user_id, tenant_id, client_id, scopes, nonce, session_id } = body;
  if (!user_id || !tenant_id || !client_id) {
    return jsonResponse({ error: "invalid_request", error_description: "user_id, tenant_id, client_id required" }, 400);
  }

  // Fetch user roles
  const { data: roleRows } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", user_id);
  const roles = (roleRows || []).map((r: any) => r.role);

  // Fetch tenant plan (from tenants table)
  const { data: tenant } = await db
    .from("tenants")
    .select("plan_tier, slug")
    .eq("id", tenant_id)
    .maybeSingle();
  const plan = tenant?.plan_tier ?? "free";

  const issuer = Deno.env.get("SUPABASE_URL")!;
  const grantedScopes = scopes || ["openid", "profile", "email"];

  // ── ID Token (short-lived, 1h) ──
  const idTokenClaims: Record<string, unknown> = {
    iss: issuer,
    sub: user_id,
    aud: client_id,
    tenant_id,
    roles,
    scopes: grantedScopes,
    plan,
    token_type: "id_token",
  };
  if (nonce) idTokenClaims.nonce = nonce;
  if (session_id) idTokenClaims.sid = session_id;
  if (tenant?.slug) idTokenClaims.tenant_slug = tenant.slug;

  const idToken = await signJWT(idTokenClaims, 3600);

  // ── Access Token (short-lived, 1h) ──
  const accessTokenClaims: Record<string, unknown> = {
    iss: issuer,
    sub: user_id,
    aud: issuer,
    tenant_id,
    roles,
    scopes: grantedScopes,
    plan,
    client_id,
    token_type: "access_token",
  };
  if (session_id) accessTokenClaims.sid = session_id;

  const accessToken = await signJWT(accessTokenClaims, 3600);

  // ── Refresh Token (opaque, 30 days) ──
  const refreshToken = generateOpaqueToken("oidc_rt");
  const rtHash = await sha256Hex(refreshToken);

  await db.from("oauth2_grants").insert({
    tenant_id,
    grant_type: "refresh_token",
    client_id,
    user_id,
    token_hash: rtHash,
    scope: grantedScopes.join(" "),
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  });

  // Audit
  await db.from("federation_audit_logs").insert({
    tenant_id,
    user_id,
    event_type: "oidc_token_validated",
    protocol: "oidc",
    success: true,
    details: { client_id, scopes: grantedScopes, roles, plan },
  });

  return jsonResponse({
    id_token: idToken,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: grantedScopes.join(" "),
  });
}

async function handleRefresh(db: any, body: any) {
  const { refresh_token, client_id } = body;
  if (!refresh_token || !client_id) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const rtHash = await sha256Hex(refresh_token);

  const { data: grant } = await db
    .from("oauth2_grants")
    .select("*")
    .eq("token_hash", rtHash)
    .eq("grant_type", "refresh_token")
    .eq("client_id", client_id)
    .eq("is_used", false)
    .is("revoked_at", null)
    .single();

  if (!grant) {
    return jsonResponse({ error: "invalid_grant", error_description: "Invalid refresh token" }, 400);
  }

  if (new Date(grant.expires_at) < new Date()) {
    await db.from("oauth2_grants").update({ is_used: true }).eq("id", grant.id);
    return jsonResponse({ error: "invalid_grant", error_description: "Refresh token expired" }, 400);
  }

  // Rotate
  await db.from("oauth2_grants").update({ is_used: true }).eq("id", grant.id);

  // Re-issue with fresh claims
  return await handleIssue(db, {
    user_id: grant.user_id,
    tenant_id: grant.tenant_id,
    client_id,
    scopes: grant.scope ? grant.scope.split(" ") : undefined,
  });
}

async function handleValidate(body: any) {
  const { token } = body;
  if (!token) {
    return jsonResponse({ active: false });
  }

  const claims = await verifyJWT(token);
  if (!claims) {
    return jsonResponse({ active: false });
  }

  return jsonResponse({
    active: true,
    sub: claims.sub,
    tenant_id: claims.tenant_id,
    roles: claims.roles,
    scopes: claims.scopes,
    plan: claims.plan,
    client_id: claims.client_id,
    token_type: claims.token_type,
    exp: claims.exp,
    iat: claims.iat,
  });
}

async function handleUserInfo(body: any) {
  const { access_token } = body;
  if (!access_token) {
    return jsonResponse({ error: "invalid_token" }, 401);
  }

  const claims = await verifyJWT(access_token);
  if (!claims || claims.token_type !== "access_token") {
    return jsonResponse({ error: "invalid_token" }, 401);
  }

  return jsonResponse({
    sub: claims.sub,
    tenant_id: claims.tenant_id,
    roles: claims.roles,
    scopes: claims.scopes,
    plan: claims.plan,
  });
}

function handleDiscovery() {
  const issuer = Deno.env.get("SUPABASE_URL")!;
  const fnBase = `${issuer}/functions/v1/oidc-token-issuer`;

  return jsonResponse({
    issuer,
    authorization_endpoint: `${issuer}/functions/v1/oauth2-token?action=token`,
    token_endpoint: `${fnBase}?action=issue`,
    userinfo_endpoint: `${fnBase}?action=userinfo`,
    jwks_uri: `${fnBase}?action=jwks`,
    revocation_endpoint: `${issuer}/functions/v1/oauth2-token?action=revoke`,
    introspection_endpoint: `${issuer}/functions/v1/oauth2-token?action=introspect`,
    scopes_supported: ["openid", "profile", "email", "api:read", "api:write", "admin"],
    response_types_supported: ["code", "id_token", "id_token token"],
    grant_types_supported: [
      "authorization_code",
      "refresh_token",
      "client_credentials",
      "urn:ietf:params:oauth:grant-type:device_code",
    ],
    id_token_signing_alg_values_supported: ["HS256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    claims_supported: ["sub", "tenant_id", "roles", "scopes", "plan", "iss", "aud", "exp", "iat", "nonce"],
    subject_types_supported: ["public"],
  });
}
