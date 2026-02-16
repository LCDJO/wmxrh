/**
 * Identity Intelligence Layer — Public API
 */

// ── Core Service ──
export {
  IdentityIntelligenceService,
  identityIntelligence,
  onIILEvent,
  getIILEventLog,
} from './identity-intelligence.service';

// ── Hook ──
export { useIdentityIntelligence } from './use-identity-intelligence';
export type { UseIdentityIntelligenceReturn } from './use-identity-intelligence';

// ── Types ──
export type {
  // Core session object
  UnifiedIdentitySession,
  UnifiedRealIdentity,
  TenantWorkspace,
  GroupEntry,
  ActiveContext,
  ImpersonationState,
  // FSM
  IdentityPhase,
  IdentityTrigger,
  IdentityTransition,
  // Detection
  DetectedUserType,
  UserTypeDetection,
  // Workspace
  WorkspaceEntry,
  RecentContext,
  // Risk
  RiskLevel,
  RiskSignal,
  RiskAssessment,
  // Snapshot (diagnostic)
  IdentitySnapshot,
  // Decision
  DecisionAction,
  IntelligenceDecision,
  // Events
  IILEventType,
  IILEvent,
  IILPhaseTransitionEvent,
  IILRiskEscalationEvent,
  IILAnomalyDetectedEvent,
  IILDecisionIssuedEvent,
  IILUserTypeDetectedEvent,
  IILWorkspaceSwitchedEvent,
} from './types';
