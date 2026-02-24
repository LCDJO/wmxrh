/**
 * Event Queue Domain — Public API
 */
export { useEventQueue } from './useEventQueue';
export {
  EVENT_TYPES,
  EVENT_DOMAINS,
  EVENT_PRIORITIES,
  CONSUMER_GROUPS,
  EVENT_TYPE_DOMAIN_MAP,
  buildEventTopic,
  buildFleetSubTopic,
  parseEventTopic,
  createPublishPayload,
} from './types';
export type {
  EventType,
  EventDomain,
  EventPriority,
  EventPayload,
  TrackingEventPayload,
  BehaviorEventPayload,
  ComplianceIncidentPayload,
  EmployeeOperationBlockedPayload,
  RiskScoreUpdatedPayload,
  WarningIssuedPayload,
  TenantEvent,
  DeadLetterEntry,
  PublishEventOptions,
  ConsumerGroup,
} from './types';
