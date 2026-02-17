/**
 * Smart Rollback Engine — Types
 *
 * Platform-level autonomous recovery for landing pages.
 * Executes safe rollbacks between already-approved/published versions.
 */

// ── Conversion Monitoring ──

export interface ConversionSnapshot {
  landingPageId: string;
  versionId: string;
  versionNumber: number;
  /** Conversion rate as percentage (0–100) */
  conversionRate: number;
  /** Total conversions in sample window */
  conversions: number;
  /** Total impressions in sample window */
  impressions: number;
  /** Revenue generated in sample window */
  revenue: number;
  /** Bounce rate as percentage */
  bounceRate: number;
  /** Timestamp of snapshot */
  capturedAt: string;
}

export interface PerformanceComparison {
  currentVersion: ConversionSnapshot;
  previousVersion: ConversionSnapshot;
  /** Relative change: (current - previous) / previous * 100 */
  conversionRateDelta: number;
  revenueDelta: number;
  bounceRateDelta: number;
  /** True if degradation exceeds threshold */
  isDegraded: boolean;
  /** Confidence level of the comparison (0–100) */
  confidence: number;
  comparedAt: string;
}

// ── Rollback Decision ──

export type RollbackReason =
  | 'conversion_drop'
  | 'revenue_drop'
  | 'bounce_spike'
  | 'combined_degradation'
  | 'manual_trigger';

export type RollbackMode = 'automatic' | 'suggested' | 'manual';

export interface RollbackDecision {
  id: string;
  landingPageId: string;
  currentVersionId: string;
  targetVersionId: string;
  currentVersionNumber: number;
  targetVersionNumber: number;
  reason: RollbackReason;
  mode: RollbackMode;
  comparison: PerformanceComparison;
  decidedAt: string;
  /** Whether the decision was approved (null = pending) */
  approved: boolean | null;
  approvedBy?: string;
  executedAt?: string;
}

// ── Rollback Execution ──

export type RollbackStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';

export interface RollbackExecution {
  id: string;
  decisionId: string;
  landingPageId: string;
  fromVersionId: string;
  toVersionId: string;
  fromVersionNumber: number;
  toVersionNumber: number;
  status: RollbackStatus;
  reason: RollbackReason;
  mode: RollbackMode;
  executedBy: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

// ── Audit ──

export interface RollbackAuditEntry {
  id: string;
  executionId: string;
  landingPageId: string;
  action: 'rollback_initiated' | 'rollback_completed' | 'rollback_failed' | 'rollback_suggested' | 'rollback_cancelled';
  fromVersion: number;
  toVersion: number;
  reason: RollbackReason;
  mode: RollbackMode;
  actorId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Configuration ──

export interface RollbackThresholds {
  /** Minimum conversion rate drop (%) to trigger rollback consideration */
  conversionDropThreshold: number;
  /** Minimum revenue drop (%) to trigger rollback consideration */
  revenueDropThreshold: number;
  /** Minimum bounce rate increase (%) to trigger rollback consideration */
  bounceRateIncreaseThreshold: number;
  /** Minimum sample size before making decisions */
  minimumSampleSize: number;
  /** Minimum confidence level (0–100) to auto-rollback */
  autoRollbackConfidenceThreshold: number;
  /** Cool-down period (ms) after a rollback before another can be triggered */
  cooldownMs: number;
  /** Observation window (ms) after a publish before monitoring begins */
  observationWindowMs: number;
}

export const DEFAULT_ROLLBACK_THRESHOLDS: RollbackThresholds = {
  conversionDropThreshold: 20,
  revenueDropThreshold: 25,
  bounceRateIncreaseThreshold: 30,
  minimumSampleSize: 100,
  autoRollbackConfidenceThreshold: 85,
  cooldownMs: 4 * 60 * 60 * 1000, // 4 hours
  observationWindowMs: 30 * 60 * 1000, // 30 minutes
};
