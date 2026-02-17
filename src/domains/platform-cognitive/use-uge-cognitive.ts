/**
 * useUGECognitive — Hook that bridges UGE analytics with the CognitiveLayer.
 *
 * READ-ONLY: Collects UGE graph data (analysis, overlaps, risk) and sends
 * it to the CognitiveLayer for AI-powered suggestions. Never mutates permissions.
 *
 * Intents:
 *   - 'uge-simplify-roles'               → Role consolidation suggestions
 *   - 'uge-remove-redundant-permissions'  → Redundant permission detection
 */
import { useCallback, useMemo } from 'react';
import { usePlatformCognitive } from '@/domains/platform/use-platform-cognitive';
import { unifiedGraphEngine } from '@/domains/security/kernel/unified-graph-engine';
import type { UnifiedNode } from '@/domains/security/kernel/unified-graph-engine';
import type { CognitiveIntent, CognitiveResponse } from '@/domains/platform-cognitive/types';

export interface UGEGraphData {
  roleOverlaps: Array<{
    roleA: string;
    roleB: string;
    overlapRatio: number;
    sharedCount: number;
  }>;
  roles: Array<{ uid: string; label: string; domain: string; permissionCount: number }>;
  permissionUsage: Array<{ uid: string; label: string; grantedByCount: number; usersWithAccess: number }>;
  excessivePermissions: Array<{ userLabel: string; permissionCount: number }>;
  orphanNodes: Array<{ uid: string; label: string; type: string }>;
  analysisStats: {
    totalNodes: number;
    totalEdges: number;
    totalRoles: number;
    totalPermissions: number;
    totalUsers: number;
  };
}

function collectUGEData(): UGEGraphData {
  try {
    const report = unifiedGraphEngine.buildFullReport();
    const { analysis, snapshot } = report;

    // Role overlaps
    const roleOverlaps = analysis.roleOverlaps.map(o => ({
      roleA: o.roleA.label,
      roleB: o.roleB.label,
      overlapRatio: o.overlapRatio,
      sharedCount: o.sharedPermissions.length,
    }));

    // Roles with permission counts
    const allNodes: UnifiedNode[] = Array.from(snapshot.nodes.values());
    const roleNodes = allNodes.filter(n => n.type === 'role');
    const roles = roleNodes.map(r => {
      const permCount = snapshot.edges.filter(
        e => e.from === r.uid && ['GRANTS_PERMISSION', 'PLATFORM_GRANTS', 'TENANT_GRANTS'].includes(e.relation),
      ).length;
      return { uid: r.uid, label: r.label, domain: r.domain, permissionCount: permCount };
    });

    // Permission usage summary (top 20)
    const permNodes = allNodes.filter(n => n.type === 'permission');
    const permissionUsage = permNodes.slice(0, 20).map(p => {
      const grantedByCount = snapshot.edges.filter(
        e => e.to === p.uid && ['GRANTS_PERMISSION', 'PLATFORM_GRANTS', 'TENANT_GRANTS'].includes(e.relation),
      ).length;
      const roleUids = new Set(
        snapshot.edges.filter(
          e => e.to === p.uid && ['GRANTS_PERMISSION', 'PLATFORM_GRANTS', 'TENANT_GRANTS'].includes(e.relation),
        ).map(e => e.from),
      );
      const usersWithAccess = snapshot.edges.filter(
        e => ['HAS_ROLE', 'HAS_PLATFORM_ROLE', 'HAS_TENANT_ROLE'].includes(e.relation) && roleUids.has(e.to),
      ).length;
      return { uid: p.uid, label: p.label, grantedByCount, usersWithAccess };
    });

    // Excessive permissions
    const excessivePermissions = analysis.excessivePermissions.map(ep => ({
      userLabel: ep.user.label,
      permissionCount: ep.permissionCount,
    }));

    // Orphan nodes
    const orphanNodes = analysis.orphanNodes.slice(0, 10).map(n => ({
      uid: n.uid, label: n.label, type: n.type,
    }));

    // Stats
    const analysisStats = {
      totalNodes: snapshot.nodes.size,
      totalEdges: snapshot.edges.length,
      totalRoles: roleNodes.length,
      totalPermissions: permNodes.length,
      totalUsers: allNodes.filter(
        n => n.type === 'platform_user' || n.type === 'tenant_user',
      ).length,
    };

    return { roleOverlaps, roles, permissionUsage, excessivePermissions, orphanNodes, analysisStats };
  } catch {
    return {
      roleOverlaps: [], roles: [], permissionUsage: [],
      excessivePermissions: [], orphanNodes: [],
      analysisStats: { totalNodes: 0, totalEdges: 0, totalRoles: 0, totalPermissions: 0, totalUsers: 0 },
    };
  }
}

export function useUGECognitive() {
  const cognitive = usePlatformCognitive();

  const graphData = useMemo(() => collectUGEData(), []);

  const suggestRoleSimplification = useCallback(
    (caller: { role: string; email: string }) => {
      return cognitive.ask('uge-simplify-roles' as CognitiveIntent, caller, {
        uge_graph_data: graphData,
      });
    },
    [cognitive, graphData],
  );

  const suggestRedundantPermissions = useCallback(
    (caller: { role: string; email: string }) => {
      return cognitive.ask('uge-remove-redundant-permissions' as CognitiveIntent, caller, {
        uge_graph_data: graphData,
      });
    },
    [cognitive, graphData],
  );

  return {
    ...cognitive,
    graphData,
    suggestRoleSimplification,
    suggestRedundantPermissions,
  };
}
