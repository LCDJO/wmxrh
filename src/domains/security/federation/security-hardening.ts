/**
 * UIFE — Security Hardening Policy
 *
 * Centralized security policy enforcement for OAuth2/OIDC flows:
 *  - PKCE mandatory for all public clients
 *  - Short token expiration (15min access, 7d refresh)
 *  - Refresh token rotation with reuse detection
 *  - Session revocation (single + bulk)
 *  - MFA readiness (step-up auth, challenge tracking)
 *
 * This module acts as a policy layer — it does NOT issue tokens itself,
 * but validates and enforces security invariants before token operations.
 */

// ── Security Constants ──

export const SECURITY_POLICY = {
  /** Access token lifetime in seconds (15 minutes) */
  ACCESS_TOKEN_TTL: 900,
  /** ID token lifetime in seconds (15 minutes) */
  ID_TOKEN_TTL: 900,
  /** Refresh token lifetime in seconds (7 days) */
  REFRESH_TOKEN_TTL: 604_800,
  /** Authorization code lifetime in seconds (5 minutes) */
  AUTH_CODE_TTL: 300,
  /** Device code lifetime in seconds (10 minutes) */
  DEVICE_CODE_TTL: 600,
  /** Session idle timeout in seconds (30 minutes) */
  SESSION_IDLE_TIMEOUT: 1_800,
  /** Maximum session duration in seconds (8 hours) */
  SESSION_MAX_DURATION: 28_800,
  /** Maximum concurrent sessions per user per tenant */
  MAX_CONCURRENT_SESSIONS: 5,
  /** PKCE code_verifier minimum length */
  PKCE_VERIFIER_MIN_LENGTH: 43,
  /** PKCE code_verifier maximum length */
  PKCE_VERIFIER_MAX_LENGTH: 128,
  /** Allowed code_challenge_method values */
  PKCE_ALLOWED_METHODS: ['S256'] as const,
  /** Grace period for refresh token rotation (seconds) — old token stays valid */
  REFRESH_ROTATION_GRACE_PERIOD: 30,
  /** Max failed MFA attempts before lockout */
  MFA_MAX_ATTEMPTS: 5,
  /** MFA lockout duration in seconds (15 minutes) */
  MFA_LOCKOUT_DURATION: 900,
  /** Step-up auth required for these scopes */
  STEP_UP_SCOPES: ['billing.invoice.write', 'hr.employee.write', 'iam.manage', 'platform.admin'] as const,
} as const;

// ── Types ──

export type PKCEMethod = 'S256';

export interface PKCEParams {
  code_challenge: string;
  code_challenge_method: PKCEMethod;
}

export interface PKCEVerification {
  code_verifier: string;
  stored_challenge: string;
  stored_method: PKCEMethod;
}

export type MFAStatus = 'not_enrolled' | 'enrolled' | 'verified' | 'locked';
export type MFAMethod = 'totp' | 'webauthn' | 'sms' | 'email';

export interface MFAChallenge {
  challenge_id: string;
  method: MFAMethod;
  issued_at: number;
  expires_at: number;
  attempts: number;
  verified: boolean;
}

export interface MFAEnrollment {
  user_id: string;
  method: MFAMethod;
  status: MFAStatus;
  enrolled_at: string;
  last_verified_at: string | null;
  recovery_codes_remaining: number;
}

export interface SecurityValidationResult {
  valid: boolean;
  error?: string;
  error_code?: string;
  requires_mfa?: boolean;
  mfa_methods?: MFAMethod[];
}

export interface RefreshTokenRotationResult {
  new_refresh_token: string;
  old_token_revoked: boolean;
  reuse_detected: boolean;
  family_id: string;
}

export interface SessionSecurityContext {
  session_id: string;
  user_id: string;
  tenant_id: string;
  device_fingerprint: string | null;
  ip_address: string | null;
  mfa_verified: boolean;
  mfa_method: MFAMethod | null;
  step_up_authenticated: boolean;
  step_up_expires_at: string | null;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
}

// ══════════════════════════════════════════════
// PKCE ENFORCEMENT
// ══════════════════════════════════════════════

