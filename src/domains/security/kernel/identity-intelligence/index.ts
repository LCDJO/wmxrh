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
  IdentityPhase,
  IdentityTrigger,
  IdentityTransition,
  DetectedUserType,
  UserTypeDetection,
  WorkspaceEntry,
  RecentContext,
  RiskLevel,
  RiskSignal,
  RiskAssessment,
  IdentitySnapshot,
  DecisionAction,
  IntelligenceDecision,
  IILEventType,
  IILEvent,
  IILPhaseTransitionEvent,
  IILRiskEscalationEvent,
  IILAnomalyDetectedEvent,
  IILDecisionIssuedEvent,
  IILUserTypeDetectedEvent,
  IILWorkspaceSwitchedEvent,
} from './types';
