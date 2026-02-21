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
  DrivingViolationType,
  DrivingViolation,
} from './types';
