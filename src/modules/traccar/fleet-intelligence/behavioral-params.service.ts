/**
 * BehavioralParamsService — Definição de parâmetros comportamentais por tenant.
 */
import { supabase } from '@/integrations/supabase/client';
import type { BehaviorConfig } from '../engines/behavior-engine';

const db = supabase as any;

export interface TenantBehavioralParams {
  id: string;
  tenant_id: string;
  default_speed_limit_kmh: number;
  speed_tolerance_pct: number;
  urban_limit_kmh: number;
  highway_limit_kmh: number;
  harsh_brake_threshold_kmh: number;
  harsh_accel_threshold_kmh: number;
  excessive_idle_minutes: number;
  allowed_hours_start: number;
  allowed_hours_end: number;
  risk_score_weights: { speed: number; braking: number; compliance: number; idle: number };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PARAMS = {
  default_speed_limit_kmh: 80,
  speed_tolerance_pct: 10,
  urban_limit_kmh: 60,
  highway_limit_kmh: 110,
  harsh_brake_threshold_kmh: 30,
  harsh_accel_threshold_kmh: 35,
  excessive_idle_minutes: 10,
  allowed_hours_start: 6,
  allowed_hours_end: 22,
  risk_score_weights: { speed: 0.4, braking: 0.2, compliance: 0.3, idle: 0.1 },
  is_active: true,
};

export async function getTenantBehavioralParams(tenantId: string): Promise<TenantBehavioralParams | null> {
  const { data, error } = await db.from('tenant_speed_limit_policies').select('*').eq('tenant_id', tenantId).eq('is_active', true).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    tenant_id: data.tenant_id,
    default_speed_limit_kmh: data.default_limit_kmh ?? DEFAULT_PARAMS.default_speed_limit_kmh,
    speed_tolerance_pct: data.tolerance_pct ?? DEFAULT_PARAMS.speed_tolerance_pct,
    urban_limit_kmh: data.urban_limit_kmh ?? DEFAULT_PARAMS.urban_limit_kmh,
    highway_limit_kmh: data.highway_limit_kmh ?? DEFAULT_PARAMS.highway_limit_kmh,
    harsh_brake_threshold_kmh: DEFAULT_PARAMS.harsh_brake_threshold_kmh,
    harsh_accel_threshold_kmh: DEFAULT_PARAMS.harsh_accel_threshold_kmh,
    excessive_idle_minutes: DEFAULT_PARAMS.excessive_idle_minutes,
    allowed_hours_start: DEFAULT_PARAMS.allowed_hours_start,
    allowed_hours_end: DEFAULT_PARAMS.allowed_hours_end,
    risk_score_weights: DEFAULT_PARAMS.risk_score_weights,
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export function toBehaviorConfig(params: TenantBehavioralParams | null): Partial<BehaviorConfig> {
  if (!params) return {};
  return {
    defaultSpeedLimitKmh: params.default_speed_limit_kmh,
    harshBrakeThresholdKmh: params.harsh_brake_threshold_kmh,
    harshAccelThresholdKmh: params.harsh_accel_threshold_kmh,
    excessiveIdleMinutes: params.excessive_idle_minutes,
    allowedHoursStart: params.allowed_hours_start,
    allowedHoursEnd: params.allowed_hours_end,
  };
}

export function getDefaultBehavioralParams() {
  return { ...DEFAULT_PARAMS };
}
