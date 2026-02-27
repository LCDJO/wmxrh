/**
 * UIFE — OAuthAuthorizationServer
 *
 * Platform-level OAuth 2.0 Authorization Server.
 * Issues authorization codes and tokens for API clients
 * (used by Developer Portal / API Management).
 *
 * NOTE: Token signing and code storage happen server-side.
 * This module provides the protocol orchestration layer.
 */

import type {
  OAuthAuthorizationServerAPI,
  OAuth2AuthorizationRequest,
  OAuth2TokenRequest,
  OAuth2TokenResponse,
} from './types';

/** Ephemeral auth code store (production: edge fn + DB) */
const authCodes = new Map<string, {
  userId: string;
  tenantId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: number;
}>();

function generateCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function createOAuthAuthorizationServer(): OAuthAuthorizationServerAPI {
  return {
    async createAuthorizationCode(request, userId, tenantId) {
      const code = generateCode();
      authCodes.set(code, {
        userId,
        tenantId,
        clientId: request.client_id,
        redirectUri: request.redirect_uri,
        scope: request.scope,
        codeChallenge: request.code_challenge,
        codeChallengeMethod: request.code_challenge_method,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
      });

      // Clean up expired codes
      for (const [k, v] of authCodes) {
        if (v.expiresAt < Date.now()) authCodes.delete(k);
      }

      return code;
    },

    async exchangeToken(request) {
      if (request.grant_type === 'authorization_code') {
        const stored = authCodes.get(request.code ?? '');
        if (!stored) throw new Error('[UIFE:OAuth] Invalid or expired authorization code');
        if (stored.expiresAt < Date.now()) {
          authCodes.delete(request.code ?? '');
          throw new Error('[UIFE:OAuth] Authorization code expired');
        }
        if (stored.clientId !== request.client_id) {
          throw new Error('[UIFE:OAuth] Client ID mismatch');
        }
        if (stored.redirectUri !== request.redirect_uri) {
          throw new Error('[UIFE:OAuth] Redirect URI mismatch');
        }

        // PKCE verification
        if (stored.codeChallenge && stored.codeChallengeMethod === 'S256') {
          if (!request.code_verifier) throw new Error('[UIFE:OAuth] code_verifier required');
          const encoder = new TextEncoder();
          const digest = await crypto.subtle.digest('SHA-256', encoder.encode(request.code_verifier));
          const computed = btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          if (computed !== stored.codeChallenge) {
            throw new Error('[UIFE:OAuth] PKCE verification failed');
          }
        }

        authCodes.delete(request.code ?? '');

        const response: OAuth2TokenResponse = {
          access_token: generateToken(),
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: generateToken(),
          scope: stored.scope,
        };

        return response;
      }

      if (request.grant_type === 'client_credentials') {
        // Client credentials flow — validate client_id + client_secret server-side
        console.warn('[UIFE:OAuth] client_credentials grant should be handled by edge function');
        return {
          access_token: generateToken(),
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'api:read',
        };
      }

      throw new Error(`[UIFE:OAuth] Unsupported grant_type: ${request.grant_type}`);
    },

    async revokeToken(token, _tokenType) {
      console.log(`[UIFE:OAuth] Token revoked: ${token.slice(0, 8)}...`);
      // Production: invalidate in token store / DB
    },

    async introspectToken(token) {
      // Production: look up token in DB, return claims
      console.warn('[UIFE:OAuth] introspectToken requires server-side implementation');
      return {
        active: token.length > 0,
        sub: undefined,
        scope: undefined,
        exp: undefined,
      };
    },
  };
}