export const PKCEEnforcer = {
  /**
   * Validate PKCE parameters in authorization request.
   * PKCE is MANDATORY — no exceptions for public clients.
   */
  validateChallenge(params: Partial<PKCEParams>): SecurityValidationResult {
    if (!params.code_challenge) {
      return {
        valid: false,
        error: 'PKCE is required. Provide code_challenge parameter.',
        error_code: 'pkce_required',
      };
    }

    if (!params.code_challenge_method || !SECURITY_POLICY.PKCE_ALLOWED_METHODS.includes(params.code_challenge_method as any)) {
      return {
        valid: false,
        error: `code_challenge_method must be one of: ${SECURITY_POLICY.PKCE_ALLOWED_METHODS.join(', ')}`,
        error_code: 'invalid_challenge_method',
      };
    }

    // S256 challenges are base64url-encoded SHA-256 hashes (43 chars)
    if (params.code_challenge.length < 43) {
      return {
        valid: false,
        error: 'code_challenge is too short for S256 method.',
        error_code: 'invalid_challenge',
      };
    }

    return { valid: true };
  },

  /**
   * Verify code_verifier against stored code_challenge.
   */
  async verifyCodeVerifier(verification: PKCEVerification): Promise<SecurityValidationResult> {
    const { code_verifier, stored_challenge, stored_method } = verification;

    if (!code_verifier) {
      return { valid: false, error: 'code_verifier is required.', error_code: 'pkce_verifier_required' };
    }

    if (code_verifier.length < SECURITY_POLICY.PKCE_VERIFIER_MIN_LENGTH ||
        code_verifier.length > SECURITY_POLICY.PKCE_VERIFIER_MAX_LENGTH) {
      return {
        valid: false,
        error: `code_verifier must be ${SECURITY_POLICY.PKCE_VERIFIER_MIN_LENGTH}-${SECURITY_POLICY.PKCE_VERIFIER_MAX_LENGTH} characters.`,
        error_code: 'invalid_verifier_length',
      };
    }

    if (stored_method === 'S256') {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code_verifier));
      const computed = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      if (computed !== stored_challenge) {
        return { valid: false, error: 'PKCE verification failed.', error_code: 'pkce_mismatch' };
      }
    }

    return { valid: true };
  },

  /**
   * Generate PKCE pair (for client-side use).
   */
  async generatePKCE(): Promise<{ verifier: string; challenge: string; method: PKCEMethod }> {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const verifier = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return { verifier, challenge, method: 'S256' };
  },
};

// ══════════════════════════════════════════════
// TOKEN EXPIRATION POLICY
// ══════════════════════════════════════════════

export const TokenExpirationPolicy = {
  /**
   * Get the enforced TTL for a given token type.
   * Clamps any requested TTL to the policy maximum.
   */
  getEffectiveTTL(tokenType: 'access' | 'id' | 'refresh' | 'auth_code' | 'device_code', requestedTTL?: number): number {
    const maxTTL: Record<string, number> = {
      access: SECURITY_POLICY.ACCESS_TOKEN_TTL,
      id: SECURITY_POLICY.ID_TOKEN_TTL,
      refresh: SECURITY_POLICY.REFRESH_TOKEN_TTL,
      auth_code: SECURITY_POLICY.AUTH_CODE_TTL,
      device_code: SECURITY_POLICY.DEVICE_CODE_TTL,
    };

    const max = maxTTL[tokenType] || SECURITY_POLICY.ACCESS_TOKEN_TTL;
    if (!requestedTTL || requestedTTL > max) return max;
    return requestedTTL;
  },

  /**
   * Check if a token is expired.
   */
  isExpired(expiresAt: number | string): boolean {
    const expiry = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() / 1000 : expiresAt;
    return Math.floor(Date.now() / 1000) >= expiry;
  },

  /**
   * Check if a token is near expiry (within 60 seconds).
   */
  isNearExpiry(expiresAt: number | string, bufferSeconds = 60): boolean {
    const expiry = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() / 1000 : expiresAt;
    return Math.floor(Date.now() / 1000) >= (expiry - bufferSeconds);
  },

  /**
   * Compute token claims timestamps using policy-enforced TTLs.
   */
  computeTokenTimestamps(tokenType: 'access' | 'id' | 'refresh', requestedTTL?: number) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = this.getEffectiveTTL(tokenType, requestedTTL);
    return { iat: now, exp: now + ttl, ttl };
  },
};

// ══════════════════════════════════════════════
// REFRESH TOKEN ROTATION
// ══════════════════════════════════════════════

