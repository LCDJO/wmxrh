/**
 * Governance AI Layer — Barrel export.
 *
 * Architecture:
 *  GovernanceAILayer
 *   ├── HeuristicEngine     → local deterministic analysis
 *   ├── GovernanceAIService  → orchestrator (heuristic + AI)
 *   └── Types                → shared type definitions
 */
export { runHeuristicScan } from './heuristic-engine';
export { GovernanceAIService, getGovernanceAIService } from './governance-ai.service';
export type * from './types';
