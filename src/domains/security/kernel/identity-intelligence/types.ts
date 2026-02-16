/**
 * Identity Intelligence Layer — Type Definitions
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  IDENTITY INTELLIGENCE LAYER (IIL)                                  ║
 * ║                                                                      ║
 * ║  Orchestrates ALL identity subsystems into a single coherent API:    ║
 * ║                                                                      ║
 * ║  ┌─────────────────────────────────────────────────────────────┐     ║
 * ║  │               Identity Intelligence Layer                   │     ║
 * ║  ├─────────────────────────────────────────────────────────────┤     ║
 * ║  │  State Machine     │  Decision Engine   │  Read Model      │     ║
 * ║  ├────────────────────┼────────────────────┼──────────────────┤     ║
 * ║  │  Platform Identity │  Identity Boundary │  Dual Identity   │     ║
 * ║  │  Access Graph      │  Navigation Intel  │  Security Kernel │     ║
 * ║  └─────────────────────────────────────────────────────────────┘     ║
 * ║                                                                      ║
 * ║  IDENTITY STATES (FSM):                                              ║
 * ║    Anonymous  → Authenticated → Scoped → Impersonating               ║
 * ║       ↑              ↓                                               ║
 * ║       └──────────────┘ (logout)                                      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import type { TenantRole, ScopeType } from '@/domains/shared/types';
import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';
import type { RealIdentity, ActiveIdentity, ImpersonationSession } from '../dual-identity-engine.types';
import type { IdentityBoundarySnapshot } from '../identity-boundary.types';

// ════════════════════════════════════
// IDENTITY STATE MACHINE
// ════════════════════════════════════

/**
 * Identity phases — represents the lifecycle of a user session.
 *
 *   anonymous       → no auth token present
 *   authenticated   → JWT valid but no tenant/scope selected
 *   scoped          → tenant + scope resolved, operational
 *   impersonating   → platform user operating as tenant (DualIdentity active)
 */
export type IdentityPhase =
  | 'anonymous'
  | 'authenticated'
  | 'scoped'
  | 'impersonating';

/**
 * Valid transitions in the identity FSM.
 */
export type IdentityTransition =
  | { from: 'anonymous';       to: 'authenticated'; trigger: 'LOGIN' }
  | { from: 'authenticated';   to: 'scoped';        trigger: 'SCOPE_RESOLVED' }
  | { from: 'authenticated';   to: 'anonymous';     trigger: 'LOGOUT' }
  | { from: 'scoped';          to: 'impersonating'; trigger: 'IMPERSONATION_START' }
  | { from: 'scoped';          to: 'scoped';        trigger: 'SCOPE_SWITCH' }
  | { from: 'scoped';          to: 'authenticated'; trigger: 'SCOPE_LOST' }
  | { from: 'scoped';          to: 'anonymous';     trigger: 'LOGOUT' }
  | { from: 'impersonating';   to: 'scoped';        trigger: 'IMPERSONATION_END' }
  | { from: 'impersonating';   to: 'anonymous';     trigger: 'LOGOUT' };

export type IdentityTrigger = IdentityTransition['trigger'];

// ════════════════════════════════════
// USER TYPE AUTO-DETECTION
// ════════════════════════════════════

/**
 * Detected user classification result.
 * Auto-resolved from JWT claims, platform_users table, and tenant_memberships.
 */
export type DetectedUserType = 'platform' | 'tenant' | 'unknown';

export interface UserTypeDetection {
  readonly detectedType: DetectedUserType;
  readonly confidence: 'jwt_claim' | 'db_lookup' | 'membership_inferred' | 'unknown';
  readonly platformRole: PlatformRoleType | null;
  readonly tenantCount: number;
  readonly detectedAt: number;
}

// ════════════════════════════════════
// WORKSPACE CONTEXT & HISTORY
// ════════════════════════════════════

/**
 * Represents a workspace the user can switch to.
 */
export interface WorkspaceEntry {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly role: TenantRole;
  readonly scopeLevel: ScopeType | null;
  readonly groupId: string | null;
  readonly companyId: string | null;
}

/**
 * A recent context visit — persisted for quick switch back.
 */
