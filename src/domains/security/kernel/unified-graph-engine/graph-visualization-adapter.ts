/**
 * GraphVisualizationAdapter — Converts UnifiedGraphSnapshot
 * into a flat structure suitable for rendering in React components.
 */

import type {
  UnifiedGraphSnapshot,
  UnifiedNodeType,
  GraphDomain,
  VisualizationData,
  VisualizationNode,
  VisualizationEdge,
} from './types';

// ── Visual mapping ──

const DOMAIN_COLORS: Record<GraphDomain, string> = {
  platform_access: 'hsl(265 80% 55%)',
  tenant_access: 'hsl(210 100% 52%)',
  permission: 'hsl(38 92% 50%)',
  module_access: 'hsl(150 60% 45%)',
  identity: 'hsl(0 72% 51%)',
};

const TYPE_SIZES: Record<UnifiedNodeType, number> = {
  user: 24,
  platform_role: 20,
  tenant_role: 20,
  permission: 12,
  scope: 14,
  tenant: 28,
  company_group: 22,
  company: 18,
  module: 20,
  resource: 10,
};

export function toVisualizationData(
  snapshot: UnifiedGraphSnapshot,
  filter?: { domains?: GraphDomain[] },
): VisualizationData {
  const allowedDomains = filter?.domains
    ? new Set(filter.domains)
    : null;

  const nodes: VisualizationNode[] = [];
  const edges: VisualizationEdge[] = [];

  // Domain breakdown stats
  const breakdown: Record<GraphDomain, { nodes: number; edges: number }> = {
    platform_access: { nodes: 0, edges: 0 },
    tenant_access: { nodes: 0, edges: 0 },
    permission: { nodes: 0, edges: 0 },
    module_access: { nodes: 0, edges: 0 },
    identity: { nodes: 0, edges: 0 },
  };

  for (const node of snapshot.nodes.values()) {
    if (allowedDomains && !allowedDomains.has(node.domain)) continue;

    nodes.push({
      id: node.uid,
      label: node.label,
      type: node.type,
      domain: node.domain,
      color: DOMAIN_COLORS[node.domain],
      size: TYPE_SIZES[node.type] ?? 14,
    });

    breakdown[node.domain].nodes++;
  }

  const nodeSet = new Set(nodes.map(n => n.id));

  for (const edge of snapshot.edges) {
    if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to)) continue;

    edges.push({
      source: edge.from,
      target: edge.to,
      relation: edge.relation,
      domain: edge.domain,
      weight: edge.weight,
    });

    breakdown[edge.domain].edges++;
  }

  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      domainBreakdown: breakdown,
    },
  };
}
