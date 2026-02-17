/**
 * GraphComposer — Merges nodes/edges from all registered providers
 * into a single UnifiedGraphSnapshot.
 *
 * CRITICAL: Platform and Tenant graphs are composed side-by-side.
 * Cross-domain edges use IDENTITY_LINK only — never permission edges.
 */

import { graphRegistry } from './graph-registry';
import type {
  GraphDomain,
  UnifiedNode,
  UnifiedEdge,
  UnifiedGraphSnapshot,
} from './types';

let snapshotVersion = 0;

export function composeUnifiedGraph(
  domains?: GraphDomain[],
): UnifiedGraphSnapshot {
  const providers = domains
    ? domains
        .map(d => graphRegistry.getProvider(d))
        .filter((p): p is NonNullable<typeof p> => p !== null && p.isAvailable())
    : graphRegistry.getAvailableProviders();

  const nodes = new Map<string, UnifiedNode>();
  const edges: UnifiedEdge[] = [];

  for (const provider of providers) {
    const { nodes: pNodes, edges: pEdges } = provider.provide();
    for (const n of pNodes) {
      if (!nodes.has(n.uid)) nodes.set(n.uid, n);
    }
    edges.push(...pEdges);
  }

  // Deduplicate edges
  const edgeSet = new Set<string>();
  const dedupedEdges = edges.filter(e => {
    const key = `${e.from}|${e.to}|${e.relation}`;
    if (edgeSet.has(key)) return false;
    edgeSet.add(key);
    return true;
  });

  snapshotVersion++;

  return {
    nodes,
    edges: dedupedEdges,
    domains: providers.map(p => p.domain),
    builtAt: Date.now(),
    version: snapshotVersion,
  };
}
