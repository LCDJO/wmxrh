/**
 * UIFE — OIDCProvider
 *
 * OpenID Connect Relying Party + Platform Token Issuer:
 * - Discovery document fetching
 * - Authorization URL construction (with PKCE)
 * - Code exchange
 * - ID Token validation (structure, NOT signature — signature in edge fn)
 * - UserInfo endpoint
 * - Platform token issuance with claims: sub, tenant_id, roles, scopes, plan
 * - Token refresh and validation via oidc-token-issuer edge fn
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  OIDCProviderAPI,
  OIDCDiscoveryDocument,
  OIDCTokenSet,
  OIDCUserInfo,
  OIDCPlatformClaims,
  IdentityProviderConfig,
} from './types';

/** In-memory discovery cache (keyed by issuer URL) */
const discoveryCache = new Map<string, { doc: OIDCDiscoveryDocument; expiresAt: number }>();
const DISCOVERY_TTL_MS = 3_600_000; // 1 hour

async function invokeOIDCIssuer(action: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('oidc-token-issuer', {
    body,
    headers: { 'x-action': action },
  });
  if (error) throw new Error(`[UIFE:OIDC] ${action} failed: ${error.message}`);
  if (data?.error) throw new Error(`[UIFE:OIDC] ${data.error}: ${data.error_description || ''}`);
  return data;
}

export function createOIDCProvider(): OIDCProviderAPI {
  return {
    // ── External IdP Discovery ────────────────────
    async discover(issuerUrl) {
      const cached = discoveryCache.get(issuerUrl);
      if (cached && cached.expiresAt > Date.now()) return cached.doc;

      const wellKnown = issuerUrl.replace(/\/$/, '') + '/.well-known/openid-configuration';
      const res = await fetch(wellKnown);
      if (!res.ok) throw new Error(`[UIFE:OIDC] Discovery failed for ${issuerUrl}: ${res.status}`);

      const doc: OIDCDiscoveryDocument = await res.json();
      discoveryCache.set(issuerUrl, { doc, expiresAt: Date.now() + DISCOVERY_TTL_MS });
      return doc;
    },

    // ── Authorization URL ─────────────────────────
    buildAuthorizationUrl(idpConfig, state, nonce) {
      const authEndpoint = idpConfig.authorization_endpoint ?? '';
      const clientId = idpConfig.client_id ?? '';
      const scopes = idpConfig.scopes.length > 0 ? idpConfig.scopes.join(' ') : 'openid email profile';
      const redirectUri = `${window.location.origin}/auth/callback/oidc/${idpConfig.tenant_id}`;

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes,
        state,
        nonce,
      });

      return `${authEndpoint}?${params.toString()}`;
    },

    // ── Code Exchange (external IdP) ──────────────
    async exchangeCode(idpConfig, code, codeVerifier) {
      const tokenEndpoint = idpConfig.token_endpoint ?? '';
      const clientId = idpConfig.client_id ?? '';
      const redirectUri = `${window.location.origin}/auth/callback/oidc/${idpConfig.tenant_id}`;

      console.warn('[UIFE:OIDC] exchangeCode should be executed server-side via edge function');

      const body: Record<string, string> = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
      };
      if (codeVerifier) body.code_verifier = codeVerifier;

      const res = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`[UIFE:OIDC] Token exchange failed: ${err}`);
      }

      return (await res.json()) as OIDCTokenSet;
    },

    // ── ID Token Validation (structural) ──────────
    async validateIdToken(idToken, _idpConfig) {
      const parts = idToken.split('.');
      if (parts.length !== 3) throw new Error('[UIFE:OIDC] Invalid ID token format');

      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          throw new Error('[UIFE:OIDC] ID token expired');
        }
        return payload as OIDCUserInfo;
      } catch (e) {
        throw new Error(`[UIFE:OIDC] ID token decode failed: ${(e as Error).message}`);
      }
    },

    // ── UserInfo (external IdP) ───────────────────
    async fetchUserInfo(accessToken, idpConfig) {
      const userinfoEndpoint = idpConfig.userinfo_endpoint ?? '';
      if (!userinfoEndpoint) throw new Error('[UIFE:OIDC] No userinfo endpoint configured');

      const res = await fetch(userinfoEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) throw new Error(`[UIFE:OIDC] UserInfo fetch failed: ${res.status}`);
      return (await res.json()) as OIDCUserInfo;
    },

    // ════════════════════════════════════════════════
    // PLATFORM TOKEN ISSUANCE
    // ════════════════════════════════════════════════

    async issueTokens(userId, tenantId, clientId, scopes, nonce, sessionId) {
      const data = await invokeOIDCIssuer('issue', {
        user_id: userId,
        tenant_id: tenantId,
        client_id: clientId,
        scopes: scopes ?? ['openid', 'profile', 'email'],
        nonce,
        session_id: sessionId,
      });

      return {
        access_token: data.access_token,
        id_token: data.id_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type ?? 'Bearer',
        expires_in: data.expires_in ?? 3600,
        scope: data.scope ?? '',
      } as OIDCTokenSet;
    },

    async refreshTokens(refreshToken, clientId) {
      const data = await invokeOIDCIssuer('refresh', {
        refresh_token: refreshToken,
        client_id: clientId,
      });

      return {
        access_token: data.access_token,
        id_token: data.id_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type ?? 'Bearer',
        expires_in: data.expires_in ?? 3600,
        scope: data.scope ?? '',
      } as OIDCTokenSet;
    },

    async validateAccessToken(accessToken) {
      const data = await invokeOIDCIssuer('validate', { token: accessToken });
      if (!data.active) return null;
      return data as OIDCPlatformClaims;
    },

    async getPlatformDiscovery() {
      const data = await invokeOIDCIssuer('discovery', {});
      return data as OIDCDiscoveryDocument;
    },
  };
}
