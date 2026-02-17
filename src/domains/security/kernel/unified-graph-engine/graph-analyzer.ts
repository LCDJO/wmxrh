/**
 * GraphAnalyzer — Structural analysis over the unified graph.
 * Detects anomalies, orphans, privilege concentration, and cross-domain patterns.
 */

import type {
  UnifiedGraphSnapshot,
  UnifiedNode,
  UnifiedEdge,
  GraphDomain,
} from './types';

export interface AnalysisResult {
  /** Nodes with no incoming or outgoing edges */
  orphanNodes: UnifiedNode[];
  /** Nodes with high fan-out (many edges) — potential privilege concentration */
  highFanOutNodes: Array<{ node: UnifiedNode; edgeCount: number }>;
  /** Users that appear in both platform and tenant graphs */
  crossDomainUsers: UnifiedNode[];
  /** Domains present in the snapshot */
  activeDomains: GraphDomain[];
  /** Basic stats */
  stats: {
    totalNodes: number;
    totalEdges: number;
    avgFanOut: number;
    maxDepth: number;
  };
}

const HIGH_FAN_OUT_THRESHOLD = 10;

export function analyzeGraph(snapshot: UnifiedGraphSnapshot): AnalysisResult {
  const { nodes, edges } = snapshot;

  // Fan-out map: uid → outgoing edge count
  const fanOut = new Map<string, number>();
  const hasIncoming = new Set<string>();

  for (const e of edges) {
    fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1);
    hasIncoming.add(e.to);
  }

  // Orphan detection
  const orphanNodes: UnifiedNode[] = [];
  for (const [uid, node] of nodes) {
    if (!fanOut.has(uid) && !hasIncoming.has(uid)) {
      orphanNodes.push(node);
    }
  }

  // High fan-out
  const highFanOutNodes: AnalysisResult['highFanOutNodes'] = [];
  for (const [uid, count] of fanOut) {
    if (count >= HIGH_FAN_OUT_THRESHOLD) {
      const node = nodes.get(uid);
      if (node) highFanOutNodes.push({ node, edgeCount: count });
    }
  }
  highFanOutNodes.sort((a, b) => b.edgeCount - a.edgeCount);

  // Cross-domain users: users appearing in both platform_access and tenant_access
  const usersByDomain = new Map<string, Set<GraphDomain>>();
  for (const node of nodes.values()) {
    if (node.type === 'user') {
      const key = node.originalId;
      if (!usersByDomain.has(key)) usersByDomain.set(key, new Set());
      usersByDomain.get(key)!.add(node.domain);
    }
  }
  const crossDomainUsers: UnifiedNode[] = [];
  for (const [originalId, domains] of usersByDomain) {
    if (domains.has('platform_access') && domains.has('tenant_access')) {
      const node = Array.from(nodes.values()).find(
        n => n.originalId === originalId && n.domain === 'platform_access',
      );
      if (node) crossDomainUsers.push(node);
    }
  }

  // Max depth via BFS from root nodes (no incoming edges)
  let maxDepth = 0;
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjacency.has(e.from)) adjacency.set(e.from, []);
    adjacency.get(e.from)!.push(e.to);
  }

  const roots = Array.from(nodes.keys()).filter(uid => !hasIncoming.has(uid));
  for (const root of roots) {
    const visited = new Set<string>();
    const queue: Array<{ uid: string; depth: number }> = [{ uid: root, depth: 0 }];
    while (queue.length > 0) {
      const { uid, depth } = queue.shift()!;
      if (visited.has(uid)) continue;
      visited.add(uid);
      if (depth > maxDepth) maxDepth = depth;
      for (const next of adjacency.get(uid) ?? []) {
        if (!visited.has(next)) queue.push({ uid: next, depth: depth + 1 });
      }
    }
  }

  const totalEdges = edges.length;
  const totalNodes = nodes.size;

  return {
    orphanNodes,
    highFanOutNodes,
    crossDomainUsers,
    activeDomains: [...snapshot.domains],
    stats: {
      totalNodes,
      totalEdges,
      avgFanOut: totalNodes > 0 ? +(totalEdges / totalNodes).toFixed(2) : 0,
      maxDepth,
    },
  };
}
