/**
 * GraphQueryService — BFS-based traversal over the unified graph.
 * Supports filtered queries by relation type, domain, and depth.
 */

import type {
  UnifiedGraphSnapshot,
  GraphQuery,
  GraphQueryResult,
  UnifiedNode,
  UnifiedEdge,
} from './types';

const DEFAULT_MAX_DEPTH = 10;

export function queryGraph(
  snapshot: UnifiedGraphSnapshot,
  query: GraphQuery,
): GraphQueryResult {
  const { from, relations, targetDomain, maxDepth = DEFAULT_MAX_DEPTH } = query;
  const { nodes, edges } = snapshot;

  if (!nodes.has(from)) {
    return { paths: [], reachableNodes: [], totalEdgesTraversed: 0 };
  }

  // Build adjacency filtered by relations & domain
  const adjacency = new Map<string, Array<{ edge: UnifiedEdge; target: string }>>();
  for (const e of edges) {
    if (relations && !relations.includes(e.relation)) continue;
    if (targetDomain && e.domain !== targetDomain) continue;
    if (!adjacency.has(e.from)) adjacency.set(e.from, []);
    adjacency.get(e.from)!.push({ edge: e, target: e.to });
  }

  // BFS
  const visited = new Set<string>();
  const reachableNodes: UnifiedNode[] = [];
  const allPaths: GraphQueryResult['paths'] = [];
  let totalEdgesTraversed = 0;

  interface QueueItem {
    uid: string;
    depth: number;
    pathNodes: UnifiedNode[];
    pathEdges: UnifiedEdge[];
  }

  const startNode = nodes.get(from)!;
  const queue: QueueItem[] = [{ uid: from, depth: 0, pathNodes: [startNode], pathEdges: [] }];

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (item.depth > maxDepth) continue;

    const neighbors = adjacency.get(item.uid) ?? [];
    for (const { edge, target } of neighbors) {
      totalEdgesTraversed++;
      const targetNode = nodes.get(target);
      if (!targetNode) continue;

      const newPath = {
        nodes: [...item.pathNodes, targetNode],
        edges: [...item.pathEdges, edge],
      };

      if (!visited.has(target)) {
        visited.add(target);
        reachableNodes.push(targetNode);
        allPaths.push(newPath);
        queue.push({
          uid: target,
          depth: item.depth + 1,
          pathNodes: newPath.nodes,
          pathEdges: newPath.edges,
        });
      }
    }
  }

  return { paths: allPaths, reachableNodes, totalEdgesTraversed };
}
