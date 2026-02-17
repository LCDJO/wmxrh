/**
 * GraphComposer — Merges nodes/edges from all registered providers
 * into a single UnifiedGraphSnapshot.
 *
 * CRITICAL: Platform and Tenant graphs are composed side-by-side.
 * Cross-domain edges use IDENTITY_LINK only — never permission edges.
 */

import { graphRegistry } from './graph-registry';
import { emitUGEEvent } from './uge-events';
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
  const t0 = performance.now();

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

  const snapshot: UnifiedGraphSnapshot = {
    nodes,
    edges: dedupedEdges,
    domains: providers.map(p => p.domain),
    builtAt: Date.now(),
    version: snapshotVersion,
  };

  const compositionTimeMs = performance.now() - t0;

  // Emit GraphComposed event
  emitUGEEvent({
    type: 'GraphComposed',
    timestamp: Date.now(),
    version: snapshotVersion,
    domains: snapshot.domains,
    nodeCount: nodes.size,
    edgeCount: dedupedEdges.length,
    compositionTimeMs: Math.round(compositionTimeMs * 100) / 100,
  });

  // SECURITY: Freeze the snapshot — UGE is strictly read-only.
  return Object.freeze(snapshot);
}
