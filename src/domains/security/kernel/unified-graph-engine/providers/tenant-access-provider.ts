/**
 * Tenant Access Graph → UGE Provider
 * Reads the singleton tenant AccessGraph and converts to unified nodes/edges.
 */

import type { GraphProvider } from '../graph-registry';
import type { UnifiedNode, UnifiedEdge } from '../types';
import { getAccessGraph } from '../../access-graph';

export const tenantAccessProvider: GraphProvider = {
  domain: 'tenant_access',
  graphId: 'tenant_access_v1',
  name: 'Tenant Access Graph',
  sourceService: 'AccessGraphService',

  isAvailable(): boolean {
    return getAccessGraph() !== null;
  },

  provide(): { nodes: UnifiedNode[]; edges: UnifiedEdge[] } {
    const graph = getAccessGraph();
    if (!graph) return { nodes: [], edges: [] };

    const nodes: UnifiedNode[] = [];
    const edges: UnifiedEdge[] = [];

    for (const [id, gNode] of graph.getNodes()) {
      const typeMap: Record<string, UnifiedNode['type']> = {
        user: 'tenant_user',
        role: 'role',
        tenant: 'tenant',
        company_group: 'company_group',
        company: 'company',
        resource: 'resource',
      };

      nodes.push({
        uid: `tenant_access:${id}`,
        domain: 'tenant_access',
        type: typeMap[gNode.type] ?? 'resource',
        originalId: id,
        label: (gNode.meta?.name as string) ?? id,
        meta: gNode.meta,
      });
    }

    for (const gEdge of graph.getEdges()) {
      const relationMap: Record<string, UnifiedEdge['relation']> = {
        HAS_ROLE: 'HAS_ROLE',
        GRANTS: 'GRANTS_PERMISSION',
        SCOPED_TO: 'TENANT_SCOPE',
        BELONGS_TO: 'BELONGS_TO',
        IN_GROUP: 'BELONGS_TO',
        IN_TENANT: 'BELONGS_TO',
      };

      edges.push({
        from: `tenant_access:${gEdge.from}`,
        to: `tenant_access:${gEdge.to}`,
        relation: relationMap[gEdge.relation] ?? 'TENANT_SCOPE',
        domain: 'tenant_access',
      });
    }

    return { nodes, edges };
  },
};
