/**
 * Risk Heatmap Domain Types
 *
 * Integrates with:
 * - Occupational Risk Engine (severity scoring)
 * - Fleet Compliance Engine (behavior events, incidents)
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface HeatmapCell {
  lat: number;
  lng: number;
  risk_intensity: number;
  risk_level: RiskLevel;
  tracking_events: number;
  behavior_events: number;
  incidents: number;
  severity_breakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  avg_speed: number;
  max_speed: number;
}

export interface RiskCluster {
  id: string;
  lat: number;
  lng: number;
  risk_level: RiskLevel;
  risk_intensity: number;
  incidents: number;
  behavior_events: number;
  severity_breakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export interface HeatmapSummary {
  total_tracking_events: number;
  total_behavior_events: number;
  total_incidents: number;
  critical_zones: number;
  high_risk_zones: number;
  medium_risk_zones: number;
  low_risk_zones: number;
}

export interface HeatmapBounds {
  lat_min: number;
  lat_max: number;
  lng_min: number;
  lng_max: number;
}

export interface HeatmapData {
  grid_size: number;
  bounds: HeatmapBounds;
  days_back: number;
  generated_at: string;
  total_cells: number;
  cells: HeatmapCell[];
  clusters: RiskCluster[];
  summary: HeatmapSummary;
  tenant_id: string;
}

export interface HeatmapFilters {
  tenantId: string;
  bounds?: Partial<HeatmapBounds>;
  gridSize?: number;
  daysBack?: number;
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'hsl(142, 71%, 45%)',      // Green
  medium: 'hsl(48, 96%, 53%)',    // Yellow
  high: 'hsl(25, 95%, 53%)',      // Orange
  critical: 'hsl(0, 84%, 60%)',   // Red
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Normal',
  medium: 'Alerta',
  high: 'Alto Risco',
  critical: 'Crítico',
};
