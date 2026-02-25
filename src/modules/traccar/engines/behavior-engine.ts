/**
 * BehaviorEngine — Infers driving behavior events from position sequences.
 *
 * Detects:
 *  - Overspeed (vs a configurable limit or zone limit)
 *  - Harsh braking (speed drop > threshold between consecutive points)
 *  - Harsh acceleration (speed gain > threshold)
 *  - Excessive idle (ignition ON, speed 0 for > threshold)
 *  - After-hours driving
 *  - Radar violations (delegated from RadarPointEngine)
 */

import type { PositionPoint, BehaviorEvent, RadarViolationEvent } from './types';

const KNOTS_TO_KMH = 1.852;

export interface BehaviorConfig {
  defaultSpeedLimitKmh: number;
  harshBrakeThresholdKmh: number;   // speed drop per interval
  harshAccelThresholdKmh: number;
  excessiveIdleMinutes: number;
  allowedHoursStart: number;        // 0-23
  allowedHoursEnd: number;          // 0-23
}

const DEFAULT_CONFIG: BehaviorConfig = {
  defaultSpeedLimitKmh: 80,
  harshBrakeThresholdKmh: 30,
  harshAccelThresholdKmh: 35,
  excessiveIdleMinutes: 10,
  allowedHoursStart: 6,
  allowedHoursEnd: 22,
};

function severity(excessPct: number): 'low' | 'medium' | 'high' | 'critical' {
  if (excessPct >= 50) return 'critical';
  if (excessPct >= 30) return 'high';
  if (excessPct >= 10) return 'medium';
  return 'low';
}

export function analyzeBehavior(
  positions: PositionPoint[],
  config: Partial<BehaviorConfig> = {},
  opts?: { employeeId?: string | null }
): BehaviorEvent[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (positions.length < 2) return [];

  const sorted = [...positions].sort(
    (a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime()
  );

  const events: BehaviorEvent[] = [];
  let idleStart: string | null = null;
  let idleCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const pos = sorted[i];
    const speedKmh = pos.speed * KNOTS_TO_KMH;

    // ── Overspeed ──
    if (speedKmh > cfg.defaultSpeedLimitKmh) {
      const excess = speedKmh - cfg.defaultSpeedLimitKmh;
      const pct = (excess / cfg.defaultSpeedLimitKmh) * 100;
      events.push({
        device_id: pos.device_id,
        employee_id: opts?.employeeId,
        event_type: 'overspeed',
        severity: severity(pct),
        details: {
          speed_kmh: Math.round(speedKmh),
          limit_kmh: cfg.defaultSpeedLimitKmh,
          excess_kmh: Math.round(excess),
          excess_pct: Math.round(pct),
        },
        event_timestamp: pos.event_timestamp,
        latitude: pos.latitude,
        longitude: pos.longitude,
      });
    }

    // ── Harsh braking / acceleration ──
    if (i > 0) {
      const prevSpeed = sorted[i - 1].speed * KNOTS_TO_KMH;
      const delta = speedKmh - prevSpeed;

      if (delta < -cfg.harshBrakeThresholdKmh) {
        events.push({
          device_id: pos.device_id,
          employee_id: opts?.employeeId,
          event_type: 'harsh_brake',
          severity: Math.abs(delta) > 50 ? 'high' : 'medium',
          details: { speed_before: Math.round(prevSpeed), speed_after: Math.round(speedKmh), delta: Math.round(delta) },
          event_timestamp: pos.event_timestamp,
          latitude: pos.latitude,
          longitude: pos.longitude,
        });
      }

      if (delta > cfg.harshAccelThresholdKmh) {
        events.push({
          device_id: pos.device_id,
          employee_id: opts?.employeeId,
          event_type: 'harsh_accel',
          severity: delta > 50 ? 'high' : 'medium',
          details: { speed_before: Math.round(prevSpeed), speed_after: Math.round(speedKmh), delta: Math.round(delta) },
          event_timestamp: pos.event_timestamp,
          latitude: pos.latitude,
          longitude: pos.longitude,
        });
      }
    }

    // ── Excessive idle ──
    if (pos.ignition === true && speedKmh < 2) {
      if (!idleStart) { idleStart = pos.event_timestamp; idleCount = 1; }
      else idleCount++;
    } else {
      if (idleStart && idleCount > 0) {
        const idleDuration = (new Date(pos.event_timestamp).getTime() - new Date(idleStart).getTime()) / 60000;
        if (idleDuration >= cfg.excessiveIdleMinutes) {
          events.push({
            device_id: pos.device_id,
            employee_id: opts?.employeeId,
            event_type: 'excessive_idle',
            severity: idleDuration > 30 ? 'high' : idleDuration > 15 ? 'medium' : 'low',
            details: { idle_minutes: Math.round(idleDuration), points: idleCount },
            event_timestamp: idleStart,
            latitude: pos.latitude,
            longitude: pos.longitude,
          });
        }
      }
      idleStart = null;
      idleCount = 0;
    }

    // ── After-hours ──
    const hour = new Date(pos.event_timestamp).getHours();
    if (speedKmh > 5 && (hour < cfg.allowedHoursStart || hour >= cfg.allowedHoursEnd)) {
      events.push({
        device_id: pos.device_id,
        employee_id: opts?.employeeId,
        event_type: 'after_hours',
        severity: 'medium',
        details: { hour, speed_kmh: Math.round(speedKmh) },
        event_timestamp: pos.event_timestamp,
        latitude: pos.latitude,
        longitude: pos.longitude,
      });
    }
  }

  return events;
}

/**
 * Convert RadarViolationEvents to BehaviorEvents.
 */
export function radarViolationsToBehavior(violations: RadarViolationEvent[]): BehaviorEvent[] {
  return violations.map(v => ({
    device_id: v.device_id,
    employee_id: v.employee_id,
    event_type: 'radar_violation' as const,
    severity: v.severity,
    details: {
      radar_id: v.radar_id,
      radar_name: v.radar_name,
      recorded_speed: v.recorded_speed_kmh,
      limit: v.speed_limit_kmh,
      excess: v.excess_kmh,
      distance_m: v.distance_to_radar_m,
    },
    event_timestamp: v.detected_at,
    latitude: v.latitude,
    longitude: v.longitude,
  }));
}
