/**
 * MenuHierarchyBuilder — Builds the navigation tree for Platform and Tenant panels.
 *
 * Consumes the MenuDomainClassifier output and produces a hierarchical menu
 * structure grouped by domain, with ordering and nesting.
 */

import { PLATFORM_MODULES } from '@/domains/platform/platform-modules';
import {
  type ModuleDomain,
  DOMAIN_METADATA,
  classifyModule,
  getDomainsByScope,
} from './menu-domain-classifier';

export interface MenuNode {
  id: string;
  label: string;
  icon?: string;
  domain: ModuleDomain;
  scope: 'platform' | 'tenant';
  path?: string;
  moduleKey?: string;
  children: MenuNode[];
  priority: number;
}

export interface MenuHierarchy {
  platform: MenuNode[];
  tenant: MenuNode[];
  built_at: number;
}

/** Domain display order (lower = higher) */
const DOMAIN_PRIORITY: Record<ModuleDomain, number> = {
  core_saas: 10,
  security: 20,
  billing: 30,
  architecture: 40,
  monitoring: 50,
  tenant_hr: 10,
  tenant_finance: 20,
  tenant_marketing: 30,
  tenant_automation: 40,
};

/**
 * Build a full menu hierarchy from the module registry.
 * Groups modules by domain, then by scope (platform vs tenant).
 */
export function buildMenuHierarchy(
  allowedModules?: string[],
): MenuHierarchy {
  const groups = new Map<ModuleDomain, MenuNode[]>();

  for (const mod of PLATFORM_MODULES) {
    // If allowedModules provided, skip modules not in list (tenant-side filtering)
    if (allowedModules && !allowedModules.includes(mod.key)) continue;

    const domain = classifyModule(mod.key);
    if (!groups.has(domain)) groups.set(domain, []);

    groups.get(domain)!.push({
      id: mod.key,
      label: mod.label,
      icon: mod.icon,
      domain,
      scope: mod.category === 'platform' ? 'platform' : 'tenant',
      moduleKey: mod.key,
      children: [],
      priority: 0,
    });
  }

  const platformDomains = getDomainsByScope('platform');
  const tenantDomains = getDomainsByScope('tenant');

  const buildScopeTree = (domains: typeof platformDomains): MenuNode[] => {
    return domains
      .sort((a, b) => DOMAIN_PRIORITY[a.domain] - DOMAIN_PRIORITY[b.domain])
      .map(d => ({
        id: `group:${d.domain}`,
        label: d.label,
        domain: d.domain,
        scope: d.scope,
        children: groups.get(d.domain) ?? [],
        priority: DOMAIN_PRIORITY[d.domain],
      }))
      .filter(g => g.children.length > 0);
  };

  return {
    platform: buildScopeTree(platformDomains),
    tenant: buildScopeTree(tenantDomains),
    built_at: Date.now(),
  };
}

/**
 * Flatten a menu hierarchy into a flat list (for search, rendering, etc.).
 */
export function flattenHierarchy(tree: MenuNode[]): MenuNode[] {
  const result: MenuNode[] = [];
  const walk = (nodes: MenuNode[]) => {
    for (const n of nodes) {
      result.push(n);
      walk(n.children);
    }
  };
  walk(tree);
  return result;
}
