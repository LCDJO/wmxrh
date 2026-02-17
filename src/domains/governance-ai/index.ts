/**
 * Governance AI Layer — Barrel export.
 *
 * Architecture:
 *  GovernanceAI
 *   ├── AccessRiskAnalyzer           → high-risk user detection
 *   ├── PermissionAnomalyDetector    → excessive permissions & operational risks
 *   ├── RoleOptimizationAdvisor      → role overlap & consolidation
 *   ├── SegregationOfDutiesChecker   → SoD conflict detection
 *   ├── GovernanceInsightsService    → orchestrator for all analyzers
 *   └── GovernanceAIService          → hybrid orchestrator (heuristic + AI)
 */

// Individual analyzers
export { analyzeAccessRisk, buildAccessRiskProfiles } from './access-risk-analyzer';
export { detectPermissionAnomalies, detectExcessivePermissions, detectOperationalRisks } from './permission-anomaly-detector';
export { detectRoleOverlaps, buildOptimizationHints } from './role-optimization-advisor';
export type { RoleOptimizationHint } from './role-optimization-advisor';
export type { AccessRiskProfile } from './access-risk-analyzer';
export { detectSoDConflicts } from './segregation-of-duties-checker';
export { runGrowthGovernanceScan, scanABTestGovernance, scanLandingRevenueLoss } from './growth-governance-analyzer';
// Orchestrators
export { runHeuristicScan } from './governance-insights.service';
export { GovernanceAIService, getGovernanceAIService } from './governance-ai.service';

// Events
export {
  emitGovernanceEvent,
  emitRiskDetected,
  emitOptimizationSuggested,
  emitConflictDetected,
  onGovernanceEvent,
  onGovernanceEventType,
  getGovernanceEventLog,
  clearGovernanceEventLog,
} from './governance-events';
export type {
  GovernanceEventType,
  GovernanceDomainEvent,
  GovernanceRiskDetectedPayload,
  RoleOptimizationSuggestedPayload,
  PermissionConflictDetectedPayload,
} from './governance-events';

// Types
export type * from './types';
