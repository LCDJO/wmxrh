/**
 * Autonomous Operations AI Engine — Platform Intelligence Layer
 *
 * SECURITY CONSTRAINT (CRITICAL):
 * This engine is STRICTLY ADVISORY. It NEVER executes actions autonomously.
 * All outputs are suggestions, recommendations, or alerts requiring human approval.
 *
 * Modular architecture:
 *  ├── PlatformSignalCollector    — Collect & normalize platform events
 *  ├── BehaviorPatternAnalyzer    — Detect usage patterns & anomalies
 *  ├── AutomationSuggestionEngine — Generate actionable suggestions (human-approved)
 *  ├── RiskPredictionService      — Predict operational, financial & security risks
 *  ├── RevenueOptimizationAdvisor — Revenue-maximizing recommendations per tenant
 *  ├── WorkflowOptimizer          — Cross-module workflow optimization suggestions
 *  ├── TenantImpactAnalyzer       — Per-tenant impact assessment (pre-deploy)
 *  └── InsightDashboardService    — Unified operational dashboard aggregator
 */

export { PlatformSignalCollector } from './platform-signal-collector';
export { BehaviorPatternAnalyzer } from './behavior-pattern-analyzer';
export { AutomationSuggestionEngine } from './automation-suggestion-engine';
export { RiskPredictionService } from './risk-prediction-service';
export { RevenueOptimizationAdvisor } from './revenue-optimization-advisor';
export { WorkflowOptimizer } from './workflow-optimizer';
export { TenantImpactAnalyzer } from './tenant-impact-analyzer';
export { InsightDashboardService } from './insight-dashboard-service';

export {
  initSignalBridge,
  emitAutomationSignal,
  emitApiManagementSignal,
  emitMarketplaceSignal,
  emitVersioningSignal,
  emitObservabilitySignal,
} from './signal-bridge';

export * from './types';
export * from './autonomous-operations-events';
