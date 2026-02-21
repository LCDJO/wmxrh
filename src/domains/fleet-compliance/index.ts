/**
 * Fleet Compliance & Tracking Engine — Bounded Context
 *
 * Manages GPS tracking integration (Traccar), driving behavior
 * monitoring, automatic warnings, and legal protection.
 */

export type {
  RawTrackingEvent,
  IngestTrackingEventDTO,
  FleetProviderConfig,
  CreateFleetProviderConfigDTO,
  FleetDevice,
  FleetDeviceType,
  CreateFleetDeviceDTO,
  FleetDrivingRules,
  CreateFleetDrivingRulesDTO,
  BehaviorEventType,
  BehaviorSeverity,
  FleetBehaviorEvent,
  DrivingViolationType,
  DrivingViolation,
  FleetEnforcementPoint,
  CreateFleetEnforcementPointDTO,
  IncidentStatus,
  FleetComplianceIncident,
  WarningType,
  SignatureStatus,
  FleetWarning,
  DisciplinaryEventType,
  FleetDisciplinaryRecord,
  FleetAgreementType,
  AgreementSignStatus,
  FleetRequiredAgreement,
  FleetEmployeeAgreementStatus,
  FleetAuditActorType,
  FleetAuditLogEntry,
} from './types';

export { isFleetBlocked } from './types';

// ── Workforce Intelligence Integration ──
export { generateFleetInsights } from './fleet-workforce-integration.engine';
export type { FleetWiIntegrationInput } from './fleet-workforce-integration.engine';

// ── Behavioral Score Engine ──
export { computeBehavioralScore, computeBatchScores } from './behavioral-score.engine';
export type { BehavioralScoreInput, BehavioralScoreResult } from './behavioral-score.engine';

// ── Accident Prediction (heuristic fallback) ──
export { estimateAccidentRisk } from './accident-prediction.types';
export type {
  AccidentPredictionFeatures,
  AccidentPrediction,
  AccidentRiskLevel,
  AccidentRiskFactor,
  AccidentPredictionService,
} from './accident-prediction.types';

// ── DETRAN & Fine Integration (future) ──
export type {
  DetranState,
  DetranProviderConfig,
  DetranVehicleRecord,
  DetranDriverRecord,
  DetranAdapter,
  TrafficFine,
  FineStatus,
  FineSeverity,
  FineAssignmentRule,
} from './detran-integration.types';
