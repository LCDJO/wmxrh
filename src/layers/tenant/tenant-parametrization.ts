/**
 * ══════════════════════════════════════════════════════════
 * TENANT LAYER — Operational Parametrization
 * ══════════════════════════════════════════════════════════
 *
 * Tenant-scoped operational parameters:
 *
 *  · Regras operacionais (operational rules)
 *  · Limites de velocidade (speed limits)
 *  · Política de advertência (warning policy)
 *  · Jornada permitida (allowed work hours)
 *  · Score comportamental (behavioral score config)
 *
 * All parameters are isolated by tenant_id.
 */

// ══════════════════════════════════════════════════════════
// OPERATIONAL RULES (regras operacionais)
// ══════════════════════════════════════════════════════════

export interface TenantOperationalRules {
  id: string;
  tenant_id: string;
  company_id: string | null;

  // ── Fleet rules ──
  /** Allow vehicle usage outside work hours */
  allow_after_hours_usage: boolean;
  /** Maximum continuous driving time in minutes */
  max_continuous_driving_minutes: number;
  /** Required rest break in minutes after max continuous driving */
  required_break_minutes: number;
  /** Allow vehicle usage on weekends */
  allow_weekend_usage: boolean;
  /** Require pre-trip checklist */
  require_pre_trip_checklist: boolean;
  /** Maximum idle time in minutes before alert */
  max_idle_minutes: number;

  // ── HR rules ──
  /** Probation period in days */
  probation_period_days: number;
  /** Auto-send onboarding documents on admission */
  auto_send_onboarding_docs: boolean;
  /** Require digital signature for all warnings */
  require_digital_signature: boolean;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateOperationalRulesDTO {
  tenant_id: string;
  company_id?: string | null;
  allow_after_hours_usage?: boolean;
  max_continuous_driving_minutes?: number;
  required_break_minutes?: number;
  allow_weekend_usage?: boolean;
  require_pre_trip_checklist?: boolean;
  max_idle_minutes?: number;
  probation_period_days?: number;
  auto_send_onboarding_docs?: boolean;
  require_digital_signature?: boolean;
}

// ══════════════════════════════════════════════════════════
// SPEED LIMIT PARAMETRIZATION (detailed)
// ══════════════════════════════════════════════════════════

export interface TenantSpeedConfig {
  id: string;
  tenant_id: string;
  company_id: string | null;

  /** Default global speed limit (km/h) */
  default_limit_kmh: number;
  /** Tolerance % before flagging (e.g. 10 = flag at limit + 10%) */
  tolerance_pct: number;

  /** Zone-specific limits */
  zones: SpeedZone[];

  /** Whether to cross-reference enforcement points */
  use_enforcement_points: boolean;
  /** Whether to escalate repeated violations */
  escalate_repeated: boolean;
  /** Min violations within window to escalate */
  escalation_threshold: number;
  /** Window in hours for escalation counting */
  escalation_window_hours: number;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpeedZone {
  name: string;
  type: 'urban' | 'highway' | 'residential' | 'industrial' | 'custom';
  limit_kmh: number;
  geofence?: { lat: number; lng: number; radius_m: number } | null;
}

// ══════════════════════════════════════════════════════════
// WARNING POLICY (política de advertência)
// ══════════════════════════════════════════════════════════

export interface TenantWarningPolicy {
  id: string;
  tenant_id: string;
  company_id: string | null;

  /** Escalation ladder */
  escalation: WarningEscalationStep[];

  /** Lookback window in days for infraction counting */
  lookback_days: number;
  /** Auto-generate warnings when threshold is reached */
  auto_generate: boolean;
  /** Require manager approval before issuing */
  require_manager_approval: boolean;
  /** Cooldown between same-type infractions (hours) */
  cooldown_hours: number;
  /** Send notification to employee on warning */
  notify_employee: boolean;
  /** Send notification to manager on warning */
  notify_manager: boolean;
  /** Require employee signature */
  require_signature: boolean;
  /** Days allowed for employee to sign */
  signature_deadline_days: number;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarningEscalationStep {
  order: number;
  infraction_count: number;
  action: 'verbal_warning' | 'written_warning' | 'suspension' | 'termination_recommendation';
  description: string;
  suspension_days?: number;
  requires_signature: boolean;
  agreement_template_id?: string;
}

// ══════════════════════════════════════════════════════════
// ALLOWED WORK HOURS (jornada permitida)
// ══════════════════════════════════════════════════════════

export interface TenantWorkSchedule {
  id: string;
  tenant_id: string;
  company_id: string | null;

