/**
 * Platform Access Graph → UGE Provider
 * Reads the singleton PlatformAccessGraph and converts to unified nodes/edges.
 */

import type { GraphProvider } from '../graph-registry';
import type { UnifiedNode, UnifiedEdge } from '../types';
import { platformAccessGraphService } from '@/domains/platform/platform-access-graph';

export const platformAccessProvider: GraphProvider = {
  domain: 'platform_access',
  graphId: 'platform_access_v1',
  name: 'Platform Access Graph',
  sourceService: 'PlatformAccessGraphService',

  isAvailable(): boolean {
    return platformAccessGraphService.getCurrentGraph() !== null;
  },

  provide(): { nodes: UnifiedNode[]; edges: UnifiedEdge[] } {
    const graph = platformAccessGraphService.getCurrentGraph();
    if (!graph) return { nodes: [], edges: [] };

    const nodes: UnifiedNode[] = [];
    const edges: UnifiedEdge[] = [];

    for (const [id, gNode] of graph.getNodes()) {
      const type = gNode.type === 'role' ? 'role' as const
        : gNode.type === 'permission' ? 'permission' as const
        : gNode.type === 'scope' ? 'scope' as const
        : 'platform_user' as const;

      nodes.push({
        uid: `platform_access:${id}`,
        domain: 'platform_access',
        type,
        originalId: id,
        label: (gNode.meta?.name as string) ?? (gNode.meta?.code as string) ?? id,
        meta: gNode.meta,
      });
    }

    for (const gEdge of graph.getEdges()) {
      const relationMap: Record<string, UnifiedEdge['relation']> = {
        HAS_ROLE: 'HAS_ROLE',
        GRANTS_PERMISSION: 'GRANTS_PERMISSION',
        INHERITS_ROLE: 'INHERITS_ROLE',
        HAS_SCOPE: 'PLATFORM_SCOPE',
      };

      edges.push({
        from: `platform_access:${gEdge.from}`,
        to: `platform_access:${gEdge.to}`,
        relation: relationMap[gEdge.relation] ?? 'HAS_PLATFORM_ROLE',
        domain: 'platform_access',
      });
    }

    return { nodes, edges };
  },
};
