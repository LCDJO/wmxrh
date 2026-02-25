/**
 * BTIE Engine Types — Shared output types for all engines.
 */

// ── TripBuilder ──

export interface PositionPoint {
  id: string;
  device_id: string;
  latitude: number;
  longitude: number;
  speed: number;        // knots from Traccar, convert to km/h
  course: number;
  ignition: boolean | null;
  event_timestamp: string;
  address?: string | null;
  attributes?: Record<string, unknown>;
}

export interface TripSummary {
  device_id: string;
  device_name?: string;
  employee_id?: string | null;
  start_time: string;
  end_time: string;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  start_address?: string | null;
  end_address?: string | null;
  distance_km: number;
  duration_seconds: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  position_count: number;
  positions: PositionPoint[];
  violation_count: number;
  radar_violations: RadarViolationEvent[];
}

// ── RadarPointEngine ──

export interface RadarPoint {
  id: string;
  name: string | null;
  latitude: number;
  longitude: number;
  speed_limit_kmh: number;
  radius_meters: number;
  direction?: number | null;
  type: 'fixed' | 'mobile' | 'average_speed';
  is_active: boolean;
}

export interface RadarViolationEvent {
  radar_id: string;
  radar_name: string | null;
  device_id: string;
  employee_id?: string | null;
  latitude: number;
  longitude: number;
  recorded_speed_kmh: number;
  speed_limit_kmh: number;
  excess_kmh: number;
  excess_pct: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;
  distance_to_radar_m: number;
}

// ── BehaviorEngine ──

export type BehaviorEventKind =
  | 'overspeed'
  | 'harsh_brake'
  | 'harsh_accel'
  | 'excessive_idle'
  | 'after_hours'
  | 'geofence_violation'
  | 'radar_violation'
  | 'unauthorized_route';

export interface BehaviorEvent {
  device_id: string;
  employee_id?: string | null;
  event_type: BehaviorEventKind;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, unknown>;
  event_timestamp: string;
  latitude?: number;
  longitude?: number;
}

// ── DriverRiskScoreEngine ──

export interface DriverRiskScore {
  employee_id: string;
  employee_name?: string;
  overall_score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  speed_score: number;
  braking_score: number;
  compliance_score: number;
  idle_score: number;
  total_trips: number;
  total_distance_km: number;
  total_violations: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  period_start: string;
  period_end: string;
}

// ── TrafficHotspotAnalyzer ──

export interface TrafficHotspot {
  lat: number;
  lng: number;
  intensity: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  violation_count: number;
  event_types: Record<string, number>;
  avg_excess_kmh: number;
  devices: string[];
}

export interface HotspotGrid {
  cell_size_deg: number;
  hotspots: TrafficHotspot[];
  bounds: { lat_min: number; lat_max: number; lng_min: number; lng_max: number };
  generated_at: string;
}
