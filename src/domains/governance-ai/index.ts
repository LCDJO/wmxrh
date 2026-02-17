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
export { detectRoleOverlaps } from './role-optimization-advisor';
export { detectSoDConflicts } from './segregation-of-duties-checker';

// Orchestrators
export { runHeuristicScan } from './governance-insights.service';
export { GovernanceAIService, getGovernanceAIService } from './governance-ai.service';

// Types
export type * from './types';