export interface RecentContext {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly role: TenantRole;
  readonly scopeLevel: ScopeType;
  readonly groupId: string | null;
  readonly companyId: string | null;
  readonly visitedAt: number;
  readonly durationMs: number;
}

// ════════════════════════════════════
// RISK SCORING & ANOMALY DETECTION
// ════════════════════════════════════

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskSignal {
  readonly signal: string;
  readonly weight: number;
  readonly detail: string;
}

export interface RiskAssessment {
  readonly level: RiskLevel;
  readonly score: number;        // 0-100
  readonly signals: RiskSignal[];
  readonly assessedAt: number;
}

// ════════════════════════════════════
// UNIFIED IDENTITY SESSION
// ════════════════════════════════════

/**
 * UnifiedIdentitySession — the top-level session object.
 *
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  {                                                         ║
 * ║    session_id,                                             ║
 * ║    real_identity,                                          ║
 * ║    available_tenants[],                                    ║
 * ║    available_groups[],                                     ║
 * ║    recent_contexts[],                                      ║
 * ║    active_context,                                         ║
 * ║    impersonation_state?                                    ║
 * ║  }                                                         ║
 * ╚═══════════════════════════════════════════════════════════╝
 */
export interface UnifiedIdentitySession {
  /** Stable session identifier (fingerprint from IBL) */
  readonly session_id: string;

  /** Phase in the identity lifecycle */
  readonly phase: IdentityPhase;

  /** The real identity — WHO actually logged in (immutable) */
  readonly real_identity: UnifiedRealIdentity;

  /** All tenants the user has membership in */
  readonly available_tenants: readonly TenantWorkspace[];

  /** All groups reachable via AccessGraph */
  readonly available_groups: readonly GroupEntry[];

  /** Recent context visits for quick switch back */
  readonly recent_contexts: readonly RecentContext[];

  /** The currently active operational context (null if phase < scoped) */
  readonly active_context: ActiveContext | null;

  /** Impersonation state (null if not impersonating) */
  readonly impersonation_state: ImpersonationState | null;

  /** Risk assessment */
  readonly risk: RiskAssessment;

  /** Timestamp of session creation */
  readonly established_at: number;

  /** Timestamp of last projection */
  readonly resolved_at: number;
}

/**
 * The real identity — immutable per auth session.
 */
export interface UnifiedRealIdentity {
  readonly user_id: string;
  readonly email: string | null;
  readonly user_type: DetectedUserType;
  readonly platform_role: PlatformRoleType | null;
  readonly detection: UserTypeDetection | null;
  readonly authenticated_at: number;
}

/**
 * A tenant workspace available for switching.
 */
export interface TenantWorkspace {
  readonly tenant_id: string;
  readonly tenant_name: string;
  readonly role: TenantRole;
  readonly is_active: boolean;
}

/**
 * A group reachable via AccessGraph.
 */
export interface GroupEntry {
  readonly group_id: string;
  readonly tenant_id: string;
  readonly inherited_from: 'tenant' | 'direct';
}

/**
 * The currently active context — WHERE the user is operating.
 */
export interface ActiveContext {
  readonly tenant_id: string;
  readonly tenant_name: string;
  readonly membership_role: TenantRole;
  readonly effective_roles: readonly TenantRole[];
  readonly scope_level: ScopeType;
  readonly group_id: string | null;
  readonly company_id: string | null;
  readonly activated_at: number;
}

/**
 * Impersonation state — only present when a platform user
 * is operating as a tenant user.
 */
export interface ImpersonationState {
  readonly session_id: string;
  readonly real_user_id: string;
  readonly target_tenant_id: string;
  readonly target_tenant_name: string;
  readonly simulated_role: TenantRole;
  readonly reason: string;
  readonly started_at: number;
  readonly expires_at: number;
  readonly remaining_ms: number;
  readonly operation_count: number;
}

// ════════════════════════════════════
// UNIFIED IDENTITY READ-MODEL (full diagnostic snapshot)
// ════════════════════════════════════

/**
 * The single source of truth for identity state.
 * Projected from all subsystems into one consumable snapshot.
 *
 * For simpler consumption, prefer `UnifiedIdentitySession`.
 * IdentitySnapshot adds diagnostic/graph/IBL metadata.
 */
