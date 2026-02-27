/**
 * DevPortal OAuth2 + OIDC Integration Edge Function
 *
 * Handles OAuth2 flows for developer portal apps:
 *  - Authorization Code Flow (+ PKCE)
 *  - Client Credentials Flow
 *  - Token Refresh
 *  - App Token Introspection
 *  - OIDC UserInfo for app-scoped tokens
 *
 * All tokens are tenant-scoped and app-scoped.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-action, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(error: string, description: string, status = 400) {
  return json({ error, error_description: description }, status);
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

function generateToken(prefix: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    ""
  );
  return `${prefix}_${hex}`;
}

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createJwtPayload(claims: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify(claims));
  // Signature is HMAC-SHA256 — computed below
  return `${header}.${payload}`;
}

async function signJwt(
  claims: Record<string, unknown>,
  secret: string
): Promise<string> {
  const unsigned = createJwtPayload(claims);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(unsigned)
  );
  const signature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(sig))
  );
  return `${unsigned}.${signature}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const jwtSecret =
    Deno.env.get("DEVPORTAL_JWT_SECRET") || Deno.env.get("JWT_SECRET") || serviceKey.substring(0, 64);

  const admin = createClient(supabaseUrl, serviceKey);

  const action = req.headers.get("x-action") || "token";

  try {
    const body = await req.json().catch(() => ({}));

    switch (action) {
      // ══════════════════════════════════════════
      // CLIENT CREDENTIALS FLOW
      // ══════════════════════════════════════════
      case "client_credentials": {
        const { client_id, client_secret, scope } = body;
        if (!client_id || !client_secret)
          return errorResponse(
            "invalid_request",
            "client_id and client_secret required"
          );

        // Hash and lookup
        const clientIdHash = await sha256Hex(client_id);
        const clientSecretHash = await sha256Hex(client_secret);

        const { data: oauthClient, error: lookupErr } = await admin
          .from("oauth_clients")
          .select("*, developer_apps!inner(id, developer_id, name, status, required_scopes)")
          .eq("client_id_hash", clientIdHash)
          .eq("client_secret_hash", clientSecretHash)
          .eq("status", "active")
          .single();

        if (lookupErr || !oauthClient)
          return errorResponse("invalid_client", "Invalid credentials", 401);

        const app = (oauthClient as any).developer_apps;
        if (app.status !== "published" && app.status !== "approved")
          return errorResponse("invalid_client", "App not published");

        // Validate scopes
        const requestedScopes = scope
          ? (scope as string).split(" ")
          : app.required_scopes || [];
        const allowedScopes = oauthClient.scopes || [];
        const grantedScopes = requestedScopes.filter(
          (s: string) =>
            allowedScopes.includes(s) || allowedScopes.includes("*")
        );

        const now = Math.floor(Date.now() / 1000);
        const expiresIn = oauthClient.token_lifetime_seconds || 3600;

        const accessToken = await signJwt(
          {
            iss: `${supabaseUrl}/devportal`,
            sub: `app:${app.id}`,
            aud: "platform-api",
            iat: now,
            exp: now + expiresIn,
            scope: grantedScopes.join(" "),
            client_id: client_id,
            developer_id: app.developer_id,
            app_id: app.id,
            app_name: app.name,
            grant_type: "client_credentials",
          },
          jwtSecret
        );

        // Update last_used
        await admin
          .from("oauth_clients")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", oauthClient.id);

        return json({
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: expiresIn,
          scope: grantedScopes.join(" "),
        });
      }

      // ══════════════════════════════════════════
      // AUTHORIZATION CODE EXCHANGE
      // ══════════════════════════════════════════
      case "authorization_code": {
        const {
          code,
          client_id,
          client_secret,
          redirect_uri,
          code_verifier,
        } = body;
        if (!code || !client_id)
          return errorResponse(
            "invalid_request",
            "code and client_id required"
          );

        // Lookup the authorization code grant
        const codeHash = await sha256Hex(code);
        const { data: grant, error: grantErr } = await admin
          .from("oauth2_grants")
          .select("*")
          .eq("code_hash", codeHash)
          .eq("is_used", false)
          .single();

        if (grantErr || !grant)
          return errorResponse("invalid_grant", "Invalid or expired code");

        // Validate client
        if (grant.client_id !== client_id)
          return errorResponse("invalid_grant", "Client ID mismatch");

        // Validate redirect_uri
        if (redirect_uri && grant.redirect_uri !== redirect_uri)
          return errorResponse("invalid_grant", "Redirect URI mismatch");

        // PKCE verification
        if (grant.code_challenge) {
          if (!code_verifier)
            return errorResponse("invalid_grant", "code_verifier required");
          const verifierHash = await sha256Hex(code_verifier);
          const expectedChallenge = base64UrlEncode(
            String.fromCharCode(
              ...new Uint8Array(
                await crypto.subtle.digest(
                  "SHA-256",
                  new TextEncoder().encode(code_verifier)
                )
              )
            )
          );
          if (
            expectedChallenge !== grant.code_challenge &&
            verifierHash !== grant.code_challenge
          )
            return errorResponse(
              "invalid_grant",
              "PKCE verification failed"
            );
        }

        // Mark code as used
        await admin
          .from("oauth2_grants")
          .update({ is_used: true })
          .eq("id", grant.id);

        // Lookup app
        const { data: oauthClient } = await admin
          .from("oauth_clients")
          .select("*, developer_apps!inner(id, developer_id, name)")
          .eq("client_id_hash", await sha256Hex(client_id))
          .eq("status", "active")
          .single();

        const app = (oauthClient as any)?.developer_apps;
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = oauthClient?.token_lifetime_seconds || 3600;
        const refreshExpiresIn =
          oauthClient?.refresh_token_lifetime_seconds || 2592000;

        const scopes = grant.scope ? grant.scope.split(" ") : [];

        // Issue tokens
        const accessToken = await signJwt(
          {
            iss: `${supabaseUrl}/devportal`,
            sub: grant.user_id,
            aud: "platform-api",
            iat: now,
            exp: now + expiresIn,
            scope: scopes.join(" "),
            client_id,
            app_id: app?.id,
            developer_id: app?.developer_id,
            tenant_id: grant.tenant_id,
            grant_type: "authorization_code",
          },
          jwtSecret
        );

        const idToken = await signJwt(
          {
            iss: `${supabaseUrl}/devportal`,
            sub: grant.user_id,
            aud: client_id,
            iat: now,
            exp: now + expiresIn,
            nonce: grant.nonce,
            tenant_id: grant.tenant_id,
          },
          jwtSecret
        );

        const refreshToken = generateToken("dpr");

        // Store refresh token
        await admin.from("oauth2_grants").insert({
          code_hash: await sha256Hex(refreshToken),
          client_id,
          user_id: grant.user_id,
          tenant_id: grant.tenant_id,
          scope: scopes.join(" "),
          grant_type: "refresh_token",
          is_used: false,
          expires_at: new Date(
            Date.now() + refreshExpiresIn * 1000
          ).toISOString(),
        });

        return json({
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: expiresIn,
          refresh_token: refreshToken,
          id_token: idToken,
          scope: scopes.join(" "),
        });
      }

      // ══════════════════════════════════════════
      // REFRESH TOKEN
      // ══════════════════════════════════════════
      case "refresh_token": {
        const { refresh_token, client_id: rt_client_id } = body;
        if (!refresh_token || !rt_client_id)
          return errorResponse(
            "invalid_request",
            "refresh_token and client_id required"
          );

        const rtHash = await sha256Hex(refresh_token);
        const { data: rtGrant, error: rtErr } = await admin
          .from("oauth2_grants")
          .select("*")
          .eq("code_hash", rtHash)
          .eq("grant_type", "refresh_token")
          .eq("is_used", false)
          .single();

        if (rtErr || !rtGrant)
          return errorResponse("invalid_grant", "Invalid refresh token");

        // Rotate: invalidate old, issue new
        await admin
          .from("oauth2_grants")
          .update({ is_used: true })
          .eq("id", rtGrant.id);

        const now = Math.floor(Date.now() / 1000);
        const newAccessToken = await signJwt(
          {
            iss: `${supabaseUrl}/devportal`,
            sub: rtGrant.user_id,
            aud: "platform-api",
            iat: now,
            exp: now + 3600,
            scope: rtGrant.scope || "",
            client_id: rt_client_id,
            tenant_id: rtGrant.tenant_id,
            grant_type: "refresh_token",
          },
          jwtSecret
        );

        const newRefreshToken = generateToken("dpr");
        await admin.from("oauth2_grants").insert({
          code_hash: await sha256Hex(newRefreshToken),
          client_id: rt_client_id,
          user_id: rtGrant.user_id,
          tenant_id: rtGrant.tenant_id,
          scope: rtGrant.scope,
          grant_type: "refresh_token",
          is_used: false,
          expires_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        });

        return json({
          access_token: newAccessToken,
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: newRefreshToken,
          scope: rtGrant.scope || "",
        });
      }

      // ══════════════════════════════════════════
      // TOKEN INTROSPECTION (RFC 7662)
      // ══════════════════════════════════════════
      case "introspect": {
        const { token } = body;
        if (!token)
          return errorResponse("invalid_request", "token required");

        try {
          const parts = token.split(".");
          if (parts.length !== 3) return json({ active: false });

          const payload = JSON.parse(
            atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
          );
          const now = Math.floor(Date.now() / 1000);

          if (payload.exp && payload.exp < now) return json({ active: false });

          return json({
            active: true,
            sub: payload.sub,
            client_id: payload.client_id,
            scope: payload.scope,
            app_id: payload.app_id,
            tenant_id: payload.tenant_id,
            grant_type: payload.grant_type,
            exp: payload.exp,
            iat: payload.iat,
            iss: payload.iss,
            token_type: "Bearer",
          });
        } catch {
          return json({ active: false });
        }
      }

      // ══════════════════════════════════════════
      // OIDC USERINFO
      // ══════════════════════════════════════════
      case "userinfo": {
        const authHeader = req.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer "))
          return errorResponse("invalid_token", "Bearer token required", 401);

        const accessToken = authHeader.replace("Bearer ", "");
        try {
          const parts = accessToken.split(".");
          if (parts.length !== 3)
            return errorResponse("invalid_token", "Malformed token", 401);

          const payload = JSON.parse(
            atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
          );
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < now)
            return errorResponse("invalid_token", "Token expired", 401);

          // Fetch user profile if user-scoped
          const userId = payload.sub;
          if (userId && !userId.startsWith("app:")) {
            const { data: user } = await admin.auth.admin.getUserById(userId);
            return json({
              sub: userId,
              email: user?.user?.email,
              email_verified: user?.user?.email_confirmed_at != null,
              tenant_id: payload.tenant_id,
              scope: payload.scope,
              updated_at: user?.user?.updated_at,
            });
          }

          // App-scoped token
          return json({
            sub: userId,
            app_id: payload.app_id,
            scope: payload.scope,
            tenant_id: payload.tenant_id,
          });
        } catch {
          return errorResponse("invalid_token", "Token decode failed", 401);
        }
      }

      // ══════════════════════════════════════════
      // OIDC DISCOVERY
      // ══════════════════════════════════════════
      case "discovery": {
        const baseUrl = `${supabaseUrl}/functions/v1/devportal-oauth`;
        return json({
          issuer: `${supabaseUrl}/devportal`,
          authorization_endpoint: `${baseUrl}?x-action=authorize`,
          token_endpoint: baseUrl,
          userinfo_endpoint: `${baseUrl}?x-action=userinfo`,
          introspection_endpoint: `${baseUrl}?x-action=introspect`,
          revocation_endpoint: `${baseUrl}?x-action=revoke`,
          jwks_uri: `${supabaseUrl}/functions/v1/federation-jwks`,
          scopes_supported: [
            "openid",
            "profile",
            "email",
            "hr.employee.read",
            "billing.invoice.read",
            "landing.publish",
          ],
          response_types_supported: ["code"],
          grant_types_supported: [
            "authorization_code",
            "client_credentials",
            "refresh_token",
          ],
          token_endpoint_auth_methods_supported: [
            "client_secret_post",
            "client_secret_basic",
          ],
          code_challenge_methods_supported: ["S256"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["HS256"],
        });
      }

      // ══════════════════════════════════════════
      // REVOKE
      // ══════════════════════════════════════════
      case "revoke": {
        const { token: revokeToken, token_type_hint } = body;
        if (!revokeToken)
          return errorResponse("invalid_request", "token required");

        if (token_type_hint === "refresh_token" || revokeToken.startsWith("dpr_")) {
          const hash = await sha256Hex(revokeToken);
          await admin
            .from("oauth2_grants")
            .update({ is_used: true })
            .eq("code_hash", hash)
            .eq("grant_type", "refresh_token");
        }

        // Access tokens are stateless JWTs — cannot be revoked server-side
        // In production, add to a denylist with TTL
        return json({ revoked: true });
      }

      default:
        return errorResponse("unsupported_action", `Unknown action: ${action}`);
    }
  } catch (err) {
    console.error("[devportal-oauth] Error:", err);
    return errorResponse("server_error", (err as Error).message, 500);
  }
});
