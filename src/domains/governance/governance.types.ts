/**
 * Governance Module — Domain Types
 *
 * Types for Visual Audit, Compliance Automation, and Predictive Risk Analysis.
 * All three features consume UGE data (READ-ONLY).
 */

import type { RiskLevel, GraphDomain } from '@/domains/security/kernel/unified-graph-engine';

// ════════════════════════════════════
// 1. VISUAL AUDIT
// ════════════════════════════════════

export interface AuditSnapshot {
  id: string;
  tenant_id: string;
  snapshot_type: 'full' | 'tenant' | 'incremental';
  node_count: number;
  edge_count: number;
  role_count: number;
  permission_count: number;
  user_count: number;
  risk_level: RiskLevel;
  risk_signals: AuditRiskSignal[];
  anomalies: AuditAnomaly[];
  role_overlaps: AuditRoleOverlap[];
  excessive_permissions: AuditExcessivePermission[];
  orphan_nodes: AuditOrphanNode[];
  composition_time_ms: number;
  created_by: string | null;
  created_at: string;
}

export interface AuditRiskSignal {
  id: string;
  level: RiskLevel;
  domain: GraphDomain;
  title: string;
  detail: string;
  affected_count: number;
}

export interface AuditAnomaly {
  kind: string;
  severity: RiskLevel;
  title: string;
  detail: string;
  affected_node_uids: string[];
}

export interface AuditRoleOverlap {
  role_a: string;
  role_b: string;
  overlap_ratio: number;
  shared_count: number;
}

export interface AuditExcessivePermission {
  user_label: string;
  permission_count: number;
  domain: GraphDomain;
}

export interface AuditOrphanNode {
  uid: string;
  label: string;
  type: string;
  domain: GraphDomain;
}

export interface AuditComparisonResult {
  previous: AuditSnapshot;
  current: AuditSnapshot;
  deltas: {
    node_count: number;
    edge_count: number;
    role_count: number;
    permission_count: number;
    user_count: number;
    risk_level_changed: boolean;
    new_anomalies: AuditAnomaly[];
    resolved_anomalies: AuditAnomaly[];
    new_overlaps: AuditRoleOverlap[];
  };
}

// ════════════════════════════════════
// 2. COMPLIANCE AUTOMATION
// ════════════════════════════════════

export type ComplianceRuleSeverity = 'info' | 'warning' | 'critical';
export type ComplianceRuleStatus = 'active' | 'disabled' | 'archived';

export type ComplianceRuleCategory =
  | 'access_control'
  | 'separation_of_duties'
  | 'data_protection'
  | 'audit_trail'
  | 'identity_hygiene'
  | 'custom';

export interface ComplianceRule {
  id: string;
  tenant_id: string;
  rule_code: string;
  name: string;
  description: string | null;
  category: ComplianceRuleCategory;
  severity: ComplianceRuleSeverity;
  status: ComplianceRuleStatus;
  rule_config: ComplianceRuleConfig;
  auto_remediate: boolean;
  remediation_action: string | null;
  last_evaluated_at: string | null;
  last_violation_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceRuleConfig {
  /** Rule type determines evaluation logic */
  type: 'max_permissions' | 'sod_conflict' | 'orphan_check' | 'role_overlap_threshold' | 'super_admin_limit' | 'mfa_required' | 'custom';
  /** Threshold values */
  threshold?: number;
  /** Conflicting role pairs for SoD */
  conflicting_roles?: string[][];
  /** Target domains */
  domains?: GraphDomain[];
  /** Custom evaluation expression (for 'custom' type) */
  expression?: string;
}

export interface ComplianceViolation {
  rule_code: string;
  rule_name: string;
  severity: ComplianceRuleSeverity;
  description: string;
  affected_entities: Array<{ uid: string; label: string; type: string }>;
  remediation_hint: string | null;
}

export interface ComplianceEvaluation {
  id: string;
  tenant_id: string;
  rule_id: string;
  passed: boolean;
  violation_count: number;
  violations: ComplianceViolation[];
  remediation_suggestions: RemediationSuggestion[];
  ai_analysis: string | null;
  evaluated_at: string;
  evaluated_by: string | null;
}

export interface RemediationSuggestion {
  id: string;
  action: 'remove_permission' | 'merge_roles' | 'disable_user' | 'enable_mfa' | 'review_access' | 'custom';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  affected_entities: string[];
}

export interface ComplianceReport {
  tenant_id: string;
  evaluated_at: string;
  total_rules: number;
  passed_count: number;
  failed_count: number;
  critical_violations: number;
  warning_violations: number;
  info_violations: number;
  evaluations: ComplianceEvaluation[];
  overall_score: number; // 0-100
  ai_summary: string | null;
}

// ════════════════════════════════════
// 3. PREDICTIVE RISK ANALYSIS
// ════════════════════════════════════

export interface RiskTrendSnapshot {
  id: string;
  tenant_id: string;
  risk_level: RiskLevel;
  risk_score: number;
  signal_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  user_count: number;
  high_risk_users: number;
  top_signals: AuditRiskSignal[];
  trend_metadata: RiskTrendMetadata;
  ai_forecast: string | null;
  forecast_risk_level: RiskLevel | null;
  forecast_confidence: number;
  snapshot_at: string;
}

export interface RiskTrendMetadata {
  /** Delta from previous snapshot */
  score_delta?: number;
  /** Moving average (last 7 snapshots) */
  moving_average?: number;
  /** Trend direction */
  trend: 'improving' | 'stable' | 'degrading' | 'unknown';
  /** Velocity of change (score units per day) */
  velocity?: number;
}

export interface RiskForecast {
  current_level: RiskLevel;
  current_score: number;
  predicted_level: RiskLevel;
  predicted_score: number;
  confidence: number;
  horizon_days: number;
  contributing_factors: Array<{
    factor: string;
    impact: 'positive' | 'negative';
    weight: number;
  }>;
  recommendations: string[];
  ai_narrative: string;
}

export interface RiskTrendAnalysis {
  tenant_id: string;
  period_start: string;
  period_end: string;
  snapshots: RiskTrendSnapshot[];
  trend: RiskTrendMetadata;
  forecast: RiskForecast | null;
}
