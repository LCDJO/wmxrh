/**
 * Identity Graph → UGE Provider
 * Creates identity-link edges between the same user across platform & tenant domains.
 * Also exposes impersonation state as edges.
 */

import type { GraphProvider } from '../graph-registry';
import type { UnifiedNode, UnifiedEdge } from '../types';
import { dualIdentityEngine } from '../../dual-identity-engine';

export const identityProvider: GraphProvider = {
  domain: 'identity',
  graphId: 'identity_v1',
  name: 'Identity Graph',
  sourceService: 'DualIdentityEngine',

  isAvailable(): boolean {
    return dualIdentityEngine.realIdentity !== null;
  },

  provide(): { nodes: UnifiedNode[]; edges: UnifiedEdge[] } {
    const real = dualIdentityEngine.realIdentity;
    if (!real) return { nodes: [], edges: [] };

    const nodes: UnifiedNode[] = [];
    const edges: UnifiedEdge[] = [];

    // Real identity node
    const realUid = `identity:user:${real.userId}`;
    nodes.push({
      uid: realUid,
      domain: 'identity',
      type: 'identity_session',
      originalId: real.userId,
      label: real.email ?? real.userId,
      meta: { userType: real.userType, platformRole: real.platformRole },
    });

    // Cross-domain links (identity ↔ platform_access, identity ↔ tenant_access)
    edges.push({
      from: realUid,
      to: `platform_access:${real.userId}`,
      relation: 'IDENTITY_LINK',
      domain: 'identity',
    });
    edges.push({
      from: realUid,
      to: `tenant_access:user:${real.userId}`,
      relation: 'IDENTITY_LINK',
      domain: 'identity',
    });

    // Impersonation edge
    if (dualIdentityEngine.isImpersonating) {
      const active = dualIdentityEngine.activeIdentity;
      if (active.userId !== real.userId) {
        const activeUid = `identity:impersonated:${active.userId}`;
        nodes.push({
          uid: activeUid,
          domain: 'identity',
          type: 'identity_session',
          originalId: active.userId,
          label: `Impersonated: ${active.userId}`,
          meta: { tenantId: active.tenantId, userType: active.userType },
        });
        edges.push({
          from: realUid,
          to: activeUid,
          relation: 'IMPERSONATES',
          domain: 'identity',
        });
      }
    }

    return { nodes, edges };
  },
};
