/**
 * UIFE → UGE Provider
 *
 * Exposes federation topology (IdPs, sessions, protocol links)
 * as nodes & edges in the Unified Graph Engine.
 */

import type { GraphProvider } from '../kernel/unified-graph-engine/graph-registry';
import type { UnifiedNode, UnifiedEdge } from '../kernel/unified-graph-engine/types';
import { getIdentityFederationEngine } from './identity-federation-engine';

export const federationGraphProvider: GraphProvider = {
  domain: 'federation',
  graphId: 'federation_v1',
  name: 'Identity Federation Graph',
  sourceService: 'IdentityFederationEngine',

  isAvailable(): boolean {
    const engine = getIdentityFederationEngine();
    return engine.getHealth().initialized;
  },

  provide(): { nodes: UnifiedNode[]; edges: UnifiedEdge[] } {
    const engine = getIdentityFederationEngine();
    const health = engine.getHealth();

    if (!health.initialized || !health.tenant_id) {
      return { nodes: [], edges: [] };
    }

    const nodes: UnifiedNode[] = [];
    const edges: UnifiedEdge[] = [];

    // Tenant federation hub node
    const hubUid = `federation:tenant:${health.tenant_id}`;
    nodes.push({
      uid: hubUid,
      domain: 'federation',
      type: 'federation_hub',
      originalId: health.tenant_id,
      label: `Federation Hub`,
      meta: {
        idp_count: health.idp_count,
        protocols: Object.entries(health.protocol_support)
          .filter(([, v]) => v)
          .map(([k]) => k),
      },
    });

    // Cross-domain link to tenant access graph
    edges.push({
      from: hubUid,
      to: `tenant_access:tenant:${health.tenant_id}`,
      relation: 'FEDERATION_LINK',
      domain: 'federation',
    });

    // Cross-domain link to identity graph
    edges.push({
      from: hubUid,
      to: `identity:user:*`,
      relation: 'FEDERATED_IDENTITY',
      domain: 'federation',
    });

    // Protocol capability nodes
    for (const [protocol, supported] of Object.entries(health.protocol_support)) {
      if (!supported) continue;
      const protoUid = `federation:protocol:${protocol}`;
      nodes.push({
        uid: protoUid,
        domain: 'federation',
        type: 'federation_protocol',
        originalId: protocol,
        label: protocol.toUpperCase(),
        meta: { protocol },
      });
      edges.push({
        from: hubUid,
        to: protoUid,
        relation: 'SUPPORTS_PROTOCOL',
        domain: 'federation',
      });
    }

    return { nodes, edges };
  },
};
