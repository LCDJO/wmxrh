/**
 * TrafficHotspotAnalyzer — Aggregates behavior events into a spatial grid
 * to identify violation hotspots for heatmap rendering.
 *
 * Pure function — no I/O.
 */

import type { BehaviorEvent, TrafficHotspot, HotspotGrid } from './types';

const DEFAULT_CELL_SIZE = 0.005; // ~500m at equator

export interface HotspotConfig {
  cellSizeDeg?: number;
}

export function analyzeHotspots(
  events: BehaviorEvent[],
  config?: HotspotConfig
): HotspotGrid {
  const cellSize = config?.cellSizeDeg ?? DEFAULT_CELL_SIZE;
  const geoEvents = events.filter(e => e.latitude != null && e.longitude != null);

  if (geoEvents.length === 0) {
    return {
      cell_size_deg: cellSize,
      hotspots: [],
      bounds: { lat_min: 0, lat_max: 0, lng_min: 0, lng_max: 0 },
      generated_at: new Date().toISOString(),
    };
  }

  // ── Grid aggregation ──
  const cells = new Map<string, {
    lat_sum: number;
    lng_sum: number;
    count: number;
    severity_sum: number;
    excess_sum: number;
    types: Record<string, number>;
    devices: Set<string>;
  }>();

  const sevWeight = { low: 1, medium: 3, high: 7, critical: 15 };

  let latMin = Infinity, latMax = -Infinity, lngMin = Infinity, lngMax = -Infinity;

  for (const evt of geoEvents) {
    const lat = evt.latitude!;
    const lng = evt.longitude!;

    latMin = Math.min(latMin, lat);
    latMax = Math.max(latMax, lat);
    lngMin = Math.min(lngMin, lng);
    lngMax = Math.max(lngMax, lng);

    const cellKey = `${Math.floor(lat / cellSize)}:${Math.floor(lng / cellSize)}`;

    if (!cells.has(cellKey)) {
      cells.set(cellKey, {
        lat_sum: 0, lng_sum: 0, count: 0,
        severity_sum: 0, excess_sum: 0,
        types: {}, devices: new Set(),
      });
    }

    const cell = cells.get(cellKey)!;
    cell.lat_sum += lat;
    cell.lng_sum += lng;
    cell.count++;
    cell.severity_sum += sevWeight[evt.severity] || 1;
    cell.excess_sum += (evt.details?.excess_kmh as number) || 0;
    cell.types[evt.event_type] = (cell.types[evt.event_type] || 0) + 1;
    cell.devices.add(evt.device_id);
  }

  // ── Build hotspots ──
  const hotspots: TrafficHotspot[] = [];

  for (const cell of cells.values()) {
    const intensity = cell.severity_sum;
    const riskLevel = intensity >= 50 ? 'critical' : intensity >= 25 ? 'high' : intensity >= 10 ? 'medium' : 'low';

    hotspots.push({
      lat: cell.lat_sum / cell.count,
      lng: cell.lng_sum / cell.count,
      intensity,
      risk_level: riskLevel,
      violation_count: cell.count,
      event_types: { ...cell.types },
      avg_excess_kmh: cell.count > 0 ? Math.round((cell.excess_sum / cell.count) * 10) / 10 : 0,
      devices: Array.from(cell.devices),
    });
  }

  // Sort by intensity descending
  hotspots.sort((a, b) => b.intensity - a.intensity);

  return {
    cell_size_deg: cellSize,
    hotspots,
    bounds: { lat_min: latMin, lat_max: latMax, lng_min: lngMin, lng_max: lngMax },
    generated_at: new Date().toISOString(),
  };
}
