/**
 * Unified Graph Engine (UGE) — Public API
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SECURITY CONTRACT: UGE IS STRICTLY READ-ONLY.                   ║
 * ║                                                                  ║
 * ║  • UGE NEVER creates, updates, or deletes permissions.          ║
 * ║  • UGE NEVER modifies roles, assignments, or access rules.      ║
 * ║  • ALL authorization decisions remain in the SecurityKernel.    ║
 * ║  • UGE only READS, COMPOSES, ANALYZES, and VISUALIZES graphs.  ║
 * ║                                                                  ║
 * ║  UnifiedGraphEngine                                              ║
 * ║   ├── GraphRegistry          → register/unregister providers    ║
 * ║   ├── GraphComposer          → merge all graphs into snapshot   ║
 * ║   ├── GraphAnalyzer          → structural analysis              ║
 * ║   ├── GraphQueryService      → BFS traversal with filters       ║
 * ║   ├── RiskAssessmentService  → governance risk signals          ║
 * ║   └── GraphVisualizationAdapter → React-ready render data       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { graphRegistry } from './graph-registry';
import { composeUnifiedGraph } from './graph-composer';
import { analyzeGraph } from './graph-analyzer';
import { queryGraph, getUserAccessMap, getTenantAccessOverview, getPermissionUsage } from './graph-query-service';
import { assessRisk } from './risk-assessment-service';
import { toVisualizationData } from './graph-visualization-adapter';

// ── Auto-register built-in providers ──
import { platformAccessProvider } from './providers/platform-access-provider';
import { tenantAccessProvider } from './providers/tenant-access-provider';
import { identityProvider } from './providers/identity-provider';

graphRegistry.register(platformAccessProvider);
graphRegistry.register(tenantAccessProvider);
graphRegistry.register(identityProvider);

// ════════════════════════════════════
// UNIFIED GRAPH ENGINE FACADE
// ════════════════════════════════════

import type {
  GraphDomain,
  UnifiedGraphSnapshot,
  GraphQuery,
  GraphQueryResult,
  VisualizationData,
  RiskAssessment,
} from './types';
import type { AnalysisResult } from './graph-analyzer';
import type { GraphProvider } from './graph-registry';

export const unifiedGraphEngine = {
  // ── Registry ──
  registerProvider(provider: GraphProvider): void {
    graphRegistry.register(provider);
  },
  unregisterProvider(domain: GraphDomain): void {
    graphRegistry.unregister(domain);
  },
  getAvailableDomains(): GraphDomain[] {
    return graphRegistry.getAvailableProviders().map(p => p.domain);
  },
  getRegisteredDomains(): GraphDomain[] {
    return graphRegistry.getRegisteredDomains();
  },

  // ── Compose ──
  compose(domains?: GraphDomain[]): UnifiedGraphSnapshot {
    return composeUnifiedGraph(domains);
  },

  // ── Analyze ──
  analyze(snapshot: UnifiedGraphSnapshot): AnalysisResult {
    return analyzeGraph(snapshot);
  },

  // ── Query (low-level) ──
  query(snapshot: UnifiedGraphSnapshot, query: GraphQuery): GraphQueryResult {
    return queryGraph(snapshot, query);
  },

  // ── Query (high-level) ──
  getUserAccessMap(snapshot: UnifiedGraphSnapshot, userId: string) {
    return getUserAccessMap(snapshot, userId);
  },
  getTenantAccessOverview(snapshot: UnifiedGraphSnapshot, tenantId: string) {
    return getTenantAccessOverview(snapshot, tenantId);
  },
  getPermissionUsage(snapshot: UnifiedGraphSnapshot, resource: string) {
    return getPermissionUsage(snapshot, resource);
  },

  // ── Risk ──
  assessRisk(snapshot: UnifiedGraphSnapshot): RiskAssessment {
    return assessRisk(snapshot);
  },

  // ── Visualization ──
  toVisualization(
    snapshot: UnifiedGraphSnapshot,
    filter?: { domains?: GraphDomain[] },
  ): VisualizationData {
    return toVisualizationData(snapshot, filter);
  },

  // ── Convenience: full pipeline ──
  buildFullReport(domains?: GraphDomain[]) {
    const snapshot = composeUnifiedGraph(domains);
    return {
      snapshot,
      analysis: analyzeGraph(snapshot),
      risk: assessRisk(snapshot),
      visualization: toVisualizationData(snapshot),
    };
  },
};

// ── Re-exports ──
export type {
  GraphDomain,
  UnifiedNode,
  UnifiedEdge,
  UnifiedNodeType,
  UnifiedEdgeRelation,
  UnifiedGraphSnapshot,
  GraphQuery,
  GraphQueryResult,
  RiskAssessment,
  RiskSignal,
  RiskLevel,
  UserRiskScore,
  VisualizationData,
  VisualizationNode,
  VisualizationEdge,
} from './types';
export type { AnalysisResult } from './graph-analyzer';
export type { GraphProvider } from './graph-registry';
export type { UserAccessMap, TenantAccessOverview, PermissionUsage } from './graph-query-service';
export { graphRegistry } from './graph-registry';
