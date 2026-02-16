/**
 * ModuleOrchestrator — Module registration, activation, and lifecycle.
 *
 * Controls:
 *   - Tenant-scoped activation (enable/disable per tenant)
 *   - Full lifecycle (register → activate → suspend → error)
 *   - Dependency resolution with topological sort
 *   - Cascading activate/deactivate respecting the dep graph
 */

import type {
  ModuleOrchestratorAPI,
  ModuleDescriptor,
  ModuleRegistration,
  ModuleStatus,
  GlobalEventKernelAPI,
} from './types';
import { PLATFORM_EVENTS } from './platform-events';
import type { ModuleRegisteredPayload } from './platform-events';

interface InternalModule extends ModuleDescriptor {
  _onActivate?: () => void | Promise<void>;
  _onDeactivate?: () => void | Promise<void>;
  _onError?: (error: Error) => void;
}

export function createModuleOrchestrator(events: GlobalEventKernelAPI): ModuleOrchestratorAPI {
  const modules = new Map<string, InternalModule>();

  // ── Helpers ──────────────────────────────────────────────────

  function toDescriptor(mod: InternalModule): ModuleDescriptor {
    const { _onActivate, _onDeactivate, _onError, ...descriptor } = mod;
    return descriptor;
  }

  // ── Registration ─────────────────────────────────────────────

  function register(mod: ModuleRegistration): void {
    if (modules.has(mod.key)) {
      console.warn(`[ModuleOrchestrator] module "${mod.key}" already registered, updating`);
    }

    modules.set(mod.key, {
      key: mod.key,
      label: mod.label,
      status: 'registered' as ModuleStatus,
      version: mod.version ?? '1.0.0',
      routes: mod.routes ?? [],
      required_permissions: mod.required_permissions ?? [],
      dependencies: mod.dependencies ?? [],
      cognitive_signals: mod.cognitive_signals ?? [],
      registered_at: Date.now(),
      activated_at: null,
      deactivated_at: null,
      is_core: mod.is_core ?? false,
      enabled_tenants: mod.enabled_tenants ?? [],
      disabled_tenants: [],
      _onActivate: mod.onActivate,
      _onDeactivate: mod.onDeactivate,
      _onError: mod.onError,
    });

    events.emit('module:registered', 'ModuleOrchestrator', {
      key: mod.key,
      label: mod.label,
      is_core: mod.is_core ?? false,
    });

    // ── Canonical: ModuleRegistered ─────────────────────────
    events.emit<ModuleRegisteredPayload>(
      PLATFORM_EVENTS.ModuleRegistered,
      'ModuleOrchestrator',
      { key: mod.key, label: mod.label, enabled: false },
    );
  }

  // ── Activation / Deactivation ────────────────────────────────

  async function activate(key: string): Promise<void> {
    const mod = modules.get(key);
    if (!mod) throw new Error(`Module "${key}" not registered`);
    if (mod.status === 'active') return;

    // Check direct dependencies are active
    for (const dep of mod.dependencies) {
      const depMod = modules.get(dep);
      if (!depMod || depMod.status !== 'active') {
        throw new Error(`Module "${key}" depends on "${dep}" which is not active`);
      }
    }

    mod.status = 'activating';
    try {
      if (mod._onActivate) await mod._onActivate();
      mod.status = 'active';
      mod.activated_at = Date.now();
      mod.error = undefined;
      events.emit('module:activated', 'ModuleOrchestrator', { key });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      mod.status = 'error';
      mod.error = error.message;
      mod._onError?.(error);
      events.emit('module:error', 'ModuleOrchestrator', { key, error: mod.error });
      throw err;
    }
  }

  async function deactivate(key: string): Promise<void> {
    const mod = modules.get(key);
    if (!mod || mod.status !== 'active') return;

    if (mod.is_core) {
      throw new Error(`Cannot deactivate core module "${key}"`);
    }

    // Check if active modules depend on this one
    const dependents = [...modules.values()].filter(
      m => m.status === 'active' && m.dependencies.includes(key),
    );
    if (dependents.length > 0) {
      throw new Error(
        `Cannot deactivate "${key}": modules [${dependents.map(d => d.key).join(', ')}] depend on it`,
      );
    }

    try {
      if (mod._onDeactivate) await mod._onDeactivate();
      mod.status = 'suspended';
      mod.deactivated_at = Date.now();
      events.emit('module:deactivated', 'ModuleOrchestrator', { key });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      mod.status = 'error';
      mod.error = error.message;
      mod._onError?.(error);
    }
  }

  // ── Queries ──────────────────────────────────────────────────

  function get(key: string): ModuleDescriptor | null {
    const mod = modules.get(key);
    return mod ? toDescriptor(mod) : null;
  }

  function list(): ModuleDescriptor[] {
    return [...modules.values()].map(toDescriptor);
  }

  function listActive(): ModuleDescriptor[] {
    return list().filter(m => m.status === 'active');
  }

  // ── Tenant-Scoped Activation ─────────────────────────────────

  function isEnabledForTenant(key: string, tenantId: string): boolean {
    const mod = modules.get(key);
    if (!mod) return false;
    if (mod.is_core) return true;
    if (mod.disabled_tenants.includes(tenantId)) return false;
    // If enabled_tenants is empty → available to all
    if (mod.enabled_tenants.length === 0) return true;
    return mod.enabled_tenants.includes(tenantId);
  }

  function enableForTenant(key: string, tenantId: string): void {
    const mod = modules.get(key);
    if (!mod) return;
    // Remove from disabled
    mod.disabled_tenants = mod.disabled_tenants.filter(t => t !== tenantId);
    // Add to enabled if using allow-list
    if (mod.enabled_tenants.length > 0 && !mod.enabled_tenants.includes(tenantId)) {
      mod.enabled_tenants.push(tenantId);
    }
    events.emit('module:tenant-enabled', 'ModuleOrchestrator', { key, tenantId });
  }

  function disableForTenant(key: string, tenantId: string): void {
    const mod = modules.get(key);
    if (!mod || mod.is_core) return;
    if (!mod.disabled_tenants.includes(tenantId)) {
      mod.disabled_tenants.push(tenantId);
    }
    mod.enabled_tenants = mod.enabled_tenants.filter(t => t !== tenantId);
    events.emit('module:tenant-disabled', 'ModuleOrchestrator', { key, tenantId });
  }

  function listForTenant(tenantId: string): ModuleDescriptor[] {
    return list().filter(m => isEnabledForTenant(m.key as string, tenantId));
  }

  // ── Dependency Graph ─────────────────────────────────────────

  function dependencyGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    for (const [key, mod] of modules) {
      graph[key] = [...mod.dependencies] as string[];
    }
    return graph;
  }

  /**
   * Topological sort: returns activation order (deps first, then target).
   * Detects circular dependencies.
   */
  function activationOrder(key: string): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    function visit(k: string) {
      if (visited.has(k)) return;
      if (visiting.has(k)) throw new Error(`Circular dependency detected involving "${k}"`);
      visiting.add(k);

      const mod = modules.get(k);
      if (mod) {
        for (const dep of mod.dependencies) {
          visit(dep as string);
        }
      }

      visiting.delete(k);
      visited.add(k);
      order.push(k);
    }

    visit(key);
    return order;
  }

  async function activateWithDeps(key: string): Promise<void> {
    const order = activationOrder(key);
    for (const k of order) {
      const mod = modules.get(k);
      if (mod && mod.status !== 'active') {
        await activate(k);
      }
    }
  }

  async function deactivateWithDeps(key: string): Promise<void> {
    // Find all modules that transitively depend on key
    const toDeactivate: string[] = [];

    function collectDependents(k: string) {
      for (const [mKey, mod] of modules) {
        if (mod.dependencies.includes(k) && mod.status === 'active' && !toDeactivate.includes(mKey)) {
          toDeactivate.push(mKey);
          collectDependents(mKey);
        }
      }
    }

    collectDependents(key);
    // Deactivate dependents in reverse order (leaf → root), then the target
    toDeactivate.reverse();
    for (const k of toDeactivate) {
      const mod = modules.get(k);
      if (mod && mod.status === 'active' && !mod.is_core) {
        await deactivate(k);
      }
    }
    await deactivate(key);
  }

  return {
    register,
    activate,
    deactivate,
    get,
    list,
    listActive,
    isEnabledForTenant,
    enableForTenant,
    disableForTenant,
    listForTenant,
    dependencyGraph,
    activationOrder,
    activateWithDeps,
    deactivateWithDeps,
  };
}
