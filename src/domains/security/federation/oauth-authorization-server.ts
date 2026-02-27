/**
 * UIFE — OAuthAuthorizationServer
 *
 * Platform-level OAuth 2.0 Authorization Server.
 * Delegates token operations to the oauth2-token edge function.
 *
 * Supports:
 *  - Authorization Code Flow (+ PKCE)
 *  - Client Credentials
 *  - Refresh Token rotation
 *  - Device Authorization Flow (RFC 8628) — future-ready
 *  - Token Revocation (RFC 7009)
 *  - Token Introspection (RFC 7662)
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  OAuthAuthorizationServerAPI,
  OAuth2AuthorizationRequest,
  OAuth2TokenRequest,
  OAuth2TokenResponse,
  OAuth2DeviceAuthorizationResponse,
} from './types';

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function generateCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function invokeOAuth2(action: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('oauth2-token', {
    body,
    headers: { 'x-action': action },
  });
  if (error) throw new Error(`[UIFE:OAuth] ${action} failed: ${error.message}`);
  if (data?.error) throw new Error(`[UIFE:OAuth] ${data.error}: ${data.error_description || ''}`);
  return data;
}

export function createOAuthAuthorizationServer(): OAuthAuthorizationServerAPI {
  return {
    async createAuthorizationCode(request, userId, tenantId) {
      const code = generateCode();
      const codeHash = await sha256Hex(code);

      // Store server-side via direct DB insert (service uses supabase client in edge fn context)
      // For frontend orchestration, we insert via the supabase client with RLS bypass via edge fn
      const { error } = await supabase.functions.invoke('oauth2-token', {
        body: {
          grant_type: '__create_code',
          code_hash: codeHash,
          tenant_id: tenantId,
          user_id: userId,
          client_id: request.client_id,
          redirect_uri: request.redirect_uri,
          scope: request.scope,
          code_challenge: request.code_challenge,
          code_challenge_method: request.code_challenge_method,
        },
        headers: { 'x-action': 'create_code' },
      });

      if (error) throw new Error(`[UIFE:OAuth] createAuthorizationCode failed: ${error.message}`);
      return code;
    },

    async exchangeToken(request) {
      return await invokeOAuth2('token', {
        grant_type: request.grant_type,
        code: request.code,
        redirect_uri: request.redirect_uri,
        client_id: request.client_id,
        client_secret: request.client_secret,
        code_verifier: request.code_verifier,
        refresh_token: request.refresh_token,
        device_code: request.device_code,
        scope: request.scope,
      }) as OAuth2TokenResponse;
    },

    async revokeToken(token, tokenType) {
      await invokeOAuth2('revoke', {
        token,
        token_type_hint: tokenType,
      });
    },

    async introspectToken(token) {
      return await invokeOAuth2('introspect', { token });
    },

    async requestDeviceAuthorization(clientId, scope, tenantId) {
      return await invokeOAuth2('device_authorize', {
        client_id: clientId,
        scope,
        tenant_id: tenantId,
      }) as OAuth2DeviceAuthorizationResponse;
    },

    async approveDeviceCode(userCode, userId) {
      const { error } = await supabase
        .from('oauth2_grants' as any)
        .update({ device_status: 'approved', user_id: userId } as any)
        .eq('user_code', userCode)
        .eq('device_status', 'authorization_pending')
        .eq('is_used', false);

      if (error) throw new Error(`[UIFE:OAuth] approveDeviceCode failed: ${error.message}`);
    },

    async denyDeviceCode(userCode) {
      const { error } = await supabase
        .from('oauth2_grants' as any)
        .update({ device_status: 'denied' } as any)
        .eq('user_code', userCode)
        .eq('device_status', 'authorization_pending')
        .eq('is_used', false);

      if (error) throw new Error(`[UIFE:OAuth] denyDeviceCode failed: ${error.message}`);
    },
  };
}
