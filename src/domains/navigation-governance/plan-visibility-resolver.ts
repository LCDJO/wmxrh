/**
 * PlanBasedVisibilityResolver — Filters menu nodes based on tenant plan.
 *
 * Integrates with PXE (Platform Experience Engine) to hide modules
 * not included in the tenant's contracted plan.
 */

import type { MenuNode } from './menu-hierarchy-builder';

export interface PlanVisibilityResult {
  visible: MenuNode[];
  gated_modules: string[];
  resolved_at: number;
}

/**
 * Filter menu nodes by plan-allowed modules.
 *
 * @param nodes       - Menu tree to filter
 * @param allowedModules - Module keys allowed by the tenant's plan
 * @param isModuleAccessible - Optional PXE check function (overrides allowedModules if provided)
 */
export function resolvePlanVisibility(
  nodes: MenuNode[],
  allowedModules: string[],
  isModuleAccessible?: (key: string) => boolean,
): PlanVisibilityResult {
  const gated: string[] = [];
  const allowedSet = new Set(allowedModules);

  const check = (key: string): boolean => {
    if (isModuleAccessible) return isModuleAccessible(key);
    return allowedSet.has(key);
  };

  const filterNodes = (items: MenuNode[]): MenuNode[] => {
    return items.reduce<MenuNode[]>((acc, node) => {
      if (node.moduleKey && !check(node.moduleKey)) {
        gated.push(node.moduleKey);
        return acc;
      }

      const filteredChildren = filterNodes(node.children);

      // Group with no remaining children → hide
      if (!node.moduleKey && node.children.length > 0 && filteredChildren.length === 0) {
        return acc;
      }

      acc.push({ ...node, children: filteredChildren });
      return acc;
    }, []);
  };

  return {
    visible: filterNodes(nodes),
    gated_modules: gated,
    resolved_at: Date.now(),
  };
}
