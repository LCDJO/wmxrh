/**
 * Unified Graph Engine (UGE) — Type Definitions
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SECURITY CONTRACT: UGE IS STRICTLY READ-ONLY.                   ║
 * ║                                                                  ║
 * ║  • This layer NEVER mutates permissions, roles, or access.      ║
 * ║  • ALL authorization decisions remain in the SecurityKernel.    ║
 * ║  • UGE only reads, correlates, analyzes, and visualizes.        ║
 * ║                                                                  ║
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
  | 'identity'
  | 'federation';

// ════════════════════════════════════
// UNIFIED NODE
// ════════════════════════════════════

export type UnifiedNodeType =
  | 'platform_user'
  | 'tenant_user'
  | 'role'
  | 'permission'
  | 'module'
  | 'tenant'
  | 'identity_session'
  // Extended (kept for backward compat & visualization)
  | 'scope'
  | 'company_group'
  | 'company'
  | 'resource'
  // Federation
  | 'federation_hub'
  | 'federation_protocol'
  | 'federation_idp';

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
  // Core relations (spec)
  | 'HAS_ROLE'
  | 'GRANTS_PERMISSION'
  | 'BELONGS_TO'
  | 'ENABLES_MODULE'
  | 'INHERITS_ROLE'
  | 'IMPERSONATES'
  // Extended (domain-specific detail)
  | 'HAS_PLATFORM_ROLE'
  | 'PLATFORM_GRANTS'
  | 'PLATFORM_INHERITS'
  | 'PLATFORM_SCOPE'
  | 'HAS_TENANT_ROLE'
  | 'TENANT_GRANTS'
  | 'TENANT_SCOPE'
  | 'BELONGS_TO_TENANT'
  | 'BELONGS_TO_GROUP'
  | 'BELONGS_TO_COMPANY'
  | 'HAS_MODULE_ACCESS'
  | 'MODULE_REQUIRES'
  | 'IDENTITY_LINK'
  // Federation
  | 'FEDERATION_LINK'
  | 'FEDERATED_IDENTITY'
  | 'SUPPORTS_PROTOCOL'
  | 'HAS_IDP';

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

// ════════════════════════════════════
// USER RISK SCORE
// ════════════════════════════════════

export interface UserRiskScore {
  userUid: string;
  userLabel: string;
  domain: GraphDomain;
  /** Overall 0–100 score (higher = more risk) */
  score: number;
  level: RiskLevel;
  /** Breakdown */
  factors: {
    /** Number of critical permissions resolved for this user */
    criticalPermissionCount: number;
    /** Weight: 0–40 */
    criticalPermissionScore: number;
    /** Number of tenants this user has access to */
    multiTenantCount: number;
    /** Weight: 0–30 */
    multiTenantScore: number;
    /** Whether the user currently has an active impersonation session */
    hasActiveImpersonation: boolean;
    /** Weight: 0–30 */
    impersonationScore: number;
  };
}

export interface RiskAssessment {
  overallLevel: RiskLevel;
  signals: RiskSignal[];
  /** Per-user risk scores */
  userScores: UserRiskScore[];
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
