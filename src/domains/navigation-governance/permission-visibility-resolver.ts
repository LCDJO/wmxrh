/**
 * PermissionVisibilityResolver — Filters menu nodes based on RBAC permissions.
 *
 * Integrates with the Security Kernel's permission engine to determine
 * which menu items a user can see based on their effective roles.
 */

import type { MenuNode } from './menu-hierarchy-builder';
import type { NavKey } from '@/domains/security/permissions';
import type { TenantRole } from '@/domains/shared/types';
import { permissionEngine } from '@/domains/security/kernel/permission-engine';

export interface PermissionVisibilityResult {
  visible: MenuNode[];
  hidden_count: number;
  resolved_at: number;
}

/**
 * Map module keys to NavKeys for RBAC checks.
 * Keys not present here are assumed to be accessible.
 */
const MODULE_TO_NAV_KEY: Record<string, NavKey> = {
  core_hr: 'employees',
  employees: 'employees',
  departments: 'departments',
  positions: 'positions',
  companies: 'companies',
  groups: 'groups',
  compensation: 'compensation',
  benefits: 'benefits',
  health: 'health',
  agreements: 'agreements',
  compliance: 'compliance',
  fleet: 'fleet',
  fleet_traccar: 'fleet',
  audit: 'audit',
} as Record<string, any>;

/**
 * Filter a list of menu nodes by RBAC visibility.
 */
export function resolvePermissionVisibility(
  nodes: MenuNode[],
  roles: TenantRole[],
): PermissionVisibilityResult {
  let hiddenCount = 0;

  const filterNodes = (items: MenuNode[]): MenuNode[] => {
    return items.reduce<MenuNode[]>((acc, node) => {
      // Check RBAC for leaf nodes with a module key
      if (node.moduleKey) {
        const navKey = MODULE_TO_NAV_KEY[node.moduleKey];
        if (navKey && !permissionEngine.canNav(navKey, roles)) {
          hiddenCount++;
          return acc;
        }
      }

      // Recurse into children
      const filteredChildren = filterNodes(node.children);

      // Group nodes: hide if all children are hidden
      if (!node.moduleKey && node.children.length > 0 && filteredChildren.length === 0) {
        hiddenCount++;
        return acc;
      }

      acc.push({ ...node, children: filteredChildren });
      return acc;
    }, []);
  };

  return {
    visible: filterNodes(nodes),
    hidden_count: hiddenCount,
    resolved_at: Date.now(),
  };
}
