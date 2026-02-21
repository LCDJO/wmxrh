/**
 * ══════════════════════════════════════════════════════════
 * TENANT LAYER — Traccar Configuration & Policies
 * ══════════════════════════════════════════════════════════
 *
 * Tenant-scoped configuration for Traccar integration:
 *
 *  · Endpoint & API Token (encrypted)
 *  · Device ↔ Vehicle ↔ Employee mapping
 *  · Speed limits (global + per-zone)
 *  · Enforcement points (pontos de fiscalização)
 *  · Disciplinary policy (progressive escalation)
 */

// ══════════════════════════════════════════════════════════
// TENANT TRACCAR ENDPOINT CONFIG
// ══════════════════════════════════════════════════════════

export interface TenantTraccarConfig {
  id: string;
  tenant_id: string;
  /** Traccar server base URL (e.g. https://traccar.clientecorp.com) */
  api_url: string;
  /** Encrypted API token — write-only in UI */
  api_token_encrypted: string;
  /** Webhook secret for inbound events — write-only in UI */
  webhook_secret_encrypted: string | null;
  /** Protocol used by tenant's devices */
  protocol: TraccarProtocol;
  /** Auto-sync devices from Traccar API */
  auto_sync_devices: boolean;
  /** Sync interval in minutes */
  sync_interval_minutes: number;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TraccarProtocol =
  | 'osmand'
  | 'teltonika'
  | 'gt06'
  | 'h02'
  | 'tk103'
  | 'meitrack'
  | 'suntech'
  | 'other';

export interface CreateTenantTraccarConfigDTO {
  tenant_id: string;
  api_url: string;
  api_token: string;            // plain text — encrypted on write
  webhook_secret?: string;      // plain text — encrypted on write
  protocol?: TraccarProtocol;
  auto_sync_devices?: boolean;
  sync_interval_minutes?: number;
}

// ══════════════════════════════════════════════════════════
// DEVICE ↔ VEHICLE ↔ EMPLOYEE MAPPING
// ══════════════════════════════════════════════════════════

export interface TenantDeviceMapping {
  id: string;
  tenant_id: string;
  /** Traccar device unique ID */
  traccar_device_id: string;
  /** Internal fleet device ID (our system) */
  fleet_device_id: string;
  /** Vehicle linked to this device */
  vehicle_id: string | null;
  /** Current driver assigned */
  employee_id: string | null;
  /** Human-readable label */
  label: string | null;
  /** SIM card number */
  sim_number: string | null;
  is_active: boolean;
  mapped_at: string;
  updated_at: string;
}

export interface CreateDeviceMappingDTO {
  tenant_id: string;
  traccar_device_id: string;
  fleet_device_id: string;
  vehicle_id?: string | null;
  employee_id?: string | null;
  label?: string | null;
  sim_number?: string | null;
}

// ══════════════════════════════════════════════════════════
// SPEED LIMITS (tenant configurable)
// ══════════════════════════════════════════════════════════

export interface TenantSpeedLimitPolicy {
  id: string;
  tenant_id: string;
  company_id: string | null;
  /** Default global speed limit in km/h */
  default_limit_kmh: number;
  /** Tolerance percentage before flagging (e.g., 10 = flag at 110% of limit) */
  tolerance_pct: number;
  /** Urban area speed limit */
  urban_limit_kmh: number;
  /** Highway speed limit */
  highway_limit_kmh: number;
  /** Residential / low-speed zone limit */
  residential_limit_kmh: number;
  /** Whether to apply limits from enforcement points when inside radius */
  use_enforcement_points: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSpeedLimitPolicyDTO {
  tenant_id: string;
  company_id?: string | null;
  default_limit_kmh?: number;
  tolerance_pct?: number;
  urban_limit_kmh?: number;
  highway_limit_kmh?: number;
  residential_limit_kmh?: number;
  use_enforcement_points?: boolean;
}

// ══════════════════════════════════════════════════════════
// ENFORCEMENT POINTS (pontos de fiscalização)
// ══════════════════════════════════════════════════════════

export interface TenantEnforcementPoint {
  id: string;
  tenant_id: string;
  company_id: string | null;
  /** Human-readable name (e.g. "Radar BR-116 km 42") */
  name: string;
  latitude: number;
  longitude: number;
  /** Detection radius in meters */
  radius_meters: number;
  /** Posted speed limit at this point */
  speed_limit_kmh: number;
  /** Type of enforcement */
  enforcement_type: EnforcementType;
  /** Direction of enforcement (optional, degrees 0-360) */
  direction_degrees: number | null;
  /** Whether this point is currently active */
  is_active: boolean;
  /** Source of data */
  source: EnforcementSource;
  created_at: string;
  updated_at: string;
}

export type EnforcementType = 'speed_camera' | 'red_light' | 'toll' | 'checkpoint' | 'custom';
export type EnforcementSource = 'manual' | 'imported' | 'api_sync';

export interface CreateEnforcementPointDTO {
  tenant_id: string;
  company_id?: string | null;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  speed_limit_kmh: number;
  enforcement_type?: EnforcementType;
  direction_degrees?: number | null;
  source?: EnforcementSource;
}

// ══════════════════════════════════════════════════════════
// DISCIPLINARY POLICY (política disciplinar progressiva)
// ══════════════════════════════════════════════════════════

export interface TenantDisciplinaryPolicy {
  id: string;
  tenant_id: string;
  company_id: string | null;
  /** Policy name (e.g. "Política de Velocidade — Padrão") */
  name: string;
  /** Escalation steps in order */
  escalation_steps: DisciplinaryEscalationStep[];
  /** Days to look back for infraction count */
  lookback_days: number;
  /** Whether to auto-generate warnings */
  auto_generate_warnings: boolean;
  /** Require manager approval before issuing */
  require_approval: boolean;
  /** Grace period in hours between infractions */
  cooldown_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DisciplinaryEscalationStep {
  /** Step order (1, 2, 3...) */
  order: number;
  /** Infraction count threshold that triggers this step */
  infraction_threshold: number;
  /** Type of action */
  action: DisciplinaryAction;
  /** Description shown in the warning document */
  description: string;
  /** Suspension duration in days (only for 'suspension') */
  suspension_days?: number;
  /** Whether the employee must sign a term */
  requires_signature: boolean;
  /** Agreement template to use (if requires_signature) */
  agreement_template_id?: string;
}

export type DisciplinaryAction =
  | 'verbal_warning'
  | 'written_warning'
  | 'suspension'
  | 'termination_recommendation';

export interface CreateDisciplinaryPolicyDTO {
  tenant_id: string;
  company_id?: string | null;
  name: string;
  escalation_steps: DisciplinaryEscalationStep[];
  lookback_days?: number;
  auto_generate_warnings?: boolean;
  require_approval?: boolean;
  cooldown_hours?: number;
}

// ══════════════════════════════════════════════════════════
// DISCIPLINARY ENGINE (evaluator)
// ══════════════════════════════════════════════════════════

export interface DisciplinaryEvaluation {
  employeeId: string;
  infractionCount: number;
  currentStep: DisciplinaryEscalationStep | null;
  nextStep: DisciplinaryEscalationStep | null;
  shouldEscalate: boolean;
  action: DisciplinaryAction | null;
}

/**
 * Evaluates the disciplinary action for an employee based on
 * their infraction count and the tenant's policy.
 */
export function evaluateDisciplinaryAction(
  policy: TenantDisciplinaryPolicy,
  employeeId: string,
  infractionCount: number
): DisciplinaryEvaluation {
  const sortedSteps = [...policy.escalation_steps].sort((a, b) => a.order - b.order);

  let currentStep: DisciplinaryEscalationStep | null = null;
  let nextStep: DisciplinaryEscalationStep | null = null;

  for (let i = 0; i < sortedSteps.length; i++) {
    if (infractionCount >= sortedSteps[i].infraction_threshold) {
      currentStep = sortedSteps[i];
      nextStep = sortedSteps[i + 1] ?? null;
    }
  }

  return {
    employeeId,
    infractionCount,
    currentStep,
    nextStep,
    shouldEscalate: currentStep !== null,
    action: currentStep?.action ?? null,
  };
}

/**
 * Checks if an enforcement point is within detection range of a coordinate.
 */
export function isWithinEnforcementZone(
  point: TenantEnforcementPoint,
  lat: number,
  lon: number
): boolean {
  const R = 6371000; // Earth radius in meters
  const dLat = (point.latitude - lat) * (Math.PI / 180);
  const dLon = (point.longitude - lon) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat * (Math.PI / 180)) *
    Math.cos(point.latitude * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distance <= point.radius_meters;
}
