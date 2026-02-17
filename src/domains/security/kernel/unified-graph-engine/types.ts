/**
 * Unified Graph Engine (UGE) — Type Definitions
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  READ-ONLY analytical layer that correlates all platform graphs  ║
 * ║  WITHOUT mixing Platform ↔ Tenant permissions.                  ║
 * ║                                                                  ║
 * ║  Graphs registered:                                              ║
 * ║    1. PlatformAccessGraph  — platform roles/perms/scopes        ║
 * ║    2. TenantAccessGraph    — tenant RBAC + scope hierarchy      ║
 * ║    3. PermissionGraph      — cross-role permission edges        ║
 * ║    4. ModuleAccessGraph    — module federation access            ║
 * ║    5. IdentityGraph        — user identity relationships        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ════════════════════════════════════
// GRAPH DOMAIN — which graph layer a node/edge belongs to
// ════════════════════════════════════

export type GraphDomain =
  | 'platform_access'
  | 'tenant_access'
  | 'permission'
  | 'module_access'
  | 'identity';

// ════════════════════════════════════
// UNIFIED NODE
// ════════════════════════════════════

export type UnifiedNodeType =
  | 'user'
  | 'platform_role'
  | 'tenant_role'
  | 'permission'
  | 'scope'
  | 'tenant'
  | 'company_group'
  | 'company'
  | 'module'
  | 'resource';

export interface UnifiedNode {
  /** Globally unique within UGE: `${domain}:${originalId}` */
  uid: string;
  domain: GraphDomain;
  type: UnifiedNodeType;
  originalId: string;
  label: string;
  meta?: Record<string, unknown>;
}

// ════════════════════════════════════
// UNIFIED EDGE
// ════════════════════════════════════

export type UnifiedEdgeRelation =
  // Platform
  | 'HAS_PLATFORM_ROLE'
  | 'PLATFORM_GRANTS'
  | 'PLATFORM_INHERITS'
  | 'PLATFORM_SCOPE'
  // Tenant
  | 'HAS_TENANT_ROLE'
  | 'TENANT_GRANTS'
  | 'TENANT_SCOPE'
  | 'BELONGS_TO_TENANT'
  | 'BELONGS_TO_GROUP'
  | 'BELONGS_TO_COMPANY'
  // Module
  | 'HAS_MODULE_ACCESS'
  | 'MODULE_REQUIRES'
  // Identity
  | 'IDENTITY_LINK'
  | 'IMPERSONATES';

export interface UnifiedEdge {
  from: string; // uid
  to: string;   // uid
  relation: UnifiedEdgeRelation;
  domain: GraphDomain;
  weight?: number;
  meta?: Record<string, unknown>;
}

// ════════════════════════════════════
// GRAPH SNAPSHOT — immutable view
// ════════════════════════════════════

export interface UnifiedGraphSnapshot {
  readonly nodes: ReadonlyMap<string, UnifiedNode>;
  readonly edges: readonly UnifiedEdge[];
  readonly domains: readonly GraphDomain[];
  readonly builtAt: number;
  readonly version: number;
}

// ════════════════════════════════════
// RISK ASSESSMENT
// ════════════════════════════════════

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskSignal {
  id: string;
  level: RiskLevel;
  domain: GraphDomain;
  title: string;
  detail: string;
  affectedNodeUids: string[];
}

export interface RiskAssessment {
  overallLevel: RiskLevel;
  signals: RiskSignal[];
  assessedAt: number;
}

// ════════════════════════════════════
// QUERY TYPES
// ════════════════════════════════════

export interface GraphQuery {
  /** Starting node UID */
  from: string;
  /** Filter by relation types */
  relations?: UnifiedEdgeRelation[];
  /** Filter by target domain */
  targetDomain?: GraphDomain;
  /** Max traversal depth */
  maxDepth?: number;
}

export interface GraphQueryResult {
  paths: Array<{
    nodes: UnifiedNode[];
    edges: UnifiedEdge[];
  }>;
  reachableNodes: UnifiedNode[];
  totalEdgesTraversed: number;
}

// ════════════════════════════════════
// VISUALIZATION ADAPTER
// ════════════════════════════════════

export interface VisualizationNode {
  id: string;
  label: string;
  type: UnifiedNodeType;
  domain: GraphDomain;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
}

export interface VisualizationEdge {
  source: string;
  target: string;
  relation: UnifiedEdgeRelation;
  domain: GraphDomain;
  weight?: number;
}

export interface VisualizationData {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    domainBreakdown: Record<GraphDomain, { nodes: number; edges: number }>;
  };
}
