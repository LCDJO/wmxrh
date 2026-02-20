/**
 * SLA Alert Engine — Contracts for monitoring service-level agreements
 * and triggering automatic announcements on violations.
 *
 * Future: integrates with AnnouncementReactor to auto-create
 * alerts when SLA thresholds are breached.
 */

// ══════════════════════════════════════════════════════════════
// SLA Types
// ══════════════════════════════════════════════════════════════

export type SlaMetric =
  | 'response_time'
  | 'uptime'
  | 'ticket_resolution'
  | 'data_processing'
  | 'exam_scheduling'
  | 'payroll_processing'
  | 'document_signing';

export type SlaStatus = 'healthy' | 'at_risk' | 'breached';

export interface SlaDefinition {
  id: string;
  tenant_id: string;
  metric: SlaMetric;
  /** Human-readable name */
  name: string;
  /** Target value (e.g., 99.9 for uptime %) */
  target_value: number;
  /** Warning threshold (e.g., 99.5) */
  warning_threshold: number;
  /** Critical threshold (e.g., 99.0) */
  critical_threshold: number;
  /** Unit of measurement */
  unit: 'percentage' | 'hours' | 'minutes' | 'days';
  /** Measurement window */
  window: 'hourly' | 'daily' | 'weekly' | 'monthly';
  is_active: boolean;
}

export interface SlaSnapshot {
  definition_id: string;
  metric: SlaMetric;
  current_value: number;
  target_value: number;
  status: SlaStatus;
  measured_at: string;
  /** Trend: positive = improving, negative = degrading */
  trend_pct?: number;
}

export interface SlaViolation {
  id: string;
  tenant_id: string;
  definition_id: string;
  metric: SlaMetric;
  expected_value: number;
  actual_value: number;
  violated_at: string;
  resolved_at?: string;
  announcement_id?: string;
}

// ══════════════════════════════════════════════════════════════
// SLA Alert Engine Interface
// ══════════════════════════════════════════════════════════════

export interface SlaAlertEngine {
  /** Evaluate all SLAs for a tenant and return snapshots */
  evaluate(tenantId: string): Promise<SlaSnapshot[]>;

  /** Check for breaches and trigger announcements */
  checkAndAlert(tenantId: string): Promise<SlaViolation[]>;

  /** Get violation history */
  getViolations(tenantId: string, options?: {
    metric?: SlaMetric;
    status?: 'active' | 'resolved';
    limit?: number;
  }): Promise<SlaViolation[]>;
}

// ══════════════════════════════════════════════════════════════
// Tenant Health Score
// ══════════════════════════════════════════════════════════════

export type HealthDimension =
  | 'compliance'
  | 'financial'
  | 'operational'
  | 'engagement'
  | 'safety';

export interface HealthDimensionScore {
  dimension: HealthDimension;
  score: number; // 0-100
  weight: number; // 0-1
  /** Key factors driving this score */
  factors: HealthFactor[];
  trend: 'improving' | 'stable' | 'degrading';
}

export interface HealthFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  value: string;
  description?: string;
}

export interface TenantHealthScore {
  tenant_id: string;
  overall_score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: HealthDimensionScore[];
  calculated_at: string;
  /** Comparison with previous period */
  previous_score?: number;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface HealthScoreEngine {
  /** Calculate the full health score for a tenant */
  calculate(tenantId: string): Promise<TenantHealthScore>;

  /** Get historical scores */
  getHistory(tenantId: string, options?: {
    period?: 'daily' | 'weekly' | 'monthly';
    limit?: number;
  }): Promise<TenantHealthScore[]>;

  /** Identify critical areas needing attention */
  getAlerts(tenantId: string): Promise<{
    dimension: HealthDimension;
    message: string;
    severity: 'warning' | 'critical';
    suggested_action?: string;
  }[]>;
}

// ══════════════════════════════════════════════════════════════
// Score → Grade mapping
// ══════════════════════════════════════════════════════════════

export function scoreToGrade(score: number): TenantHealthScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export const GRADE_CONFIG: Record<TenantHealthScore['grade'], {
  label: string;
  color: string;
  description: string;
}> = {
  A: { label: 'Excelente', color: 'text-emerald-600', description: 'Cliente em conformidade total com operação saudável' },
  B: { label: 'Bom', color: 'text-primary', description: 'Poucos pontos de atenção, operação estável' },
  C: { label: 'Regular', color: 'text-warning', description: 'Áreas críticas precisam de atenção' },
  D: { label: 'Preocupante', color: 'text-orange-600', description: 'Múltiplos riscos identificados, ação urgente necessária' },
  F: { label: 'Crítico', color: 'text-destructive', description: 'Situação crítica em várias dimensões' },
};
