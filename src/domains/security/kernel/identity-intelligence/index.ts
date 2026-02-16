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

// ── Types ──
export type {
  IdentityPhase,
  IdentityTrigger,
  IdentityTransition,
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
} from './types';
