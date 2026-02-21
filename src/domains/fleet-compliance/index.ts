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
