/**
 * DevPortal OAuth2 + OIDC Integration
 *
 * Client-side orchestrator connecting Developer Portal apps
 * to the platform's OAuth2 Authorization Server and OIDC Provider.
 *
 * Flows:
 *  - App OAuth2 Client Credentials (machine-to-machine)
 *  - App Authorization Code Flow (user-delegated access)
 *  - App Token Refresh
 *  - App Token Introspection
 *  - OIDC Discovery for developer apps
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface DevPortalTokenRequest {
  clientId: string;
  clientSecret: string;
  grantType: 'client_credentials' | 'authorization_code' | 'refresh_token';
  scope?: string;
  code?: string;
  redirectUri?: string;
  codeVerifier?: string;
  refreshToken?: string;
}

export interface DevPortalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
}

export interface DevPortalIntrospectionResult {
  active: boolean;
  sub?: string;
  client_id?: string;
  scope?: string;
  app_id?: string;
  tenant_id?: string;
  grant_type?: string;
  exp?: number;
  iat?: number;
}

export interface DevPortalUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  tenant_id?: string;
  scope?: string;
  app_id?: string;
}

export interface DevPortalOIDCDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  introspection_endpoint: string;
  revocation_endpoint: string;
  jwks_uri: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
}

export interface AppAuthorizationParams {
  appId: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256';
}

// ── Helpers ──

async function invokeDevPortalOAuth(
  action: string,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>
) {
  const { data, error } = await supabase.functions.invoke('devportal-oauth', {
    body,
    headers: { 'x-action': action, ...extraHeaders },
  });

  if (error) throw new Error(`[DevPortal:OAuth] ${action} failed: ${error.message}`);
  if (data?.error) throw new Error(`[DevPortal:OAuth] ${data.error}: ${data.error_description || ''}`);
  return data;
}

function generatePKCE(): { verifier: string; challenge: Promise<string> } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

  const challenge = crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(verifier))
    .then(digest => {
      const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    });

  return { verifier, challenge };
}

function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// ══════════════════════════════════════════════
// DevPortalOAuthIntegration
// ══════════════════════════════════════════════

export const DevPortalOAuthIntegration = {
  /**
   * Exchange credentials for an access token.
   * Supports client_credentials, authorization_code, and refresh_token flows.
   */
  async requestToken(request: DevPortalTokenRequest): Promise<DevPortalTokenResponse> {
    const actionMap: Record<string, string> = {
      client_credentials: 'client_credentials',
      authorization_code: 'authorization_code',
      refresh_token: 'refresh_token',
    };

    const action = actionMap[request.grantType];
    if (!action) throw new Error(`Unsupported grant_type: ${request.grantType}`);

    return await invokeDevPortalOAuth(action, {
      client_id: request.clientId,
      client_secret: request.clientSecret,
      scope: request.scope,
      code: request.code,
      redirect_uri: request.redirectUri,
      code_verifier: request.codeVerifier,
      refresh_token: request.refreshToken,
    });
  },

  /**
   * Build the authorization URL for user-delegated access.
   * Includes PKCE by default.
   */
  async buildAuthorizationUrl(
    params: AppAuthorizationParams
  ): Promise<{ url: string; state: string; codeVerifier: string }> {
    const state = params.state || generateState();
    const pkce = generatePKCE();
    const codeChallenge = params.codeChallenge || (await pkce.challenge);

    const callbackBase = `${window.location.origin}/auth/callback/devportal/${params.appId}`;
    const redirectUri = params.redirectUri || callbackBase;

    const urlParams = new URLSearchParams({
      response_type: 'code',
      client_id: params.clientId,
      redirect_uri: redirectUri,
      scope: params.scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: params.codeChallengeMethod || 'S256',
    });

    // Store state and verifier for callback validation
    sessionStorage.setItem(`devportal_oauth_state_${params.appId}`, state);
    sessionStorage.setItem(`devportal_oauth_verifier_${params.appId}`, pkce.verifier);

    return {
      url: `${window.location.origin}/oauth/authorize?${urlParams.toString()}`,
      state,
      codeVerifier: pkce.verifier,
    };
  },

  /**
   * Handle the OAuth callback after user authorization.
   * Validates state and exchanges code for tokens.
   */
  async handleCallback(
    appId: string,
    code: string,
    state: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<DevPortalTokenResponse> {
    // Validate state
    const storedState = sessionStorage.getItem(`devportal_oauth_state_${appId}`);
    if (!storedState || storedState !== state) {
      throw new Error('[DevPortal:OAuth] State mismatch — possible CSRF attack');
    }

    const codeVerifier = sessionStorage.getItem(`devportal_oauth_verifier_${appId}`);

    // Cleanup
    sessionStorage.removeItem(`devportal_oauth_state_${appId}`);
    sessionStorage.removeItem(`devportal_oauth_verifier_${appId}`);

    return await this.requestToken({
      clientId,
      clientSecret,
      grantType: 'authorization_code',
      code,
      redirectUri,
      codeVerifier: codeVerifier || undefined,
    });
  },

  /**
   * Refresh an access token using a refresh token.
   */
  async refreshToken(
    clientId: string,
    refreshToken: string
  ): Promise<DevPortalTokenResponse> {
    return await invokeDevPortalOAuth('refresh_token', {
      client_id: clientId,
      refresh_token: refreshToken,
    });
  },

  /**
   * Introspect a token (RFC 7662).
   */
  async introspectToken(token: string): Promise<DevPortalIntrospectionResult> {
    return await invokeDevPortalOAuth('introspect', { token });
  },

  /**
   * Get user info from an app-scoped access token.
   */
  async getUserInfo(accessToken: string): Promise<DevPortalUserInfo> {
    return await invokeDevPortalOAuth('userinfo', {}, {
      authorization: `Bearer ${accessToken}`,
    });
  },

  /**
   * Revoke a token (access or refresh).
   */
  async revokeToken(token: string, tokenTypeHint?: 'access_token' | 'refresh_token'): Promise<void> {
    await invokeDevPortalOAuth('revoke', {
      token,
      token_type_hint: tokenTypeHint,
    });
  },

  /**
   * Fetch the OIDC Discovery document for the developer portal.
   */
  async getDiscovery(): Promise<DevPortalOIDCDiscovery> {
    return await invokeDevPortalOAuth('discovery', {});
  },

  /**
   * Generate PKCE values for authorization code flow.
   */
  async generatePKCE(): Promise<{ verifier: string; challenge: string }> {
    const pkce = generatePKCE();
    return { verifier: pkce.verifier, challenge: await pkce.challenge };
  },
};
