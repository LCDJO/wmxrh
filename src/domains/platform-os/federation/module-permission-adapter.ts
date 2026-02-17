/**
 * ModulePermissionAdapter — Bridge between Module Federation and the Security Kernel.
 *
 * Responsibilities:
 *   - Map module `required_permissions` to the SecurityKernel Access Graph
 *   - Evaluate tenant-scoped module access
 *   - Expose canActivate / canAccess checks for UI guards
 */

import type { ModuleDescriptor, GlobalEventKernelAPI } from '../types';
import type { ModuleRegistryAPI } from './module-registry';

// ── Types ──────────────────────────────────────────────────────

export interface PermissionContext {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export interface ModulePermissionAdapterAPI {
  /** Check if a user context has all permissions required by a module */
  canActivate(moduleKey: string, ctx: PermissionContext): boolean;
  /** Check if a module is accessible (activated + permissions) */
  canAccess(moduleKey: string, ctx: PermissionContext): boolean;
  /** Get missing permissions for a module */
  missingPermissions(moduleKey: string, ctx: PermissionContext): string[];
  /** Bulk check: filter module list to only accessible ones */
  filterAccessible(modules: ModuleDescriptor[], ctx: PermissionContext): ModuleDescriptor[];
  /** Tenant-scoped module availability */
  isEnabledForTenant(moduleKey: string, tenantId: string): boolean;
  enableForTenant(moduleKey: string, tenantId: string): void;
  disableForTenant(moduleKey: string, tenantId: string): void;
  listForTenant(tenantId: string): ModuleDescriptor[];
}

export function createModulePermissionAdapter(
  registry: ModuleRegistryAPI,
  events: GlobalEventKernelAPI,
): ModulePermissionAdapterAPI {
  const modules = registry._raw();

  function canActivate(moduleKey: string, ctx: PermissionContext): boolean {
    const mod = registry.get(moduleKey);
    if (!mod) return false;
    if (!isEnabledForTenant(moduleKey, ctx.tenantId)) return false;
    if (mod.required_permissions.length === 0) return true;
    return mod.required_permissions.every(p => ctx.permissions.includes(p));
  }

  function canAccess(moduleKey: string, ctx: PermissionContext): boolean {
    const mod = registry.get(moduleKey);
    if (!mod) return false;
    if (mod.status !== 'active') return false;
    return canActivate(moduleKey, ctx);
  }

  function missingPermissions(moduleKey: string, ctx: PermissionContext): string[] {
    const mod = registry.get(moduleKey);
    if (!mod) return [];
    return mod.required_permissions.filter(p => !ctx.permissions.includes(p));
  }

  function filterAccessible(mods: ModuleDescriptor[], ctx: PermissionContext): ModuleDescriptor[] {
    return mods.filter(m => canAccess(m.key as string, ctx));
  }

  // ── Tenant-Scoped ────────────────────────────────────────────

  function isEnabledForTenant(key: string, tenantId: string): boolean {
    const mod = modules.get(key);
    if (!mod) return false;
    if (mod.is_core) return true;
    if (mod.disabled_tenants.includes(tenantId)) return false;
    if (mod.enabled_tenants.length === 0) return true;
    return mod.enabled_tenants.includes(tenantId);
  }

  function enableForTenant(key: string, tenantId: string): void {
    const mod = modules.get(key);
    if (!mod) return;
    mod.disabled_tenants = mod.disabled_tenants.filter(t => t !== tenantId);
    if (mod.enabled_tenants.length > 0 && !mod.enabled_tenants.includes(tenantId)) {
      mod.enabled_tenants.push(tenantId);
    }
    events.emit('module:tenant-enabled', 'PermissionAdapter', { key, tenantId });
  }

  function disableForTenant(key: string, tenantId: string): void {
    const mod = modules.get(key);
    if (!mod || mod.is_core) return;
    if (!mod.disabled_tenants.includes(tenantId)) {
      mod.disabled_tenants.push(tenantId);
    }
    mod.enabled_tenants = mod.enabled_tenants.filter(t => t !== tenantId);
    events.emit('module:tenant-disabled', 'PermissionAdapter', { key, tenantId });
  }

  function listForTenant(tenantId: string): ModuleDescriptor[] {
    return registry.list().filter(m => isEnabledForTenant(m.key as string, tenantId));
  }

  return {
    canActivate,
    canAccess,
    missingPermissions,
    filterAccessible,
    isEnabledForTenant,
    enableForTenant,
    disableForTenant,
    listForTenant,
  };
}