export interface IdentitySnapshot {
  // ── Phase ──
  readonly phase: IdentityPhase;
  readonly previousPhase: IdentityPhase | null;
  readonly phaseChangedAt: number | null;

  // ── Who ──
  readonly userId: string | null;
  readonly email: string | null;
  readonly userType: 'platform' | 'tenant' | null;
  readonly platformRole: PlatformRoleType | null;
  readonly userTypeDetection: UserTypeDetection | null;

  // ── Where (tenant context) ──
  readonly tenantId: string | null;
  readonly tenantName: string | null;
  readonly scopeLevel: ScopeType | null;
  readonly groupId: string | null;
  readonly companyId: string | null;
  readonly effectiveRoles: readonly TenantRole[];

  // ── Workspaces ──
  readonly availableWorkspaces: readonly WorkspaceEntry[];
  readonly recentContexts: readonly RecentContext[];
  readonly canSwitchWorkspace: boolean;

  // ── Dual Identity ──
  readonly isImpersonating: boolean;
  readonly realIdentity: RealIdentity | null;
  readonly activeIdentity: ActiveIdentity | null;
  readonly impersonationSession: ImpersonationSession | null;
  readonly impersonationRemainingMs: number;

  // ── Access Graph ──
  readonly hasAccessGraph: boolean;
  readonly reachableCompanyCount: number;
  readonly reachableGroupCount: number;

  // ── IBL State ──
  readonly iblEstablished: boolean;
  readonly contextSwitchCount: number;
  readonly availableTenantCount: number;

  // ── Risk ──
  readonly risk: RiskAssessment;

  // ── Metadata ──
  readonly resolvedAt: number;
}

// ════════════════════════════════════
// DECISION ENGINE
// ════════════════════════════════════

export type DecisionAction =
  | 'REQUIRE_MFA'
  | 'REQUIRE_SCOPE'
  | 'BLOCK_FINANCIAL'
  | 'FORCE_LOGOUT'
  | 'RATE_LIMIT'
  | 'ALLOW';

export interface IntelligenceDecision {
  readonly action: DecisionAction;
  readonly reason: string;
  readonly metadata?: Record<string, unknown>;
}

// ════════════════════════════════════
// EVENTS
// ════════════════════════════════════

export type IILEventType =
  | 'PhaseTransition'
  | 'RiskEscalation'
  | 'AnomalyDetected'
  | 'DecisionIssued'
  | 'UserTypeDetected'
  | 'WorkspaceSwitched';

export interface IILPhaseTransitionEvent {
  type: 'PhaseTransition';
  timestamp: number;
  userId: string | null;
  from: IdentityPhase;
  to: IdentityPhase;
  trigger: IdentityTrigger;
}

export interface IILRiskEscalationEvent {
  type: 'RiskEscalation';
  timestamp: number;
  userId: string | null;
  previousLevel: RiskLevel;
  newLevel: RiskLevel;
  score: number;
  signals: RiskSignal[];
}

export interface IILAnomalyDetectedEvent {
  type: 'AnomalyDetected';
  timestamp: number;
  userId: string | null;
  anomaly: string;
  detail: string;
}

export interface IILDecisionIssuedEvent {
  type: 'DecisionIssued';
  timestamp: number;
  userId: string | null;
  decision: IntelligenceDecision;
}

export interface IILUserTypeDetectedEvent {
  type: 'UserTypeDetected';
  timestamp: number;
  userId: string | null;
  detection: UserTypeDetection;
}

export interface IILWorkspaceSwitchedEvent {
  type: 'WorkspaceSwitched';
  timestamp: number;
  userId: string | null;
  fromTenantId: string | null;
  toTenantId: string;
  toTenantName: string;
  switchMethod: 'explicit' | 'auto_restore' | 'initial';
}

export type IILEvent =
  | IILPhaseTransitionEvent
  | IILRiskEscalationEvent
  | IILAnomalyDetectedEvent
  | IILDecisionIssuedEvent
  | IILUserTypeDetectedEvent
  | IILWorkspaceSwitchedEvent;