export const RefreshTokenRotation = {
  /**
   * Generate a new refresh token with family tracking.
   * Family ID groups all tokens in a rotation chain.
   */
  generateRefreshToken(familyId?: string): { token: string; family_id: string; hash: Promise<string> } {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = `rt_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
    const family = familyId || crypto.randomUUID();

    return {
      token,
      family_id: family,
      hash: sha256Hex(token),
    };
  },

  /**
   * Detect refresh token reuse.
   * If a previously-rotated token is used again, it indicates theft.
   * The entire token family should be revoked.
   */
  isReuseAttempt(tokenUsedAt: string | null, rotatedAt: string | null): boolean {
    if (!tokenUsedAt || !rotatedAt) return false;
    const usedTime = new Date(tokenUsedAt).getTime();
    const rotatedTime = new Date(rotatedAt).getTime();
    const graceMs = SECURITY_POLICY.REFRESH_ROTATION_GRACE_PERIOD * 1000;
    return usedTime > (rotatedTime + graceMs);
  },
};

// ══════════════════════════════════════════════
// SESSION REVOCATION
// ══════════════════════════════════════════════

export const SessionRevocation = {
  /**
   * Check if a session should be revoked due to inactivity.
   */
  isIdleExpired(lastActivityAt: string): boolean {
    const lastActivity = new Date(lastActivityAt).getTime();
    const idleLimit = SECURITY_POLICY.SESSION_IDLE_TIMEOUT * 1000;
    return Date.now() - lastActivity > idleLimit;
  },

  /**
   * Check if session exceeds maximum duration.
   */
  isMaxDurationExceeded(createdAt: string): boolean {
    const created = new Date(createdAt).getTime();
    const maxDuration = SECURITY_POLICY.SESSION_MAX_DURATION * 1000;
    return Date.now() - created > maxDuration;
  },

  /**
   * Determine if a session should be force-revoked.
   */
  shouldRevoke(session: { last_activity_at?: string; created_at: string; status: string }): { revoke: boolean; reason?: string } {
    if (session.status === 'revoked' || session.status === 'expired') {
      return { revoke: false };
    }

    if (session.last_activity_at && this.isIdleExpired(session.last_activity_at)) {
      return { revoke: true, reason: 'idle_timeout' };
    }

    if (this.isMaxDurationExceeded(session.created_at)) {
      return { revoke: true, reason: 'max_duration_exceeded' };
    }

    return { revoke: false };
  },

  /**
   * Check if adding a new session would exceed the concurrent limit.
   */
  exceedsConcurrentLimit(activeSessionCount: number): boolean {
    return activeSessionCount >= SECURITY_POLICY.MAX_CONCURRENT_SESSIONS;
  },
};

// ══════════════════════════════════════════════
// MFA READINESS
// ══════════════════════════════════════════════

export const MFAPolicy = {
  /**
   * Check if MFA is required for a given set of scopes.
   */
  requiresMFA(requestedScopes: string[]): boolean {
    return requestedScopes.some(scope =>
      SECURITY_POLICY.STEP_UP_SCOPES.some(stepUp => scope.startsWith(stepUp))
    );
  },

  /**
   * Check if step-up authentication is still valid.
   */
  isStepUpValid(stepUpExpiresAt: string | null): boolean {
    if (!stepUpExpiresAt) return false;
    return new Date(stepUpExpiresAt).getTime() > Date.now();
  },

  /**
   * Create an MFA challenge.
   */
  createChallenge(method: MFAMethod): MFAChallenge {
    const now = Math.floor(Date.now() / 1000);
    return {
      challenge_id: crypto.randomUUID(),
      method,
      issued_at: now,
      expires_at: now + 300, // 5 min
      attempts: 0,
      verified: false,
    };
  },

  /**
   * Validate an MFA attempt.
   */
  validateAttempt(challenge: MFAChallenge): SecurityValidationResult {
    if (challenge.verified) {
      return { valid: false, error: 'Challenge already verified.', error_code: 'challenge_consumed' };
    }

    if (TokenExpirationPolicy.isExpired(challenge.expires_at)) {
      return { valid: false, error: 'MFA challenge expired.', error_code: 'challenge_expired' };
    }

    if (challenge.attempts >= SECURITY_POLICY.MFA_MAX_ATTEMPTS) {
      return { valid: false, error: 'Too many MFA attempts. Account locked.', error_code: 'mfa_locked' };
    }

    return { valid: true };
  },

  /**
   * Get the supported MFA methods.
   */
  getSupportedMethods(): MFAMethod[] {
    return ['totp', 'webauthn', 'email'];
  },

  /**
   * Check if a user's MFA enrollment is sufficient for the requested action.
   */
  isEnrollmentSufficient(enrollment: MFAEnrollment | null, requiredForScopes: string[]): SecurityValidationResult {
    if (!this.requiresMFA(requiredForScopes)) {
      return { valid: true };
    }

    if (!enrollment || enrollment.status === 'not_enrolled') {
      return {
        valid: false,
        error: 'MFA enrollment required for this action.',
        error_code: 'mfa_enrollment_required',
        requires_mfa: true,
        mfa_methods: this.getSupportedMethods(),
      };
    }

    if (enrollment.status === 'locked') {
      return {
        valid: false,
        error: 'MFA is locked. Contact administrator.',
        error_code: 'mfa_locked',
      };
    }

    return { valid: true };
  },
};

// ── Utility ──

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
