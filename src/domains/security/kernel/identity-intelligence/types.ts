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
// UNIFIED IDENTITY READ-MODEL
// ════════════════════════════════════

/**
 * The single source of truth for identity state.
 * Projected from all subsystems into one consumable snapshot.
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

  // ── Where (tenant context) ──
  readonly tenantId: string | null;
  readonly tenantName: string | null;
  readonly scopeLevel: ScopeType | null;
  readonly groupId: string | null;
  readonly companyId: string | null;
  readonly effectiveRoles: readonly TenantRole[];

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
  | 'DecisionIssued';

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

export type IILEvent =
  | IILPhaseTransitionEvent
  | IILRiskEscalationEvent
  | IILAnomalyDetectedEvent
  | IILDecisionIssuedEvent;
