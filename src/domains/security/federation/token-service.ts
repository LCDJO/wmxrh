/**
 * UIFE — TokenService
 *
 * Issues, validates, and manages platform-level tokens
 * for federated identity sessions.
 *
 * Delegates to federation-jwks edge function for RS256 signed JWTs
 * with rotating key pairs and JWK endpoint.
 */

import { supabase } from '@/integrations/supabase/client';
import type { TokenServiceAPI } from './types';

async function invokeJWKS(action: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('federation-jwks', {
    body,
    headers: { 'x-action': action },
  });
  if (error) throw new Error(`[UIFE:Token] ${action} failed: ${error.message}`);
  if (data?.error) throw new Error(`[UIFE:Token] ${data.error}: ${data.error_description || ''}`);
  return data;
}

export function createTokenService(): TokenServiceAPI {
  return {
    async issueToken(userId, tenantId, scopes, sessionId) {
      const data = await invokeJWKS('issue', {
        user_id: userId,
        tenant_id: tenantId,
        scopes,
        session_id: sessionId,
      });
      return data.access_token;
    },

    async validateToken(token) {
      const data = await invokeJWKS('validate', { token });
      if (!data.active) return { valid: false };
      return {
        valid: true,
        userId: data.sub,
        tenantId: data.tenant_id,
        scopes: data.scopes,
      };
    },

    async refreshToken(oldRefreshToken) {
      const data = await invokeJWKS('refresh', {
        refresh_token: oldRefreshToken,
        client_id: 'platform',
      });
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      };
    },

    async revokeSessionTokens(sessionId) {
      await invokeJWKS('revoke_session', { session_id: sessionId });
    },
  };
}
