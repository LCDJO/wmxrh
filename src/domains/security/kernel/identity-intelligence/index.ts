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

// ── Sub-components ──
export { IdentityRouter } from './identity-router';
export { WorkspaceResolver } from './workspace-resolver';
export { ContextMemoryService } from './context-memory.service';
export { UnifiedSessionManager } from './unified-session-manager';
export { LoginIntentDetector } from './login-intent-detector';

// ── Hook ──
export { useIdentityIntelligence } from './use-identity-intelligence';
export type { UseIdentityIntelligenceReturn } from './use-identity-intelligence';

// ── Types ──
export type {
  // Core session object
  UnifiedIdentitySession,
  UnifiedRealIdentity,
  UnifiedActiveIdentity,
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
  IILUnifiedSessionStartedEvent,
  IILContextRestoredEvent,
  IILLoginIntentDetectedEvent,
} from './types';
