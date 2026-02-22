/**
 * Event Queue Model — Client-side type definitions and topic registry.
 *
 * Topic structure: tenant.{tenant_id}.{domain}
 *
 * Domains: fleet, compliance, risk, workforce, sst
 */

// ── Event Types ──

export const EVENT_TYPES = {
  TRACKING_EVENT: 'TrackingEvent',
  BEHAVIOR_EVENT: 'BehaviorEvent',
  COMPLIANCE_INCIDENT: 'ComplianceIncident',
  EMPLOYEE_OPERATION_BLOCKED: 'EmployeeOperationBlocked',
  RISK_SCORE_UPDATED: 'RiskScoreUpdated',
  WARNING_ISSUED: 'WarningIssued',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

// ── Event Domains ──

export const EVENT_DOMAINS = {
  FLEET: 'fleet',
  COMPLIANCE: 'compliance',
  RISK: 'risk',
  WORKFORCE: 'workforce',
  SST: 'sst',
} as const;

export type EventDomain = typeof EVENT_DOMAINS[keyof typeof EVENT_DOMAINS];

// ── Priority Levels ──

export const EVENT_PRIORITIES = {
  CRITICAL: 'critical' as const,
  HIGH: 'high' as const,
  NORMAL: 'normal' as const,
  LOW: 'low' as const,
};

export type EventPriority = 'critical' | 'high' | 'normal' | 'low';

// ── Event Payloads ──

export interface TrackingEventPayload {
  device_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  ignition: boolean | null;
  event_timestamp: string;
  integrity_hash?: string;
}

export interface BehaviorEventPayload {
  employee_id: string;
  event_type: 'overspeed' | 'harsh_brake' | 'after_hours' | 'geofence_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  speed_kmh?: number;
  speed_limit_kmh?: number;
  location_lat?: number;
  location_lng?: number;
  description: string;
}

export interface ComplianceIncidentPayload {
  employee_id: string;
  incident_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  company_id?: string;
}

export interface EmployeeOperationBlockedPayload {
  employee_id: string;
  block_type: string;
  reason: string;
  blocked_by: string;
}

export interface RiskScoreUpdatedPayload {
  department_id?: string;
  company_id?: string;
  domain: EventDomain;
  old_score: number;
  new_score: number;
  factors: Record<string, number>;
}

export interface WarningIssuedPayload {
  employee_id: string;
  warning_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  document_id?: string;
}

// ── Union type for all payloads ──

export type EventPayload =
  | TrackingEventPayload
  | BehaviorEventPayload
  | ComplianceIncidentPayload
  | EmployeeOperationBlockedPayload
  | RiskScoreUpdatedPayload
  | WarningIssuedPayload;

// ── Event Envelope ──

export interface TenantEvent<T extends EventPayload = EventPayload> {
  id: string;
  tenant_id: string;
  topic: string;
  event_type: EventType;
  partition_key: string;
  sequence_num: number;
  payload: T;
  metadata: Record<string, unknown>;
  source: string;
  correlation_id: string;
  causation_id?: string;
  priority: number;
  status: 'pending' | 'processing' | 'processed' | 'retry' | 'dead_letter' | 'expired';
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  processed_at?: string;
  error_message?: string;
  created_at: string;
  expires_at: string;
}

// ── Dead Letter Entry ──

export interface DeadLetterEntry {
  id: string;
  original_event_id: string;
  tenant_id: string;
  topic: string;
  event_type: string;
  payload: EventPayload;
  metadata: Record<string, unknown>;
  error_message: string;
  error_stack?: string;
  retry_count: number;
  failed_at: string;
  reprocessed: boolean;
  reprocessed_at?: string;
}

// ── Topic Builder ──

export function buildEventTopic(tenantId: string, domain: EventDomain): string {
  return `tenant.${tenantId}.${domain}`;
}

export function parseEventTopic(topic: string): { tenantId: string; domain: EventDomain } | null {
  const parts = topic.split('.');
  if (parts.length !== 3 || parts[0] !== 'tenant') return null;
  return { tenantId: parts[1], domain: parts[2] as EventDomain };
}

// ── Event Type → Domain Mapping ──

export const EVENT_TYPE_DOMAIN_MAP: Record<EventType, EventDomain> = {
  TrackingEvent: 'fleet',
  BehaviorEvent: 'fleet',
  ComplianceIncident: 'compliance',
  EmployeeOperationBlocked: 'compliance',
  RiskScoreUpdated: 'risk',
  WarningIssued: 'compliance',
};

// ── Consumer Group Registry ──

export const CONSUMER_GROUPS = {
  DISPLAY_ENGINE: 'display_engine',
  RISK_AGGREGATOR: 'risk_aggregator',
  NOTIFICATION_SERVICE: 'notification_service',
  AUDIT_LOGGER: 'audit_logger',
} as const;

export type ConsumerGroup = typeof CONSUMER_GROUPS[keyof typeof CONSUMER_GROUPS];

// ── Publish Helper (client-side) ──

export interface PublishEventOptions {
  event_type: EventType;
  domain?: EventDomain;
  payload: EventPayload;
  priority?: EventPriority;
  correlation_id?: string;
  causation_id?: string;
  max_retries?: number;
  ttl_seconds?: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

export function createPublishPayload(tenantId: string, options: PublishEventOptions) {
  return {
    event_type: options.event_type,
    domain: options.domain ?? EVENT_TYPE_DOMAIN_MAP[options.event_type],
    payload: options.payload,
    priority: options.priority ?? 'normal',
    correlation_id: options.correlation_id,
    causation_id: options.causation_id,
    max_retries: options.max_retries ?? 3,
    ttl_seconds: options.ttl_seconds ?? 3600,
    source: options.source ?? 'frontend',
    metadata: options.metadata ?? {},
  };
}
