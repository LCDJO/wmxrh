/**
 * ModulePermissionAdapter — Bridge between Module Federation and the Security Kernel.
 *
 * Responsibilities:
 *   - Map module `required_permissions` to the PermissionEngine
 *   - Auto-register module permissions on module install
 *   - Evaluate tenant-scoped module access
 *   - Expose canActivate / canAccess checks for UI guards
 *
 * PERMISSION NAMING CONVENTION:
 *   {module_id}.{action}
 *   Examples: ads.create_campaign, ads.view_reports, hr.read, compensation.approve
 */

import type { ModuleDescriptor, GlobalEventKernelAPI } from '../types';
import type { ModuleRegistryAPI } from './module-registry';
import type { ModuleManifest } from './module-loader';

// ── Permission Engine Types ────────────────────────────────────

export interface PermissionDefinition {
  /** Full permission key (e.g. "ads.create_campaign") */
  key: string;
  /** Human-readable label */
  label: string;
  /** Module that owns this permission */
  module_id: string;
  /** Category for grouping in admin UI */
  category: string;
  /** Description of what this permission grants */
  description?: string;
  /** Whether this is a dangerous/admin-level permission */
  is_sensitive?: boolean;
}

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

  // ── Permission Engine ──────────────────────────────────────
  /** Register all permissions declared by a module manifest */
  registerModulePermissions(manifest: ModuleManifest): void;
  /** Get all registered permission definitions */
  listPermissions(): PermissionDefinition[];
  /** Get permissions for a specific module */
  listPermissionsForModule(moduleKey: string): PermissionDefinition[];
  /** Check if a specific permission is registered */
  hasPermission(key: string): boolean;
  /** Get a permission definition */
  getPermission(key: string): PermissionDefinition | null;
  /** Check a single permission against context */
  checkPermission(permissionKey: string, ctx: PermissionContext): boolean;
  /** Start auto-registration of permissions on module install events */
  startAutoRegistration(): () => void;
}

export function createModulePermissionAdapter(
  registry: ModuleRegistryAPI,
  events: GlobalEventKernelAPI,
): ModulePermissionAdapterAPI {
  const modules = registry._raw();
  const permissionRegistry = new Map<string, PermissionDefinition>();

  // ── Permission Engine ──────────────────────────────────────

  function registerModulePermissions(manifest: ModuleManifest): void {
    for (const perm of manifest.permissions) {
      // Derive label and category from the permission key
      // e.g. "ads.create_campaign" → category: "ads", label: "Create Campaign"
      const parts = perm.split('.');
      const moduleId = manifest.module_id;
      const action = parts.length > 1 ? parts.slice(1).join('.') : perm;
      const label = action
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      const definition: PermissionDefinition = {
        key: perm,
        label,
        module_id: moduleId,
        category: moduleId,
        description: `Permission "${action}" for module ${manifest.module_name}`,
        is_sensitive: action.includes('admin') || action.includes('delete') || action.includes('manage'),
      };

      permissionRegistry.set(perm, definition);
    }

    events.emit('permissions:module_registered', 'PermissionAdapter', {
      module_id: manifest.module_id,
      count: manifest.permissions.length,
      permissions: manifest.permissions,
    });
  }

  function listPermissions(): PermissionDefinition[] {
    return [...permissionRegistry.values()];
  }

  function listPermissionsForModule(moduleKey: string): PermissionDefinition[] {
    return [...permissionRegistry.values()].filter(p => p.module_id === moduleKey);
  }

  function hasPermission(key: string): boolean {
    return permissionRegistry.has(key);
  }

  function getPermission(key: string): PermissionDefinition | null {
    return permissionRegistry.get(key) ?? null;
  }

  function checkPermission(permissionKey: string, ctx: PermissionContext): boolean {
    return ctx.permissions.includes(permissionKey);
  }

  function startAutoRegistration(): () => void {
    return events.on('module:manifest_registered', (payload: any) => {
      if (payload?.key) {
        // The manifest was just registered in the loader — find it and register perms
        // We emit a request event; the PlatformCore wires this in boot
        events.emit('permissions:auto_register_requested', 'PermissionAdapter', { key: payload.key });
      }
    });
  }

  // ── Access Checks ──────────────────────────────────────────

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
    registerModulePermissions,
    listPermissions,
    listPermissionsForModule,
    hasPermission,
    getPermission,
    checkPermission,
    startAutoRegistration,
  };
}