  /** Schedule name (e.g. "Jornada Padrão 44h") */
  name: string;
  /** Weekly hours (e.g. 44) */
  weekly_hours: number;
  /** Daily schedule per day of week */
  daily_schedules: DailySchedule[];
  /** Allow flexible hours (banco de horas) */
  allow_flexible_hours: boolean;
  /** Maximum overtime hours per month */
  max_overtime_monthly_hours: number;
  /** Night shift surcharge applies */
  night_shift_surcharge: boolean;
  /** Night shift start time (HH:mm) */
  night_shift_start: string;
  /** Night shift end time (HH:mm) */
  night_shift_end: string;
  /** Interval for meals in minutes */
  meal_interval_minutes: number;
  /** Flag vehicle usage outside this schedule */
  flag_out_of_schedule_usage: boolean;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailySchedule {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  is_workday: boolean;
  start_time: string;  // HH:mm
  end_time: string;    // HH:mm
  break_start: string; // HH:mm
  break_end: string;   // HH:mm
}

/**
 * Checks if a given timestamp falls within the allowed work schedule.
 */
export function isWithinWorkSchedule(
  schedule: TenantWorkSchedule,
  timestamp: Date
): { allowed: boolean; dayType: string; reason?: string } {
  const days: DailySchedule['day'][] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];
  const dayKey = days[timestamp.getDay()];
  const daySchedule = schedule.daily_schedules.find(d => d.day === dayKey);

  if (!daySchedule || !daySchedule.is_workday) {
    return { allowed: false, dayType: dayKey, reason: 'Dia não é dia útil' };
  }

  const timeStr = `${String(timestamp.getHours()).padStart(2, '0')}:${String(timestamp.getMinutes()).padStart(2, '0')}`;

  if (timeStr < daySchedule.start_time || timeStr > daySchedule.end_time) {
    return { allowed: false, dayType: dayKey, reason: `Fora do horário permitido (${daySchedule.start_time}-${daySchedule.end_time})` };
  }

  return { allowed: true, dayType: dayKey };
}

// ══════════════════════════════════════════════════════════
// BEHAVIORAL SCORE CONFIG (score comportamental)
// ══════════════════════════════════════════════════════════

export interface TenantBehavioralScoreConfig {
  id: string;
  tenant_id: string;
  company_id: string | null;

  /** Weight multipliers per violation severity */
  severity_weights: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  /** Days for recency decay (violations older than this have 0 weight) */
  recency_decay_days: number;
  /** Bonus points per 30 days without incidents */
  incident_free_bonus: number;
  /** Minimum score before automatic alert */
  alert_threshold: number;
  /** Score below this triggers manager notification */
  critical_threshold: number;
  /** Recalculation frequency in hours */
  recalc_interval_hours: number;
  /** Include formal warnings in score */
  include_warnings: boolean;
  /** Weight for formal warnings */
  warning_weight: number;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBehavioralScoreConfigDTO {
  tenant_id: string;
  company_id?: string | null;
  severity_weights?: TenantBehavioralScoreConfig['severity_weights'];
  recency_decay_days?: number;
  incident_free_bonus?: number;
  alert_threshold?: number;
  critical_threshold?: number;
  recalc_interval_hours?: number;
  include_warnings?: boolean;
  warning_weight?: number;
}

/**
 * Returns default behavioral score configuration for a new tenant.
 */
export function getDefaultBehavioralScoreConfig(tenantId: string): Omit<TenantBehavioralScoreConfig, 'id' | 'created_at' | 'updated_at'> {
  return {
    tenant_id: tenantId,
    company_id: null,
    severity_weights: { low: 2, medium: 5, high: 10, critical: 25 },
    recency_decay_days: 90,
    incident_free_bonus: 3,
    alert_threshold: 60,
    critical_threshold: 40,
    recalc_interval_hours: 24,
    include_warnings: true,
    warning_weight: 8,
    is_active: true,
  };
}
