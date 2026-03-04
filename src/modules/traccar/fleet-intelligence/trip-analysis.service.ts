/**
 * TripAnalysisService — Análise de trajetos e velocidade por tenant.
 */
import { supabase } from '@/integrations/supabase/client';
import { buildTrips, attachViolationsToTrips } from '../engines/trip-builder';
import { detectRadarViolations } from '../engines/radar-point-engine';
import { analyzeBehavior } from '../engines/behavior-engine';
import type { PositionPoint, TripSummary, RadarPoint, BehaviorEvent } from '../engines/types';
import type { BehaviorConfig } from '../engines/behavior-engine';

const db = supabase as any;

export interface TripAnalysisResult {
  trips: TripSummary[];
  behaviorEvents: BehaviorEvent[];
  totalDistance_km: number;
  totalDuration_seconds: number;
  totalViolations: number;
  maxSpeed_kmh: number;
  avgSpeed_kmh: number;
}

export interface TripAnalysisOptions {
  tenantId: string;
  deviceId?: string;
  employeeId?: string;
  from: string;
  to: string;
  behaviorConfig?: Partial<BehaviorConfig>;
  includeRadarCheck?: boolean;
}

export async function analyzeTrips(opts: TripAnalysisOptions): Promise<TripAnalysisResult> {
  const { tenantId, deviceId, employeeId, from, to, behaviorConfig, includeRadarCheck = true } = opts;

  // 1. Busca posições
  let query = db.from('raw_tracking_events').select('*').eq('tenant_id', tenantId).gte('event_timestamp', from).lte('event_timestamp', to).order('event_timestamp', { ascending: true }).limit(5000);
  if (deviceId) query = query.eq('device_id', deviceId);

  const { data: rawPositions, error: posError } = await query;
  if (posError) throw new Error(posError.message);

  const positions: PositionPoint[] = (rawPositions || []).map((r: any) => ({
    id: r.id,
    device_id: r.device_id,
    latitude: r.latitude,
    longitude: r.longitude,
    speed: r.speed ?? 0,
    course: r.course ?? 0,
    ignition: r.ignition ?? null,
    event_timestamp: r.event_timestamp,
    address: r.address ?? null,
    attributes: r.attributes ?? {},
  }));

  if (positions.length === 0) {
    return { trips: [], behaviorEvents: [], totalDistance_km: 0, totalDuration_seconds: 0, totalViolations: 0, maxSpeed_kmh: 0, avgSpeed_kmh: 0 };
  }

  // 2. Viagens
  const trips = buildTrips(positions, { employeeId });

  // 3. Radares
  if (includeRadarCheck) {
    const { data: radarData } = await db.from('tenant_enforcement_points').select('*').eq('tenant_id', tenantId).eq('is_active', true);
    if (radarData && radarData.length > 0) {
      const radars: RadarPoint[] = radarData.map((r: any) => ({
        id: r.id, name: r.name, latitude: r.latitude, longitude: r.longitude,
        speed_limit_kmh: r.speed_limit_kmh, radius_meters: r.radius_meters,
        direction: r.direction_degrees,
        type: r.enforcement_type === 'speed_camera' ? 'fixed' as const : 'mobile' as const,
        is_active: true,
      }));
      const violations = detectRadarViolations(positions, radars, { employeeId });
      attachViolationsToTrips(trips, violations);
    }
  }

  // 4. Comportamento
  const behaviorEvents = analyzeBehavior(positions, behaviorConfig, { employeeId });

  // 5. Agregações
  const totalDistance_km = trips.reduce((s, t) => s + t.distance_km, 0);
  const totalDuration_seconds = trips.reduce((s, t) => s + t.duration_seconds, 0);
  const totalViolations = trips.reduce((s, t) => s + t.violation_count, 0) + behaviorEvents.length;
  const maxSpeed_kmh = trips.reduce((m, t) => Math.max(m, t.max_speed_kmh), 0);
  const avgSpeed_kmh = trips.length > 0 ? trips.reduce((s, t) => s + t.avg_speed_kmh, 0) / trips.length : 0;

  return {
    trips, behaviorEvents,
    totalDistance_km: Math.round(totalDistance_km * 100) / 100,
    totalDuration_seconds, totalViolations,
    maxSpeed_kmh: Math.round(maxSpeed_kmh * 10) / 10,
    avgSpeed_kmh: Math.round(avgSpeed_kmh * 10) / 10,
  };
}

export async function getDailyTrips(tenantId: string, deviceId: string, date: string): Promise<TripAnalysisResult> {
  return analyzeTrips({ tenantId, deviceId, from: `${date}T00:00:00.000Z`, to: `${date}T23:59:59.999Z` });
}

export async function getEmployeeTrips(tenantId: string, employeeId: string, from: string, to: string): Promise<TripAnalysisResult> {
  const { data: device } = await supabase.from('traccar_device_cache').select('traccar_id').eq('tenant_id', tenantId).eq('employee_id', employeeId).maybeSingle();
  return analyzeTrips({ tenantId, deviceId: device ? String((device as any).traccar_id) : undefined, employeeId, from, to });
}
