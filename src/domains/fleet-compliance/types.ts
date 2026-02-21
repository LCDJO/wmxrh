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

// ════════════════════════════════════════════════════════════════
// ELECTRONIC ENFORCEMENT POINTS (fiscalização eletrônica)
// ════════════════════════════════════════════════════════════════

export interface FleetEnforcementPoint {
  id: string;
  tenant_id: string;
  company_id: string | null;
  name: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  speed_limit_kmh: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateFleetEnforcementPointDTO {
  tenant_id: string;
  company_id?: string | null;
  name?: string | null;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  speed_limit_kmh: number;
}

// ════════════════════════════════════════════════════════════════
// COMPLIANCE INCIDENTS
// ════════════════════════════════════════════════════════════════

export type IncidentStatus = 'pending' | 'reviewed' | 'warning_issued' | 'closed';

export interface FleetComplianceIncident {
  id: string;
  tenant_id: string;
  employee_id: string | null;
  device_id: string;
  company_id: string | null;
  violation_type: string;
  severity: BehaviorSeverity;
  evidence: Record<string, unknown>;
  status: IncidentStatus;
  behavior_event_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ════════════════════════════════════════════════════════════════
// FLEET WARNINGS (advertências)
// ════════════════════════════════════════════════════════════════

export type WarningType = 'verbal' | 'written' | 'suspension' | 'termination';
export type SignatureStatus = 'pending' | 'sent' | 'signed' | 'refused' | 'expired';

export interface FleetWarning {
  id: string;
  tenant_id: string;
  employee_id: string;
  company_id: string | null;
  incident_id: string;
  warning_type: WarningType;
  description: string;
  document_url: string | null;
  signature_request_id: string | null;
  signature_status: SignatureStatus;
  signed_at: string | null;
  issued_by: string | null;
  issued_at: string;
  created_at: string;
  updated_at: string;
}

// ════════════════════════════════════════════════════════════════
// DISCIPLINARY HISTORY (immutable audit trail)
// ════════════════════════════════════════════════════════════════

export type DisciplinaryEventType =
  | 'warning_issued'
  | 'warning_signed'
  | 'warning_refused'
  | 'escalation'
  | 'note_added';

export interface FleetDisciplinaryRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  warning_id: string | null;
  incident_id: string | null;
  event_type: DisciplinaryEventType;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ════════════════════════════════════════════════════════════════
// REQUIRED AGREEMENTS (termos obrigatórios)
// ════════════════════════════════════════════════════════════════

export type FleetAgreementType = 'vehicle_usage' | 'fine_responsibility' | 'gps_monitoring';
export type AgreementSignStatus = 'pending' | 'sent' | 'signed' | 'refused' | 'expired';

export interface FleetRequiredAgreement {
  id: string;
  tenant_id: string;
  company_id: string | null;
  agreement_template_id: string;
  agreement_type: FleetAgreementType;
  is_blocking: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FleetEmployeeAgreementStatus {
  id: string;
  tenant_id: string;
  employee_id: string;
  required_agreement_id: string;
  agreement_type: string;
  status: AgreementSignStatus;
  signed_at: string | null;
  expires_at: string | null;
  document_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Check if employee has all blocking agreements signed.
 * If any blocking agreement is not signed → block fleet usage.
 */
export function isFleetBlocked(
  required: FleetRequiredAgreement[],
  statuses: FleetEmployeeAgreementStatus[]
): { blocked: boolean; missing: FleetAgreementType[] } {
  const blocking = required.filter(r => r.is_blocking && r.is_active);
  const signedIds = new Set(
    statuses.filter(s => s.status === 'signed').map(s => s.required_agreement_id)
  );
  const missing = blocking
    .filter(r => !signedIds.has(r.id))
    .map(r => r.agreement_type);
  return { blocked: missing.length > 0, missing };
}
