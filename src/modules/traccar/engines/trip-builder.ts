/**
 * TripBuilder — Groups positions by ignition gaps and builds TripSummary.
 *
 * Rules:
 *  - Split trip when ignition goes OFF→ON
 *  - Split trip when gap between positions > GAP_THRESHOLD_MS
 *  - Calculate distance using Haversine
 *  - Calculate avg/max speed in km/h (Traccar speed is in knots)
 */

import type { PositionPoint, TripSummary, RadarViolationEvent } from './types';

const GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const KNOTS_TO_KMH = 1.852;

// ── Haversine ──

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Builder ──

export function buildTrips(
  positions: PositionPoint[],
  opts?: { deviceName?: string; employeeId?: string | null }
): TripSummary[] {
  if (positions.length < 2) return [];

  // Sort by timestamp
  const sorted = [...positions].sort(
    (a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime()
  );

  const trips: TripSummary[] = [];
  let segment: PositionPoint[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = new Date(curr.event_timestamp).getTime() - new Date(prev.event_timestamp).getTime();

    // Split conditions
    const ignitionOff = prev.ignition === true && curr.ignition === false;
    const gapExceeded = gap > GAP_THRESHOLD_MS;

    if (ignitionOff || gapExceeded) {
      if (segment.length >= 2) {
        trips.push(buildSingleTrip(segment, opts));
      }
      segment = [curr];
    } else {
      segment.push(curr);
    }
  }

  // Last segment
  if (segment.length >= 2) {
    trips.push(buildSingleTrip(segment, opts));
  }

  return trips;
}

function buildSingleTrip(
  positions: PositionPoint[],
  opts?: { deviceName?: string; employeeId?: string | null }
): TripSummary {
  const first = positions[0];
  const last = positions[positions.length - 1];

  let totalDistance = 0;
  let maxSpeedKmh = 0;
  let speedSum = 0;

  for (let i = 0; i < positions.length; i++) {
    const speedKmh = positions[i].speed * KNOTS_TO_KMH;
    speedSum += speedKmh;
    if (speedKmh > maxSpeedKmh) maxSpeedKmh = speedKmh;

    if (i > 0) {
      totalDistance += haversineKm(
        positions[i - 1].latitude, positions[i - 1].longitude,
        positions[i].latitude, positions[i].longitude
      );
    }
  }

  const avgSpeedKmh = speedSum / positions.length;
  const durationMs = new Date(last.event_timestamp).getTime() - new Date(first.event_timestamp).getTime();

  return {
    device_id: first.device_id,
    device_name: opts?.deviceName,
    employee_id: opts?.employeeId ?? null,
    start_time: first.event_timestamp,
    end_time: last.event_timestamp,
    start_lat: first.latitude,
    start_lng: first.longitude,
    end_lat: last.latitude,
    end_lng: last.longitude,
    start_address: first.address,
    end_address: last.address,
    distance_km: Math.round(totalDistance * 100) / 100,
    duration_seconds: Math.round(durationMs / 1000),
    avg_speed_kmh: Math.round(avgSpeedKmh * 10) / 10,
    max_speed_kmh: Math.round(maxSpeedKmh * 10) / 10,
    position_count: positions.length,
    positions,
    violation_count: 0,
    radar_violations: [],
  };
}

/**
 * Attach radar violations to the matching trip (mutates trip).
 */
export function attachViolationsToTrips(
  trips: TripSummary[],
  violations: RadarViolationEvent[]
): void {
  for (const v of violations) {
    const ts = new Date(v.detected_at).getTime();
    for (const trip of trips) {
      const start = new Date(trip.start_time).getTime();
      const end = new Date(trip.end_time).getTime();
      if (v.device_id === trip.device_id && ts >= start && ts <= end) {
        trip.radar_violations.push(v);
        trip.violation_count++;
        break;
      }
    }
  }
}
