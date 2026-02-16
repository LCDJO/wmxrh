/**
 * Dual Identity Engine — Type Definitions
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  DUAL IDENTITY MODEL                                                ║
 * ║                                                                      ║
 * ║  RealIdentity   → WHO is actually logged in (immutable)              ║
 * ║  ActiveIdentity  → WHO is currently operating (can be overridden)    ║
 * ║                                                                      ║
 * ║  When NOT impersonating:  RealIdentity === ActiveIdentity            ║
 * ║  When impersonating:      ActiveIdentity = synthetic tenant context  ║
 * ║                                                                      ║
 * ║  SECURITY INVARIANTS:                                                ║
 * ║    1. Only PlatformUsers can impersonate                             ║
 * ║    2. Only specific platform roles are allowed                       ║
 * ║    3. Every action during impersonation is tagged in audit           ║
 * ║    4. Impersonation sessions have max TTL                            ║
 * ║    5. RealIdentity is NEVER mutated during impersonation             ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';
import type { TenantRole } from '@/domains/shared/types';

// ════════════════════════════════════
// REAL IDENTITY — immutable, from JWT
// ════════════════════════════════════

export interface RealIdentity {
  readonly userId: string;
  readonly email: string | null;
  readonly userType: 'platform' | 'tenant';
  readonly platformRole: PlatformRoleType | null;
  readonly authenticatedAt: number;
}

// ════════════════════════════════════
// ACTIVE IDENTITY — what the system uses for operations
// ════════════════════════════════════

export interface ActiveIdentity {
  readonly userId: string;
  readonly email: string | null;
  readonly userType: 'platform' | 'tenant';
  /** When impersonating a tenant, this is the target tenant_id */
  readonly tenantId: string | null;
  /** The effective role during operation */
  readonly effectiveRole: TenantRole | PlatformRoleType;
  /** Whether this identity is the result of impersonation */
  readonly isImpersonated: boolean;
  /** If impersonated, who is the real user */
  readonly impersonatedBy: string | null;
}

// ════════════════════════════════════
// IMPERSONATION SESSION
// ════════════════════════════════════

export interface ImpersonationSession {
  readonly id: string;
  readonly realIdentity: RealIdentity;
  readonly activeIdentity: ActiveIdentity;
  readonly targetTenantId: string;
  readonly targetTenantName: string;
  readonly simulatedRole: TenantRole;
  readonly reason: string;
  readonly startedAt: number;
  readonly expiresAt: number;
  /** Tracks operations performed during impersonation */
  readonly operationCount: number;
}

export interface StartImpersonationRequest {
  /** Target tenant to impersonate into */
  targetTenantId: string;
  targetTenantName: string;
  /** Role to simulate (default: tenant_admin) */
  simulatedRole?: TenantRole;
  /** Reason for impersonation (required for audit) */
  reason: string;
  /** Max duration in minutes (default: 30, max: 120) */
  maxDurationMinutes?: number;
}

export interface StartImpersonationResult {
  success: boolean;
  session: ImpersonationSession | null;
  reason: string;
  failedValidation?: ImpersonationDenialReason;
}

export type ImpersonationDenialReason =
  | 'NOT_PLATFORM_USER'
  | 'INSUFFICIENT_ROLE'
  | 'ALREADY_IMPERSONATING'
  | 'TENANT_NOT_FOUND'
  | 'REASON_REQUIRED'
  | 'DURATION_EXCEEDED';

export interface EndImpersonationResult {
  success: boolean;
  reason: string;
  /** How many operations were performed during the session */
  operationCount: number;
  /** Duration of the session in ms */
  durationMs: number;
}

// ════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════

/**
 * Platform roles allowed to impersonate into tenant contexts.
 *
 * CRITICAL RULES:
 *   1. RealIdentity is NEVER mutated during impersonation
 *   2. Impersonation does NOT generate a new login/session
 *   3. TenantUsers can NEVER impersonate (userType must be 'platform')
 *   4. platform_finance is explicitly EXCLUDED — no impersonation rights
 *   5. platform_read_only is explicitly EXCLUDED
 */
export const IMPERSONATION_ALLOWED_ROLES: readonly PlatformRoleType[] = [
  'platform_super_admin',
  'platform_support',
  // NOTE: 'platform_finance' and 'platform_read_only' are intentionally excluded.
  // 'platform_operations' is excluded — can manage tenants but not impersonate.
] as const;

/** Default simulated role when impersonating */
export const DEFAULT_SIMULATED_ROLE: TenantRole = 'tenant_admin';

/** Maximum impersonation session duration in minutes */
export const MAX_IMPERSONATION_DURATION_MINUTES = 120;

/** Default impersonation session duration in minutes */
export const DEFAULT_IMPERSONATION_DURATION_MINUTES = 30;

// ════════════════════════════════════
// IMPERSONATION EVENTS
// ════════════════════════════════════

export interface ImpersonationStartedPayload {
  type: 'ImpersonationStarted';
  timestamp: number;
  sessionId: string;
  realUserId: string;
  realEmail: string | null;
  platformRole: PlatformRoleType;
  targetTenantId: string;
  targetTenantName: string;
  simulatedRole: TenantRole;
  reason: string;
  expiresAt: number;
}

export interface ImpersonationEndedPayload {
  type: 'ImpersonationEnded';
  timestamp: number;
  sessionId: string;
  realUserId: string;
  targetTenantId: string;
  endReason: 'manual' | 'expired' | 'forced';
  durationMs: number;
  operationCount: number;
}

export interface ImpersonationDeniedPayload {
  type: 'ImpersonationDenied';
  timestamp: number;
  realUserId: string;
  targetTenantId: string | null;
  denialReason: ImpersonationDenialReason;
  detail: string;
}

export type ImpersonationEvent =
  | ImpersonationStartedPayload
  | ImpersonationEndedPayload
  | ImpersonationDeniedPayload;
