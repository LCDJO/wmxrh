/**
 * Autonomous Operations AI Engine — Type Definitions
 * Platform Intelligence Layer
 *
 * SECURITY CONSTRAINT (CRITICAL):
 * The Autonomous AI Engine is ADVISORY-ONLY. It NEVER executes actions autonomously.
 * All outputs are suggestions, recommendations, or alerts that REQUIRE explicit
 * human approval before any action is taken. No automated execution path exists.
 *
 * The engine:
 *  ✅ Suggests — proposes automation workflows and optimizations
 *  ✅ Recommends — identifies revenue, workflow, and risk opportunities
 *  ✅ Alerts — predicts risks and surfaces intelligent warnings
 *  ❌ NEVER executes — no auto-heal, auto-scale, or auto-apply without human confirmation
 */

// ── Signal Types ─────────────────────────────────────────────

export type SignalSeverity = 'info' | 'warning' | 'critical';
export type SignalSource = 'module' | 'billing' | 'identity' | 'compliance' | 'support' | 'automation' | 'api' | 'tenant';

export interface PlatformSignal {
  id: string;
  source: SignalSource;
  event_type: string;
  severity: SignalSeverity;
  payload: Record<string, unknown>;
  tenant_id?: string;
  module_key?: string;
  timestamp: string;
}

// ── Behavior Patterns ────────────────────────────────────────

export type PatternType = 'usage_spike' | 'usage_decline' | 'error_burst' | 'latency_degradation' | 'churn_risk' | 'growth_opportunity' | 'cost_anomaly' | 'security_anomaly';

export interface BehaviorPattern {
  id: string;
  type: PatternType;
  confidence: number;        // 0-100
  affected_tenants: string[];
  affected_modules: string[];
  description: string;
  detected_at: string;
  data_points: number;
  trend_direction: 'up' | 'down' | 'stable';
}

// ── Automation Suggestions ───────────────────────────────────

export type SuggestionPriority = 'low' | 'medium' | 'high' | 'critical';
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'executed';

export interface AutomationSuggestion {
  id: string;
  title: string;
  description: string;
  priority: SuggestionPriority;
  status: SuggestionStatus;
  trigger_pattern_id: string;
  /** Human-readable impact estimate (no auto-execution) */
  estimated_impact: string;
  /** Proposed actions — NEVER auto-executed, require explicit human approval */
  actions: SuggestedAction[];
  created_at: string;
  /** Approval tracking */
  approved_by?: string;
  approved_at?: string;
}

export interface SuggestedAction {
  type: 'notify' | 'scale' | 'throttle' | 'heal' | 'alert' | 'optimize' | 'recommend';
  target: string;
  parameters: Record<string, unknown>;
}

// ── Risk Prediction ──────────────────────────────────────────

export type RiskCategory = 'operational' | 'financial' | 'compliance' | 'security' | 'performance';

export interface PredictedRisk {
  id: string;
  category: RiskCategory;
  title: string;
  description: string;
  probability: number;       // 0-100
  impact_score: number;      // 0-100
  composite_score: number;   // probability * impact / 100
  affected_area: string;
  mitigation_steps: string[];
  predicted_at: string;
  horizon_hours: number;
}

// ── Revenue Optimization ─────────────────────────────────────

export interface RevenueOptimization {
  id: string;
  tenant_id: string;
  tenant_name: string;
  current_plan: string;
  recommended_action: 'upgrade' | 'add_module' | 'increase_usage' | 'retention_offer' | 'cross_sell';
  estimated_mrr_impact: number;
  confidence: number;
  reasoning: string;
  created_at: string;
}

// ── Workflow Optimization ────────────────────────────────────

export interface WorkflowOptimization {
  id: string;
  workflow_name: string;
  module_key: string;
  current_avg_duration_ms: number;
  suggested_duration_ms: number;
  optimization_type: 'parallel' | 'cache' | 'batch' | 'skip_redundant' | 'reorder';
  description: string;
  estimated_speedup_pct: number;
}

// ── Tenant Impact ────────────────────────────────────────────

export interface TenantImpactReport {
  tenant_id: string;
  tenant_name: string;
  health_score: number;      // 0-100
  risk_score: number;        // 0-100
  usage_trend: 'growing' | 'stable' | 'declining';
  active_incidents: number;
  predicted_risks: PredictedRisk[];
  optimizations: RevenueOptimization[];
  last_analyzed: string;
}

/** Pre-deploy impact assessment for a planned release */
export interface DeployImpactAssessment {
  release_id: string;
  release_label: string;
  analyzed_at: string;
  /** Total tenants that will be affected */
  total_tenants_affected: number;
  /** Breakdown by impact severity */
  impact_breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    none: number;
  };
  /** Per-tenant impact details */
  tenant_impacts: TenantDeployImpact[];
  /** Automation impact summary */
  automation_impact: AutomationImpact;
  /** Billing impact summary */
  billing_impact: BillingImpact;
  /** Overall risk verdict */
  verdict: 'safe' | 'caution' | 'risky' | 'blocked';
  verdict_reason: string;
}

export interface TenantDeployImpact {
  tenant_id: string;
  tenant_name: string;
  plan: string;
  impact_level: 'critical' | 'high' | 'medium' | 'low' | 'none';
  affected_modules: string[];
  affected_workflows: number;
  affected_automations: number;
  billing_change_brl: number;
  risk_factors: string[];
}

export interface AutomationImpact {
  total_workflows_affected: number;
  workflows_breaking: number;
  workflows_degraded: number;
  workflows_unaffected: number;
  breaking_details: { workflow_name: string; reason: string }[];
}

export interface BillingImpact {
  total_mrr_at_risk: number;
  tenants_with_price_change: number;
  tenants_with_plan_change: number;
  estimated_revenue_delta_brl: number;
  details: string[];
}

// ── Insight Dashboard ────────────────────────────────────────

export interface OperationalInsight {
  id: string;
  category: 'pattern' | 'risk' | 'optimization' | 'anomaly' | 'recommendation';
  title: string;
  summary: string;
  severity: SignalSeverity;
  data: Record<string, unknown>;
  created_at: string;
  is_actionable: boolean;
  action_label?: string;
}

export interface OperationalDashboardState {
  total_signals_24h: number;
  active_patterns: number;
  pending_suggestions: number;
  active_risks: number;
  revenue_optimizations: number;
  workflow_optimizations: number;
  overall_health: 'healthy' | 'degraded' | 'critical';
  last_analysis: string;
  insights: OperationalInsight[];
}
