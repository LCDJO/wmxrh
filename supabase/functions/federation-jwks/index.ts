/**
 * UIFE — Federation JWKS & Token Service (Edge Function)
 *
 * Provides:
 *  - RS256 key pair generation & rotation
 *  - /.well-known/jwks.json — public JWK Set
 *  - /.auth/.well-known/openid-configuration — OIDC Discovery
 *  - JWT signing (ID + Access tokens) with rotating keys
 *  - JWT validation against active/rotated keys
 *  - Token issuance, refresh, revocation
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": status === 200 ? "public, max-age=300" : "no-store" },
  });
}

// ── RS256 Key helpers ────────────────────────────

async function generateKeyPair(): Promise<{ kid: string; publicJwk: JsonWebKey; privateJwk: JsonWebKey }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  // Generate kid from public key thumbprint
  const thumbprintData = JSON.stringify({ e: publicJwk.e, kty: publicJwk.kty, n: publicJwk.n });
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(thumbprintData));
  const kid = base64url(new Uint8Array(hash)).slice(0, 16);

  return { kid, publicJwk, privateJwk };
}

async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}

// ── JWT helpers ──────────────────────────────────

function base64url(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlStr(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function signJWT(payload: Record<string, unknown>, privateKey: CryptoKey, kid: string, expiresInSec: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid };
  const claims = { ...payload, iat: now, exp: now + expiresInSec, nbf: now };

  const headerB64 = base64urlStr(JSON.stringify(header));
  const payloadB64 = base64urlStr(JSON.stringify(claims));
  const sigInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, sigInput);

  return `${headerB64}.${payloadB64}.${base64url(new Uint8Array(sig))}`;
}

async function verifyJWT(token: string, publicKeys: Array<{ kid: string; key: CryptoKey }>): Promise<Record<string, unknown> | null> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) return null;

    const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64)));
    const targetKid = header.kid;

    const keyEntry = publicKeys.find((k) => k.kid === targetKid);
    if (!keyEntry) return null;

    const sigInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig = base64urlDecode(sigB64);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", keyEntry.key, sig, sigInput);
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
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

// ── Key management ───────────────────────────────

const KEY_ROTATION_DAYS = 30;

async function getOrCreateActiveKey(db: any): Promise<{ kid: string; privateKey: CryptoKey; publicJwk: JsonWebKey }> {
  // Get active key
  const { data: activeKeys } = await db
    .from("federation_signing_keys")
    .select("*")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (activeKeys && activeKeys.length > 0) {
    const k = activeKeys[0];
    const privateKey = await importPrivateKey(k.private_key_jwk);
    return { kid: k.kid, privateKey, publicJwk: k.public_key_jwk };
  }

  // Rotate: mark old active keys as rotated
  await db
    .from("federation_signing_keys")
    .update({ status: "rotated", rotated_at: new Date().toISOString() })
    .eq("status", "active");

  // Generate new key pair
  const { kid, publicJwk, privateJwk } = await generateKeyPair();
  const expiresAt = new Date(Date.now() + KEY_ROTATION_DAYS * 24 * 3600 * 1000).toISOString();

  await db.from("federation_signing_keys").insert({
    kid,
    algorithm: "RS256",
    public_key_jwk: publicJwk,
    private_key_jwk: privateJwk,
    status: "active",
    expires_at: expiresAt,
  });

  const privateKey = await importPrivateKey(privateJwk);
  return { kid, privateKey, publicJwk };
}

async function getVerificationKeys(db: any): Promise<Array<{ kid: string; key: CryptoKey }>> {
  // Include active + recently rotated keys for validation grace period
  const { data: keys } = await db
    .from("federation_signing_keys")
    .select("kid, public_key_jwk, status")
    .in("status", ["active", "rotated"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (!keys || keys.length === 0) return [];

  const result: Array<{ kid: string; key: CryptoKey }> = [];
  for (const k of keys) {
    try {
      const key = await importPublicKey(k.public_key_jwk);
      result.push({ kid: k.kid, key });
    } catch {
      console.warn(`[UIFE:JWKS] Failed to import key ${k.kid}`);
    }
  }
  return result;
}

// ── Main handler ─────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? req.headers.get("x-action") ?? "";

  try {
    // ── JWKS endpoint (GET) ──────────────────────
    if (action === "jwks" || url.pathname.endsWith("/jwks.json")) {
      const { data: keys } = await db
        .from("federation_signing_keys")
        .select("kid, public_key_jwk, algorithm, status")
        .in("status", ["active", "rotated"])
        .order("created_at", { ascending: false })
        .limit(5);

      const jwks = (keys || []).map((k: any) => ({
        ...k.public_key_jwk,
        kid: k.kid,
        alg: k.algorithm,
        use: "sig",
        key_ops: ["verify"],
      }));

      return jsonRes({ keys: jwks });
    }

    // ── Discovery endpoint (GET) ─────────────────
    if (action === "discovery" || url.pathname.includes("openid-configuration")) {
      const issuer = Deno.env.get("SUPABASE_URL")!;
      const fnBase = `${issuer}/functions/v1/federation-jwks`;

      return jsonRes({
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
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
        claims_supported: ["sub", "tenant_id", "roles", "scopes", "plan", "iss", "aud", "exp", "iat", "nonce", "sid"],
        subject_types_supported: ["public"],
      });
    }

    // ── Rotate keys (POST, admin) ────────────────
    if (action === "rotate" && req.method === "POST") {
      await db
        .from("federation_signing_keys")
        .update({ status: "rotated", rotated_at: new Date().toISOString() })
        .eq("status", "active");

      const { kid } = await getOrCreateActiveKey(db);
      return jsonRes({ rotated: true, new_kid: kid });
    }

    // POST-only actions below
    if (req.method !== "POST") {
      return jsonRes({ error: "method_not_allowed" }, 405);
    }

    const body = await req.json().catch(() => ({}));

    // ── Issue tokens ─────────────────────────────
    if (action === "issue") {
      return await handleIssue(db, body);
    }

    // ── Refresh tokens ───────────────────────────
    if (action === "refresh") {
      return await handleRefresh(db, body);
    }

    // ── Validate token ───────────────────────────
    if (action === "validate") {
      return await handleValidate(db, body);
    }

    // ── UserInfo ─────────────────────────────────
    if (action === "userinfo") {
      return await handleUserInfo(db, body);
    }

    // ── Revoke session tokens ────────────────────
    if (action === "revoke_session") {
      return await handleRevokeSession(db, body);
    }

    return jsonRes({ error: "unknown_action" }, 400);
  } catch (err) {
    console.error("[UIFE:JWKS] Error:", err);
    return jsonRes({ error: "server_error", error_description: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════
// HANDLERS
// ════════════════════════════════════════════════

async function handleIssue(db: any, body: any) {
  const { user_id, tenant_id, client_id, scopes, nonce, session_id } = body;
  if (!user_id || !tenant_id) {
    return jsonRes({ error: "invalid_request", error_description: "user_id and tenant_id required" }, 400);
  }

  const activeKey = await getOrCreateActiveKey(db);

  // Fetch roles
  const { data: roleRows } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", user_id);
  const roles = (roleRows || []).map((r: any) => r.role);

  // Fetch tenant plan
  const { data: tenant } = await db
    .from("tenants")
    .select("plan_tier, slug")
    .eq("id", tenant_id)
    .maybeSingle();
  const plan = tenant?.plan_tier ?? "free";

  const issuer = Deno.env.get("SUPABASE_URL")!;
  const grantedScopes = scopes || ["openid", "profile", "email"];
  const aud = client_id || issuer;

  // ID Token
  const idClaims: Record<string, unknown> = {
    iss: issuer, sub: user_id, aud, tenant_id, roles, scopes: grantedScopes, plan, token_type: "id_token",
  };
  if (nonce) idClaims.nonce = nonce;
  if (session_id) idClaims.sid = session_id;
  if (tenant?.slug) idClaims.tenant_slug = tenant.slug;
  const idToken = await signJWT(idClaims, activeKey.privateKey, activeKey.kid, 3600);

  // Access Token
  const atClaims: Record<string, unknown> = {
    iss: issuer, sub: user_id, aud: issuer, tenant_id, roles, scopes: grantedScopes, plan, client_id: aud, token_type: "access_token",
  };
  if (session_id) atClaims.sid = session_id;
  const accessToken = await signJWT(atClaims, activeKey.privateKey, activeKey.kid, 3600);

  // Refresh Token (opaque)
  const refreshToken = generateOpaqueToken("oidc_rt");
  const rtHash = await sha256Hex(refreshToken);

  await db.from("oauth2_grants").insert({
    tenant_id, grant_type: "refresh_token", client_id: aud, user_id,
    token_hash: rtHash, scope: grantedScopes.join(" "),
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  });

  // Audit
  await db.from("federation_audit_logs").insert({
    tenant_id, user_id, event_type: "oidc_token_validated", protocol: "oidc", success: true,
    details: { client_id: aud, scopes: grantedScopes, roles, plan, kid: activeKey.kid },
  });

  return jsonRes({
    id_token: idToken, access_token: accessToken, refresh_token: refreshToken,
    token_type: "Bearer", expires_in: 3600, scope: grantedScopes.join(" "),
  });
}

async function handleRefresh(db: any, body: any) {
  const { refresh_token, client_id } = body;
  if (!refresh_token || !client_id) {
    return jsonRes({ error: "invalid_request" }, 400);
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

  if (!grant) return jsonRes({ error: "invalid_grant" }, 400);
  if (new Date(grant.expires_at) < new Date()) {
    await db.from("oauth2_grants").update({ is_used: true }).eq("id", grant.id);
    return jsonRes({ error: "invalid_grant", error_description: "Refresh token expired" }, 400);
  }

  // Rotate
  await db.from("oauth2_grants").update({ is_used: true }).eq("id", grant.id);

  return await handleIssue(db, {
    user_id: grant.user_id, tenant_id: grant.tenant_id, client_id,
    scopes: grant.scope ? grant.scope.split(" ") : undefined,
  });
}

async function handleValidate(db: any, body: any) {
  const { token } = body;
  if (!token) return jsonRes({ active: false });

  const keys = await getVerificationKeys(db);
  if (keys.length === 0) return jsonRes({ active: false });

  const claims = await verifyJWT(token, keys);
  if (!claims) return jsonRes({ active: false });

  return jsonRes({
    active: true, sub: claims.sub, tenant_id: claims.tenant_id,
    roles: claims.roles, scopes: claims.scopes, plan: claims.plan,
    client_id: claims.client_id, token_type: claims.token_type,
    exp: claims.exp, iat: claims.iat, kid: claims.kid,
  });
}

async function handleUserInfo(db: any, body: any) {
  const { access_token } = body;
  if (!access_token) return jsonRes({ error: "invalid_token" }, 401);

  const keys = await getVerificationKeys(db);
  const claims = await verifyJWT(access_token, keys);
  if (!claims || claims.token_type !== "access_token") {
    return jsonRes({ error: "invalid_token" }, 401);
  }

  return jsonRes({
    sub: claims.sub, tenant_id: claims.tenant_id,
    roles: claims.roles, scopes: claims.scopes, plan: claims.plan,
  });
}

async function handleRevokeSession(db: any, body: any) {
  const { session_id, tenant_id } = body;
  if (!session_id) return jsonRes({ error: "invalid_request" }, 400);

  // Revoke all refresh tokens for the session (access tokens are stateless JWTs)
  const { data } = await db
    .from("oauth2_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("grant_type", "refresh_token")
    .is("revoked_at", null)
    .select("id");

  await db.from("federation_audit_logs").insert({
    tenant_id: tenant_id || null,
    event_type: "session_revoked",
    success: true,
    details: { session_id, revoked_grants: data?.length ?? 0 },
  });

  return jsonRes({ revoked: data?.length ?? 0 });
}
