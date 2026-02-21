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
// DRIVING BEHAVIOR (future analysis)
// ════════════════════════════════════════════════════════════════

export type DrivingViolationType =
  | 'speeding'
  | 'harsh_braking'
  | 'harsh_acceleration'
  | 'off_hours_usage'
  | 'route_deviation'
  | 'idle_excess';

export interface DrivingViolation {
  id: string;
  tenant_id: string;
  device_id: string;
  employee_id: string | null;
  violation_type: DrivingViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, unknown>;
  event_timestamp: string;
  created_at: string;
}
