/**
 * Domain Events — Autonomous Operations AI Engine
 */

export const AUTONOMOUS_OPS_EVENTS = {
  SignalCollected: 'autonomous_ops:signal_collected',
  PatternDetected: 'autonomous_ops:pattern_detected',
  SuggestionGenerated: 'autonomous_ops:suggestion_generated',
  SuggestionAccepted: 'autonomous_ops:suggestion_accepted',
  SuggestionRejected: 'autonomous_ops:suggestion_rejected',
  RiskPredicted: 'autonomous_ops:risk_predicted',
  RiskMitigated: 'autonomous_ops:risk_mitigated',
  RevenueOptimizationIdentified: 'autonomous_ops:revenue_optimization_identified',
  WorkflowOptimized: 'autonomous_ops:workflow_optimized',
  TenantImpactAnalyzed: 'autonomous_ops:tenant_impact_analyzed',
  DashboardRefreshed: 'autonomous_ops:dashboard_refreshed',

  // ── AI-specific lifecycle events ──
  AISuggestionGenerated: 'autonomous_ops:ai_suggestion_generated',
  AIRiskDetected: 'autonomous_ops:ai_risk_detected',
  AIWorkflowOptimizationSuggested: 'autonomous_ops:ai_workflow_optimization_suggested',
  AITenantImpactAnalyzed: 'autonomous_ops:ai_tenant_impact_analyzed',
} as const;

export type AutonomousOpsEventType = typeof AUTONOMOUS_OPS_EVENTS[keyof typeof AUTONOMOUS_OPS_EVENTS];

export interface AutonomousOpsEventPayload {
  event: AutonomousOpsEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

/** Autodiscovery catalog for Event Catalog UI */
export const __DOMAIN_CATALOG = {
  domain: 'autonomous-operations',
  label: 'Autonomous Operations AI Engine',
  events: Object.entries(AUTONOMOUS_OPS_EVENTS).map(([key, value]) => ({
    key: value,
    label: key.replace(/([A-Z])/g, ' $1').trim(),
    description: `Evento emitido quando ${key.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`,
  })),
};
