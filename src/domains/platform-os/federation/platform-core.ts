/**
 * PlatformCore — Unified facade composing all Module Federation services.
 *
 * PlatformCore
 *  ├── ModuleRegistry        (catalog & storage)
 *  ├── ModuleLoader          (dynamic lazy-loading)
 *  ├── ModuleSandbox         (isolated execution contexts)
 *  ├── ModuleLifecycleManager(state machine, dependency graph)
 *  └── ModulePermissionAdapter(security bridge, tenant scoping)
 */

import type { GlobalEventKernelAPI, ModuleRegistration, ModuleDescriptor } from '../types';
import { MODULE_FEDERATION_MAP } from './module-definitions';
import { createModuleRegistry, type ModuleRegistryAPI } from './module-registry';
import { createModuleLoader, type ModuleLoaderAPI, type ModuleManifest, type ModuleWidget, type ModuleNavigationEntry, type ModuleLoadContext } from './module-loader';
import { createModuleSandbox, type ModuleSandboxAPI, type SandboxContext } from './module-sandbox';
import { createModuleLifecycleManager, type ModuleLifecycleManagerAPI } from './module-lifecycle-manager';
import { createModulePermissionAdapter, type ModulePermissionAdapterAPI, type PermissionContext } from './module-permission-adapter';

export interface PlatformCoreAPI {
  // ── Registry ───────────────────────────────────────────────
  register(mod: ModuleRegistration, manifest?: ModuleManifest): void;
  unregister(key: string): void;
  get(key: string): ModuleDescriptor | null;
  list(): ModuleDescriptor[];
  listActive(): ModuleDescriptor[];

  // ── Lifecycle ──────────────────────────────────────────────
  activate(key: string): Promise<void>;
  deactivate(key: string): Promise<void>;
  activateWithDeps(key: string): Promise<void>;
  deactivateWithDeps(key: string): Promise<void>;
  activateIfNeeded(key: string): Promise<void>;
  dependencyGraph(): Record<string, string[]>;
  activationOrder(key: string): string[];

  // ── Loader ─────────────────────────────────────────────────
  getComponent(key: string): React.LazyExoticComponent<React.ComponentType<any>> | null;
  preloadModule(key: string): Promise<void>;
  getManifest(key: string): ModuleManifest | null;
  /** Resolve modules eligible for a given runtime context */
  resolveForContext(ctx: ModuleLoadContext): ModuleManifest[];
  /** Resolve widgets for a shell slot given a context */
  resolveWidgets(slot: ModuleWidget['slot'], ctx: ModuleLoadContext): ModuleWidget[];
  /** Resolve navigation entries given a context */
  resolveNavigation(ctx: ModuleLoadContext): ModuleNavigationEntry[];
  /** Bulk-register all modules from MODULE_FEDERATION_MAP */
  registerAll(): void;

  // ── Sandbox ────────────────────────────────────────────────
  sandbox(key: string): SandboxContext;
  destroySandbox(key: string): void;

  // ── Permissions ────────────────────────────────────────────
  canActivate(key: string, ctx: PermissionContext): boolean;
  canAccess(key: string, ctx: PermissionContext): boolean;
  missingPermissions(key: string, ctx: PermissionContext): string[];
  filterAccessible(modules: ModuleDescriptor[], ctx: PermissionContext): ModuleDescriptor[];

  // ── Tenant Scoping ─────────────────────────────────────────
  isEnabledForTenant(key: string, tenantId: string): boolean;
  enableForTenant(key: string, tenantId: string): void;
  disableForTenant(key: string, tenantId: string): void;
  listForTenant(tenantId: string): ModuleDescriptor[];

  // ── Sub-systems (for advanced usage) ───────────────────────
  readonly registry: ModuleRegistryAPI;
  readonly loader: ModuleLoaderAPI;
  readonly sandboxManager: ModuleSandboxAPI;
  readonly lifecycle: ModuleLifecycleManagerAPI;
  readonly permissions: ModulePermissionAdapterAPI;
}

export function createPlatformCore(events: GlobalEventKernelAPI): PlatformCoreAPI {
  const registry = createModuleRegistry(events);
  const loader = createModuleLoader(events);
  const sandboxManager = createModuleSandbox(events);
  const lifecycle = createModuleLifecycleManager(registry, events);
  const permissions = createModulePermissionAdapter(registry, events);

  // ── Composed API ─────────────────────────────────────────────

  function register(mod: ModuleRegistration, manifest?: ModuleManifest): void {
    registry.register(mod);
    if (manifest) {
      loader.registerManifest(manifest);
      // Auto-register module permissions in the PermissionEngine
      permissions.registerModulePermissions(manifest);
    }
    // Auto-create sandbox on registration
    sandboxManager.create(mod.key as string);
    events.emit('platform:module_federated', 'PlatformCore', { key: mod.key });
  }

  function unregister(key: string): void {
    sandboxManager.destroy(key);
    registry.unregister(key);
  }

  async function activate(key: string): Promise<void> {
    await lifecycle.activate(key);
  }

  async function deactivate(key: string): Promise<void> {
    await lifecycle.deactivate(key);
    // Destroy sandbox on deactivation to free resources
    sandboxManager.destroy(key);
  }

  return {
    register,
    unregister,
    get: (key) => registry.get(key),
    list: () => registry.list(),
    listActive: () => lifecycle.listActive(),

    activate,
    deactivate,
    activateWithDeps: (key) => lifecycle.activateWithDeps(key),
    deactivateWithDeps: (key) => lifecycle.deactivateWithDeps(key),
    activateIfNeeded: (key) => lifecycle.activateIfNeeded(key),
    dependencyGraph: () => lifecycle.dependencyGraph(),
    activationOrder: (key) => lifecycle.activationOrder(key),

    getComponent: (key) => loader.getComponent(key),
    preloadModule: (key) => loader.preload(key),
    getManifest: (key) => loader.getManifest(key),
    resolveForContext: (ctx) => loader.resolveForContext(ctx, (k, t) => permissions.isEnabledForTenant(k, t)),
    resolveWidgets: (slot, ctx) => loader.resolveWidgets(slot, ctx, (k, t) => permissions.isEnabledForTenant(k, t)),
    resolveNavigation: (ctx) => loader.resolveNavigation(ctx, (k, t) => permissions.isEnabledForTenant(k, t)),
    registerAll() {
      for (const { registration, manifest } of MODULE_FEDERATION_MAP) {
        register(registration, manifest);
      }
      events.emit('platform:all_modules_registered', 'PlatformCore', {
        count: MODULE_FEDERATION_MAP.length,
        keys: MODULE_FEDERATION_MAP.map(m => m.registration.key),
      });
    },

    sandbox: (key) => sandboxManager.create(key),
    destroySandbox: (key) => sandboxManager.destroy(key),

    canActivate: (key, ctx) => permissions.canActivate(key, ctx),
    canAccess: (key, ctx) => permissions.canAccess(key, ctx),
    missingPermissions: (key, ctx) => permissions.missingPermissions(key, ctx),
    filterAccessible: (mods, ctx) => permissions.filterAccessible(mods, ctx),

    isEnabledForTenant: (key, tid) => permissions.isEnabledForTenant(key, tid),
    enableForTenant: (key, tid) => permissions.enableForTenant(key, tid),
    disableForTenant: (key, tid) => permissions.disableForTenant(key, tid),
    listForTenant: (tid) => permissions.listForTenant(tid),

    registry,
    loader,
    sandboxManager,
    lifecycle,
    permissions,
  };
}
