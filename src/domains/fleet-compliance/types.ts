/**
 * Fleet Compliance & Tracking Engine — Domain Types
 *
 * Bounded Context: Fleet vehicle tracking, driving behavior monitoring,
 * automatic warnings, and legal protection.
 *
 * Integrates with: Employee Agreement, Asset & EPI, Safety Automation,
 * Workforce Intelligence, Security Kernel, Legal AI.
 */

// ════════════════════════════════════════════════════════════════
// RAW EVENT (immutable, append-only)
// ════════════════════════════════════════════════════════════════

export interface RawTrackingEvent {
  id: string;
  tenant_id: string;
  device_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  ignition: boolean | null;
  event_timestamp: string;
  raw_payload: Record<string, unknown> | null;
  ingested_at: string;
}

// ════════════════════════════════════════════════════════════════
// FLEET PROVIDER CONFIG
// ════════════════════════════════════════════════════════════════

export interface FleetProviderConfig {
  id: string;
  tenant_id: string;
  provider_name: string;
  api_url: string;
  api_token: string;
  webhook_secret: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateFleetProviderConfigDTO {
  tenant_id: string;
  provider_name?: string;
  api_url: string;
  api_token: string;
  webhook_secret?: string | null;
  is_active?: boolean;
}

// ════════════════════════════════════════════════════════════════
// INGEST DTO
// ════════════════════════════════════════════════════════════════

export interface IngestTrackingEventDTO {
  device_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  ignition?: boolean | null;
  event_timestamp: string;
  raw_payload?: Record<string, unknown>;
}

// ════════════════════════════════════════════════════════════════
// DEVICE REGISTRY
// ════════════════════════════════════════════════════════════════

export type FleetDeviceType = 'moto' | 'carro' | 'celular';

export interface FleetDevice {
  id: string;
  tenant_id: string;
  company_id: string;
  device_type: FleetDeviceType;
  plate: string | null;
  model: string | null;
  serial_number: string;
  employee_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateFleetDeviceDTO {
  tenant_id: string;
  company_id: string;
  device_type: FleetDeviceType;
  plate?: string | null;
  model?: string | null;
  serial_number: string;
  employee_id?: string | null;
  is_active?: boolean;
}

// ════════════════════════════════════════════════════════════════
// DRIVING RULES (configurable per company)
// ════════════════════════════════════════════════════════════════

export interface FleetDrivingRules {
  id: string;
  tenant_id: string;
  company_id: string;
  speed_limit_kmh: number;
  allowed_hours_start: string;
  allowed_hours_end: string;
  geofence_polygon: Record<string, unknown> | null;
  planned_route: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateFleetDrivingRulesDTO {
  tenant_id: string;
  company_id: string;
  speed_limit_kmh?: number;
  allowed_hours_start?: string;
  allowed_hours_end?: string;
  geofence_polygon?: Record<string, unknown> | null;
  planned_route?: Record<string, unknown> | null;
}

// ════════════════════════════════════════════════════════════════
// BEHAVIOR EVENTS (immutable, append-only)
// ════════════════════════════════════════════════════════════════

export type BehaviorEventType =
  | 'overspeed'
  | 'geofence_violation'
  | 'route_deviation'
  | 'after_hours_use';

export type BehaviorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FleetBehaviorEvent {
  id: string;
  tenant_id: string;
  device_id: string;
  employee_id: string | null;
  company_id: string | null;
  event_type: BehaviorEventType;
  severity: BehaviorSeverity;
  details: Record<string, unknown>;
  source_event_id: string | null;
  event_timestamp: string;
  created_at: string;
}

// Legacy alias
export type DrivingViolationType = BehaviorEventType;
export type DrivingViolation = FleetBehaviorEvent;
