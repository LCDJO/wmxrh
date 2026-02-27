/**
 * UIFE — OAuth2 Token Endpoint (Edge Function)
 *
 * Server-side handler for:
 *  - Authorization Code exchange (+ PKCE)
 *  - Client Credentials grant
 *  - Refresh Token grant
 *  - Token Revocation (RFC 7009)
 *  - Token Introspection (RFC 7662)
 *  - Device Authorization (RFC 8628) — future-ready
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Base64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateToken(prefix = "uife"): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function generateUserCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
    if (i === 3) code += "-";
  }
  return code;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? req.headers.get("x-action") ?? "token";

  try {
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const body = await req.json().catch(() => ({}));

    // ─── CREATE CODE (internal — stores auth code) ─
    if (action === "create_code") {
      const { code_hash, tenant_id, user_id, client_id: cId, redirect_uri: rUri, scope: s, code_challenge: cc, code_challenge_method: ccm } = body;
      if (!code_hash || !tenant_id || !cId) {
        return json({ error: "invalid_request" }, 400);
      }
      await supabaseAdmin.from("oauth2_grants").insert({
        tenant_id,
        grant_type: "authorization_code",
        client_id: cId,
        user_id: user_id || null,
        code_hash,
        redirect_uri: rUri || null,
        scope: s || "",
        code_challenge: cc || null,
        code_challenge_method: ccm || null,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
      });
      return json({ success: true });
    }

    // ─── TOKEN ENDPOINT ──────────────────────────
    if (action === "token") {
      const { grant_type } = body;

      // ── Authorization Code ──
      if (grant_type === "authorization_code") {
        return await handleAuthorizationCode(supabaseAdmin, body);
      }

      // ── Client Credentials ──
      if (grant_type === "client_credentials") {
        return await handleClientCredentials(supabaseAdmin, body);
      }

      // ── Refresh Token ──
      if (grant_type === "refresh_token") {
        return await handleRefreshToken(supabaseAdmin, body);
      }

      // ── Device Code (RFC 8628) ──
      if (grant_type === "urn:ietf:params:oauth:grant-type:device_code") {
        return await handleDeviceToken(supabaseAdmin, body);
      }

      return json({ error: "unsupported_grant_type" }, 400);
    }

    // ─── DEVICE AUTHORIZATION ────────────────────
    if (action === "device_authorize") {
      return await handleDeviceAuthorize(supabaseAdmin, body);
    }

    // ─── REVOCATION (RFC 7009) ───────────────────
    if (action === "revoke") {
      return await handleRevoke(supabaseAdmin, body);
    }

    // ─── INTROSPECTION (RFC 7662) ────────────────
    if (action === "introspect") {
      return await handleIntrospect(supabaseAdmin, body);
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    console.error("[UIFE:OAuth2] Error:", err);
    return json({ error: "server_error", error_description: String(err) }, 500);
  }
});

// ════════════════════════════════════════════════
// GRANT HANDLERS
// ════════════════════════════════════════════════

async function handleAuthorizationCode(db: any, body: any) {
  const { code, redirect_uri, client_id, code_verifier } = body;
  if (!code || !client_id) {
    return json({ error: "invalid_request", error_description: "code and client_id required" }, 400);
  }

  const codeHash = await sha256Hex(code);

  // Look up grant
  const { data: grant, error } = await db
    .from("oauth2_grants")
    .select("*")
    .eq("code_hash", codeHash)
    .eq("grant_type", "authorization_code")
    .eq("is_used", false)
    .is("revoked_at", null)
    .single();

  if (error || !grant) {
    return json({ error: "invalid_grant", error_description: "Invalid or expired authorization code" }, 400);
  }

  // Check expiry
  if (new Date(grant.expires_at) < new Date()) {
    await db.from("oauth2_grants").update({ is_used: true }).eq("id", grant.id);
    return json({ error: "invalid_grant", error_description: "Authorization code expired" }, 400);
  }

  // Validate client_id
  if (grant.client_id !== client_id) {
    return json({ error: "invalid_client", error_description: "Client ID mismatch" }, 400);
  }

  // Validate redirect_uri
  if (grant.redirect_uri && grant.redirect_uri !== redirect_uri) {
    return json({ error: "invalid_grant", error_description: "Redirect URI mismatch" }, 400);
  }

  // PKCE verification
  if (grant.code_challenge) {
    if (!code_verifier) {
      return json({ error: "invalid_grant", error_description: "code_verifier required" }, 400);
    }
    const method = grant.code_challenge_method || "S256";
    let computed: string;
    if (method === "S256") {
      computed = await sha256Base64url(code_verifier);
    } else {
      computed = code_verifier; // plain
    }
    if (computed !== grant.code_challenge) {
      return json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
    }
  }

  // Mark code as used
  await db.from("oauth2_grants").update({ is_used: true }).eq("id", grant.id);

  // Issue tokens
  const accessToken = generateToken("at");
  const refreshToken = generateToken("rt");

  // Store refresh token grant
  const rtHash = await sha256Hex(refreshToken);
  await db.from("oauth2_grants").insert({
    tenant_id: grant.tenant_id,
    grant_type: "refresh_token",
    client_id,
    user_id: grant.user_id,
    token_hash: rtHash,
    scope: grant.scope,
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), // 30 days
  });

  // Audit
  await db.from("federation_audit_logs").insert({
    tenant_id: grant.tenant_id,
    user_id: grant.user_id,
    event_type: "oauth_token_exchanged",
    success: true,
    details: { grant_type: "authorization_code", client_id, scope: grant.scope },
  });

  return json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: grant.scope,
  });
}

async function handleClientCredentials(db: any, body: any) {
  const { client_id, client_secret, scope } = body;
  if (!client_id || !client_secret) {
    return json({ error: "invalid_client", error_description: "client_id and client_secret required" }, 400);
  }

  // Validate against api_keys table
  const secretHash = await sha256Hex(client_secret);
  const { data: apiKey } = await db
    .from("api_keys")
    .select("*, api_clients!inner(*)")
    .eq("key_hash", secretHash)
    .eq("api_clients.status", "active")
    .maybeSingle();

  if (!apiKey) {
    return json({ error: "invalid_client", error_description: "Invalid client credentials" }, 401);
  }

  // Check key expiry
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return json({ error: "invalid_client", error_description: "Client credentials expired" }, 401);
  }

  // Validate requested scopes against allowed scopes
  const requestedScopes = (scope || "").split(" ").filter(Boolean);
  const allowedScopes = apiKey.scopes || [];
  const grantedScopes = requestedScopes.length > 0
    ? requestedScopes.filter((s: string) => allowedScopes.includes(s))
    : allowedScopes;

  const accessToken = generateToken("cc");

  await db.from("federation_audit_logs").insert({
    tenant_id: apiKey.api_clients.tenant_id,
    event_type: "oauth_token_exchanged",
    success: true,
    details: { grant_type: "client_credentials", client_id, scope: grantedScopes.join(" ") },
  });

  return json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: grantedScopes.join(" "),
  });
}

async function handleRefreshToken(db: any, body: any) {
  const { refresh_token, client_id, scope } = body;
  if (!refresh_token || !client_id) {
    return json({ error: "invalid_request", error_description: "refresh_token and client_id required" }, 400);
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
    return json({ error: "invalid_grant", error_description: "Invalid refresh token" }, 400);
  }

  if (new Date(grant.expires_at) < new Date()) {
    await db.from("oauth2_grants").update({ is_used: true }).eq("id", grant.id);
    return json({ error: "invalid_grant", error_description: "Refresh token expired" }, 400);
  }

  // Rotate: mark old RT as used
  await db.from("oauth2_grants").update({ is_used: true }).eq("id", grant.id);

  // Issue new tokens
  const newAccessToken = generateToken("at");
  const newRefreshToken = generateToken("rt");
  const newRtHash = await sha256Hex(newRefreshToken);

  // Determine scope (can't widen, only narrow)
  const originalScopes = (grant.scope || "").split(" ").filter(Boolean);
  const requestedScopes = scope ? scope.split(" ").filter(Boolean) : originalScopes;
  const grantedScopes = requestedScopes.filter((s: string) => originalScopes.includes(s));

  await db.from("oauth2_grants").insert({
    tenant_id: grant.tenant_id,
    grant_type: "refresh_token",
    client_id,
    user_id: grant.user_id,
    token_hash: newRtHash,
    scope: grantedScopes.join(" "),
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  });

  return json({
    access_token: newAccessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: newRefreshToken,
    scope: grantedScopes.join(" "),
  });
}

// ════════════════════════════════════════════════
// DEVICE FLOW (RFC 8628)
// ════════════════════════════════════════════════

async function handleDeviceAuthorize(db: any, body: any) {
  const { client_id, scope, tenant_id } = body;
  if (!client_id || !tenant_id) {
    return json({ error: "invalid_request", error_description: "client_id and tenant_id required" }, 400);
  }

  const deviceCode = generateToken("dc");
  const userCode = generateUserCode();
  const deviceCodeHash = await sha256Hex(deviceCode);
  const verificationUri = `${Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "")}/device`;

  await db.from("oauth2_grants").insert({
    tenant_id,
    grant_type: "device_code",
    client_id,
    device_code_hash: deviceCodeHash,
    user_code: userCode,
    verification_uri: verificationUri,
    device_status: "authorization_pending",
    scope: scope || "",
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
  });

  return json({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?user_code=${userCode}`,
    expires_in: 900,
    interval: 5,
  });
}

async function handleDeviceToken(db: any, body: any) {
  const { device_code, client_id } = body;
  if (!device_code || !client_id) {
    return json({ error: "invalid_request" }, 400);
  }

  const dcHash = await sha256Hex(device_code);

  const { data: grant } = await db
    .from("oauth2_grants")
    .select("*")
    .eq("device_code_hash", dcHash)
    .eq("grant_type", "device_code")
    .eq("client_id", client_id)
    .is("revoked_at", null)
    .single();

  if (!grant) {
    return json({ error: "invalid_grant" }, 400);
  }

  if (new Date(grant.expires_at) < new Date()) {
    return json({ error: "expired_token" }, 400);
  }

  if (grant.device_status === "authorization_pending") {
    return json({ error: "authorization_pending" }, 400);
  }

  if (grant.device_status === "denied") {
    await db.from("oauth2_grants").update({ is_used: true }).eq("id", grant.id);
    return json({ error: "access_denied" }, 400);
  }

  if (grant.device_status === "approved") {
    await db.from("oauth2_grants").update({ is_used: true }).eq("id", grant.id);

    const accessToken = generateToken("at");
    const refreshToken = generateToken("rt");
    const rtHash = await sha256Hex(refreshToken);

    await db.from("oauth2_grants").insert({
      tenant_id: grant.tenant_id,
      grant_type: "refresh_token",
      client_id,
      user_id: grant.user_id,
      token_hash: rtHash,
      scope: grant.scope,
      expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    });

    return json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: grant.scope,
    });
  }

  return json({ error: "server_error" }, 500);
}

// ════════════════════════════════════════════════
// REVOCATION & INTROSPECTION
// ════════════════════════════════════════════════

async function handleRevoke(db: any, body: any) {
  const { token, token_type_hint } = body;
  if (!token) {
    return json({ error: "invalid_request" }, 400);
  }

  const tokenHash = await sha256Hex(token);

  // Try refresh token first (or based on hint)
  if (!token_type_hint || token_type_hint === "refresh_token") {
    const { data } = await db
      .from("oauth2_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", tokenHash)
      .eq("grant_type", "refresh_token")
      .is("revoked_at", null)
      .select("id, tenant_id");

    if (data?.length) {
      await db.from("federation_audit_logs").insert({
        tenant_id: data[0].tenant_id,
        event_type: "oauth_token_revoked",
        success: true,
        details: { token_type: "refresh_token" },
      });
    }
  }

  // RFC 7009: always return 200 regardless of whether token was found
  return json({});
}

async function handleIntrospect(db: any, body: any) {
  const { token } = body;
  if (!token) {
    return json({ active: false });
  }

  const tokenHash = await sha256Hex(token);

  // Check refresh tokens
  const { data: grant } = await db
    .from("oauth2_grants")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("is_used", false)
    .is("revoked_at", null)
    .maybeSingle();

  if (!grant || new Date(grant.expires_at) < new Date()) {
    return json({ active: false });
  }

  return json({
    active: true,
    scope: grant.scope,
    client_id: grant.client_id,
    sub: grant.user_id,
    token_type: grant.grant_type === "refresh_token" ? "refresh_token" : "access_token",
    exp: Math.floor(new Date(grant.expires_at).getTime() / 1000),
    iat: Math.floor(new Date(grant.created_at).getTime() / 1000),
  });
}
