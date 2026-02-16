/**
 * ModuleOrchestrator — Module registration, activation, and lifecycle.
 *
 * Each domain module registers itself with routes, permissions, and
 * dependencies. The orchestrator manages activation order and tracks status.
 */

import type {
  ModuleOrchestratorAPI,
  ModuleDescriptor,
  ModuleRegistration,
  ModuleStatus,
  GlobalEventKernelAPI,
} from './types';

export function createModuleOrchestrator(events: GlobalEventKernelAPI): ModuleOrchestratorAPI {
  const modules = new Map<string, ModuleDescriptor & { _onActivate?: () => void | Promise<void>; _onDeactivate?: () => void | Promise<void> }>();

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
      _onActivate: mod.onActivate,
      _onDeactivate: mod.onDeactivate,
    });

    events.emit('module:registered', 'ModuleOrchestrator', { key: mod.key, label: mod.label });
  }

  async function activate(key: string): Promise<void> {
    const mod = modules.get(key);
    if (!mod) throw new Error(`Module "${key}" not registered`);
    if (mod.status === 'active') return;

    // Check dependencies
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
      events.emit('module:activated', 'ModuleOrchestrator', { key });
    } catch (err) {
      mod.status = 'error';
      mod.error = err instanceof Error ? err.message : String(err);
      events.emit('module:error', 'ModuleOrchestrator', { key, error: mod.error });
      throw err;
    }
  }

  async function deactivate(key: string): Promise<void> {
    const mod = modules.get(key);
    if (!mod || mod.status !== 'active') return;

    // Check if other active modules depend on this one
    const dependents = [...modules.values()].filter(m => m.status === 'active' && m.dependencies.includes(key));
    if (dependents.length > 0) {
      throw new Error(`Cannot deactivate "${key}": modules [${dependents.map(d => d.key).join(', ')}] depend on it`);
    }

    try {
      if (mod._onDeactivate) await mod._onDeactivate();
      mod.status = 'suspended';
      events.emit('module:deactivated', 'ModuleOrchestrator', { key });
    } catch (err) {
      mod.status = 'error';
      mod.error = err instanceof Error ? err.message : String(err);
    }
  }

  function get(key: string): ModuleDescriptor | null {
    const mod = modules.get(key);
    if (!mod) return null;
    const { _onActivate, _onDeactivate, ...descriptor } = mod;
    return descriptor;
  }

  function list(): ModuleDescriptor[] {
    return [...modules.values()].map(({ _onActivate, _onDeactivate, ...d }) => d);
  }

  function listActive(): ModuleDescriptor[] {
    return list().filter(m => m.status === 'active');
  }

  return { register, activate, deactivate, get, list, listActive };
}
