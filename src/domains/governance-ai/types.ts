/**
 * Governance AI Layer — Type Definitions
 *
 * Hybrid approach: local heuristic engine for fast detection +
 * AI-powered deep analysis via edge function for remediation.
 */

// ── Governance Insight ──────────────────────────────────────────

export type InsightSeverity = 'info' | 'warning' | 'critical';
export type InsightCategory =
  | 'sod_conflict'
  | 'excessive_permissions'
  | 'role_overlap'
  | 'orphaned_role'
  | 'privilege_escalation'
  | 'dormant_access'
  | 'compliance_gap'
  | 'anomalous_pattern'
  | 'plan_waste'
  | 'referral_abuse'
  | 'referral_loop'
  | 'referral_coupon_abuse';

export interface GovernanceInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  affected_entities: AffectedEntity[];
  recommendation: string;
  auto_remediable: boolean;
  remediation_action?: RemediationAction;
  confidence: number;
  detected_at: number;
  source: 'heuristic' | 'ai';
  metadata?: Record<string, unknown>;
}

export interface AffectedEntity {
  type: 'user' | 'role' | 'permission' | 'tenant' | 'referral_link' | 'coupon';
  id: string;
  label: string;
  domain?: string;
}

// ── Remediation ─────────────────────────────────────────────────

export type RemediationStatus = 'pending' | 'approved' | 'applied' | 'rejected' | 'failed';

export interface RemediationAction {
  id: string;
  type: 'remove_role' | 'remove_permission' | 'merge_roles' | 'restrict_scope' | 'add_mfa' | 'custom';
  description: string;
  impact_summary: string;
  steps: RemediationStep[];
  status: RemediationStatus;
  requires_approval: boolean;
  created_at: number;
}

export interface RemediationStep {
  order: number;
  action: string;
  target: string;
  details: string;
}

// ── AI Analysis Request/Response ────────────────────────────────

export interface GovernanceAIRequest {
  analysis_type: 'deep_risk' | 'compliance_audit' | 'remediation_plan' | 'trend_forecast' | 'referral_fraud';
  context: {
    insights: GovernanceInsight[];
    risk_score: number;
    risk_level: string;
    node_count: number;
    edge_count: number;
    sod_conflicts: number;
    user_scores: Array<{ userId: string; label: string; score: number }>;
  };
  tenant_id?: string;
}

export interface GovernanceAIResponse {
  analysis: string;
  recommendations: AIRecommendation[];
  risk_forecast?: RiskForecast;
  compliance_gaps?: ComplianceGap[];
  generated_at: number;
}

export interface AIRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action_type: RemediationAction['type'];
  estimated_risk_reduction: number;
}

export interface RiskForecast {
  current_score: number;
  projected_30d: number;
  projected_90d: number;
  trend: 'improving' | 'stable' | 'worsening';
  factors: string[];
}

export interface ComplianceGap {
  regulation: string;
  requirement: string;
  current_status: 'compliant' | 'partial' | 'non_compliant';
  remediation_effort: 'low' | 'medium' | 'high';
}

// ── Governance State ────────────────────────────────────────────

export interface GovernanceAIState {
  insights: GovernanceInsight[];
  last_scan_at: number | null;
  scanning: boolean;
  ai_analysis: GovernanceAIResponse | null;
  ai_loading: boolean;
}
