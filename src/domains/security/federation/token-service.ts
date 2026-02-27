/**
 * UIFE — TokenService
 *
 * Issues, validates, and manages platform-level tokens
 * for federated identity sessions.
 *
 * In production, signing uses a server-side edge function with HMAC/RSA.
 * This module provides the orchestration and local token structure.
 */

import type { TokenServiceAPI } from './types';

interface PlatformToken {
  userId: string;
  tenantId: string;
  scopes: string[];
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
}

/** In-memory token store (production: DB-backed via edge fn) */
const tokenStore = new Map<string, PlatformToken>();
const refreshTokenMap = new Map<string, string>(); // refreshToken → accessToken

function generateTokenString(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'uife_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function createTokenService(): TokenServiceAPI {
  return {
    async issueToken(userId, tenantId, scopes, sessionId) {
      const token = generateTokenString();
      const now = Date.now();

      tokenStore.set(token, {
        userId,
        tenantId,
        scopes,
        sessionId,
        issuedAt: now,
        expiresAt: now + 3600 * 1000, // 1 hour
      });

      // Issue refresh token
      const refreshToken = generateTokenString();
      refreshTokenMap.set(refreshToken, token);

      return token;
    },

    async validateToken(token) {
      const stored = tokenStore.get(token);
      if (!stored) return { valid: false };
      if (stored.expiresAt < Date.now()) {
        tokenStore.delete(token);
        return { valid: false };
      }
      return {
        valid: true,
        userId: stored.userId,
        tenantId: stored.tenantId,
        scopes: stored.scopes,
      };
    },

    async refreshToken(oldRefreshToken) {
      const accessToken = refreshTokenMap.get(oldRefreshToken);
      if (!accessToken) throw new Error('[UIFE:Token] Invalid refresh token');

      const stored = tokenStore.get(accessToken);
      if (!stored) throw new Error('[UIFE:Token] Associated access token not found');

      // Revoke old tokens
      tokenStore.delete(accessToken);
      refreshTokenMap.delete(oldRefreshToken);

      // Issue new pair
      const newAccessToken = generateTokenString();
      const newRefreshToken = generateTokenString();
      const now = Date.now();

      tokenStore.set(newAccessToken, {
        ...stored,
        issuedAt: now,
        expiresAt: now + 3600 * 1000,
      });
      refreshTokenMap.set(newRefreshToken, newAccessToken);

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    },

    async revokeSessionTokens(sessionId) {
      let revoked = 0;
      for (const [token, data] of tokenStore) {
        if (data.sessionId === sessionId) {
          tokenStore.delete(token);
          revoked++;
        }
      }
      // Clean refresh tokens
      for (const [rt, at] of refreshTokenMap) {
        if (!tokenStore.has(at)) refreshTokenMap.delete(rt);
      }
      console.log(`[UIFE:Token] Revoked ${revoked} tokens for session ${sessionId}`);
    },
  };
}
