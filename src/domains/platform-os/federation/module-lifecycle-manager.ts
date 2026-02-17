/**
 * ModuleLifecycleManager — State machine for module activation & deactivation.
 *
 * Handles: activate, deactivate, dependency resolution, cascading ops.
 * Delegates storage to ModuleRegistry.
 */

import type { ModuleDescriptor, GlobalEventKernelAPI } from '../types';
import { PLATFORM_EVENTS } from '../platform-events';
import type { ModuleEnabledPayload, ModuleDisabledPayload } from '../platform-events';
import type { ModuleRegistryAPI, InternalModule } from './module-registry';

export interface ModuleLifecycleManagerAPI {
  activate(key: string): Promise<void>;
  deactivate(key: string): Promise<void>;
  activateWithDeps(key: string): Promise<void>;
  deactivateWithDeps(key: string): Promise<void>;
  activateIfNeeded(key: string): Promise<void>;
  listActive(): ModuleDescriptor[];
  dependencyGraph(): Record<string, string[]>;
  activationOrder(key: string): string[];
}

export function createModuleLifecycleManager(
  registry: ModuleRegistryAPI,
  events: GlobalEventKernelAPI,
): ModuleLifecycleManagerAPI {
  const modules = registry._raw();

  // ── Activation ─────────────────────────────────────────────

  async function activate(key: string): Promise<void> {
    const mod = modules.get(key);
    if (!mod) throw new Error(`Module "${key}" not registered`);
    if (mod.status === 'active') return;

    for (const dep of mod.dependencies) {
      const depMod = modules.get(dep as string);
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
      events.emit('module:activated', 'LifecycleManager', { key });
      events.emit<ModuleEnabledPayload>(PLATFORM_EVENTS.ModuleEnabled, 'LifecycleManager', {
        key, scope: 'global',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      mod.status = 'error';
      mod.error = error.message;
      mod._onError?.(error);
      events.emit('module:error', 'LifecycleManager', { key, error: mod.error });
      throw err;
    }
  }

  // ── Deactivation ───────────────────────────────────────────

  async function deactivate(key: string): Promise<void> {
    const mod = modules.get(key);
    if (!mod || mod.status !== 'active') return;
    if (mod.is_core) throw new Error(`Cannot deactivate core module "${key}"`);

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
      events.emit('module:deactivated', 'LifecycleManager', { key });
      events.emit<ModuleDisabledPayload>(PLATFORM_EVENTS.ModuleDisabled, 'LifecycleManager', {
        key, scope: 'global',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      mod.status = 'error';
      mod.error = error.message;
      mod._onError?.(error);
    }
  }

  // ── Dependency Graph ───────────────────────────────────────

  function dependencyGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    for (const [key, mod] of modules) {
      graph[key] = [...mod.dependencies] as string[];
    }
    return graph;
  }

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
        for (const dep of mod.dependencies) visit(dep as string);
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
      if (mod && mod.status !== 'active') await activate(k);
    }
  }

  async function deactivateWithDeps(key: string): Promise<void> {
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
    toDeactivate.reverse();
    for (const k of toDeactivate) {
      const mod = modules.get(k);
      if (mod && mod.status === 'active' && !mod.is_core) await deactivate(k);
    }
    await deactivate(key);
  }

  async function activateIfNeeded(key: string): Promise<void> {
    const mod = modules.get(key);
    if (!mod) return;
    if (mod.status === 'active' || mod.status === 'activating') return;
    if (!mod.lazy && mod.status === 'registered') return;
    await activateWithDeps(key);
    events.emit('module:lazy_activated', 'LifecycleManager', { key });
  }

  function listActive(): ModuleDescriptor[] {
    return registry.list().filter(m => m.status === 'active');
  }

  return {
    activate,
    deactivate,
    activateWithDeps,
    deactivateWithDeps,
    activateIfNeeded,
    listActive,
    dependencyGraph,
    activationOrder,
  };
}
