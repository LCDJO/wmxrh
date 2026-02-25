/**
 * RadarPointEngine — Detects when a position passes near a radar point
 * and generates RadarViolationEvent if speed exceeds limit.
 *
 * Rules:
 *  - Position within radar radius_meters → "passage"
 *  - If speed > speed_limit → RadarViolationEvent
 *  - Severity based on excess percentage
 */

import type { PositionPoint, RadarPoint, RadarViolationEvent } from './types';

const KNOTS_TO_KMH = 1.852;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifySeverity(excessPct: number): 'low' | 'medium' | 'high' | 'critical' {
  if (excessPct >= 50) return 'critical';
  if (excessPct >= 30) return 'high';
  if (excessPct >= 10) return 'medium';
  return 'low';
}

/**
 * Scan positions against radar points and return violations.
 * Deduplicates: one violation per radar per device per 60s window.
 */
export function detectRadarViolations(
  positions: PositionPoint[],
  radars: RadarPoint[],
  opts?: { employeeId?: string | null }
): RadarViolationEvent[] {
  if (!radars.length || !positions.length) return [];

  const activeRadars = radars.filter(r => r.is_active);
  const violations: RadarViolationEvent[] = [];
  const dedup = new Set<string>(); // "radarId:deviceId:minuteBucket"

  for (const pos of positions) {
    const speedKmh = pos.speed * KNOTS_TO_KMH;

    for (const radar of activeRadars) {
      const dist = haversineMeters(pos.latitude, pos.longitude, radar.latitude, radar.longitude);

      if (dist <= radar.radius_meters && speedKmh > radar.speed_limit_kmh) {
        const minute = Math.floor(new Date(pos.event_timestamp).getTime() / 60000);
        const key = `${radar.id}:${pos.device_id}:${minute}`;
        if (dedup.has(key)) continue;
        dedup.add(key);

        const excess = speedKmh - radar.speed_limit_kmh;
        const excessPct = (excess / radar.speed_limit_kmh) * 100;

        violations.push({
          radar_id: radar.id,
          radar_name: radar.name,
          device_id: pos.device_id,
          employee_id: opts?.employeeId ?? null,
          latitude: pos.latitude,
          longitude: pos.longitude,
          recorded_speed_kmh: Math.round(speedKmh * 10) / 10,
          speed_limit_kmh: radar.speed_limit_kmh,
          excess_kmh: Math.round(excess * 10) / 10,
          excess_pct: Math.round(excessPct * 10) / 10,
          severity: classifySeverity(excessPct),
          detected_at: pos.event_timestamp,
          distance_to_radar_m: Math.round(dist),
        });
      }
    }
  }

  return violations;
}
