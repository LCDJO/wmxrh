/**
 * PermissionVisibilityResolver — Filters menu nodes based on RBAC + Access Graph.
 *
 * Integrates with:
 *   1. Security Kernel's permission engine (canNav)
 *   2. Access Graph (group-based inheritance, scope hierarchy)
 *
 * Group inheritance: if a parent group grants access, all child groups inherit it.
 */

import type { MenuNode } from './menu-hierarchy-builder';
import type { NavKey } from '@/domains/security/permissions';
import type { TenantRole } from '@/domains/shared/types';
import { permissionEngine } from '@/domains/security/kernel/permission-engine';
import { getAccessGraph } from '@/domains/security/kernel/access-graph';

export interface PermissionVisibilityResult {
  visible: MenuNode[];
  hidden_count: number;
  hidden_keys: string[];
  resolved_at: number;
  used_access_graph: boolean;
}

/**
 * Map module keys to NavKeys for RBAC checks.
 * Keys not present here are assumed accessible.
 */
const MODULE_TO_NAV_KEY: Partial<Record<string, NavKey>> = {
  core_hr: 'employees',
  employees: 'employees',
  departments: 'departments',
  positions: 'positions',
  companies: 'companies',
  groups: 'groups',
  compensation: 'compensation',
  benefits: 'benefits',
  health: 'health' as NavKey,
  agreements: 'employees',
  compliance: 'compliance',
  fleet: 'fleet' as NavKey,
  fleet_traccar: 'fleet' as NavKey,
  audit: 'audit',
  labor_rules: 'labor_rules',
  labor_compliance: 'labor_compliance',
};

/**
 * Check Access Graph for inherited permissions via group hierarchy.
 * Returns true if the user has access through any group in the graph.
 */
function checkAccessGraphInheritance(moduleKey: string): boolean {
  const graph = getAccessGraph();
  if (!graph) return true; // No graph = no extra restrictions

  // Use the graph's precomputed roles (includes group-inherited roles)
  const graphRoles = Array.from(graph.getRoles());
  if (graphRoles.length === 0) return true;

  const navKey = MODULE_TO_NAV_KEY[moduleKey];
  if (!navKey) return true;

  // Check with graph's effective roles which include group inheritance
  return permissionEngine.canNav(navKey, graphRoles);
}

/**
 * Filter a list of menu nodes by RBAC + Access Graph visibility.
 *
 * Pipeline:
 *   1. Check permissionEngine.canNav (direct RBAC)
 *   2. Check Access Graph for group-inherited permissions
 *   3. Remove empty groups
 */
export function resolvePermissionVisibility(
  nodes: MenuNode[],
  roles: TenantRole[],
): PermissionVisibilityResult {
  const hiddenKeys: string[] = [];
  const graph = getAccessGraph();

  const filterNodes = (items: MenuNode[]): MenuNode[] => {
    return items.reduce<MenuNode[]>((acc, node) => {
      if (node.moduleKey) {
        const navKey = MODULE_TO_NAV_KEY[node.moduleKey];

        // Layer 1: Direct RBAC check
        if (navKey && !permissionEngine.canNav(navKey, roles)) {
          // Layer 2: Check Access Graph group inheritance
          if (!checkAccessGraphInheritance(node.moduleKey)) {
            hiddenKeys.push(node.moduleKey);
            return acc;
          }
        }
      }

      // Recurse into children
      const filteredChildren = filterNodes(node.children);

      // Group nodes: hide if all children are hidden
      if (!node.moduleKey && node.children.length > 0 && filteredChildren.length === 0) {
        hiddenKeys.push(node.id);
        return acc;
      }

      acc.push({ ...node, children: filteredChildren });
      return acc;
    }, []);
  };

  return {
    visible: filterNodes(nodes),
    hidden_count: hiddenKeys.length,
    hidden_keys: hiddenKeys,
    resolved_at: Date.now(),
    used_access_graph: !!graph,
  };
}
