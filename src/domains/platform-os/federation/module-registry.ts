/**
 * ModuleRegistry — Central catalog of registered modules.
 *
 * Single responsibility: store module descriptors and expose
 * query / mutation primitives. No lifecycle logic.
 */

import type {
  ModuleDescriptor,
  ModuleRegistration,
  ModuleStatus,
  GlobalEventKernelAPI,
} from '../types';
import { PLATFORM_EVENTS } from '../platform-events';
import type { ModuleRegisteredPayload } from '../platform-events';

// ── Internal extension with hooks ──────────────────────────────

export interface InternalModule extends ModuleDescriptor {
  _onActivate?: () => void | Promise<void>;
  _onDeactivate?: () => void | Promise<void>;
  _onError?: (error: Error) => void;
}

export interface ModuleRegistryAPI {
  register(mod: ModuleRegistration): void;
  unregister(key: string): boolean;
  get(key: string): ModuleDescriptor | null;
  getInternal(key: string): InternalModule | null;
  list(): ModuleDescriptor[];
  has(key: string): boolean;
  keys(): string[];
  /** Raw internal map — used by sibling federation services */
  _raw(): Map<string, InternalModule>;
}

export function createModuleRegistry(events: GlobalEventKernelAPI): ModuleRegistryAPI {
  const modules = new Map<string, InternalModule>();

  function toDescriptor(mod: InternalModule): ModuleDescriptor {
    const { _onActivate, _onDeactivate, _onError, ...descriptor } = mod;
    return descriptor;
  }

  function register(mod: ModuleRegistration): void {
    if (modules.has(mod.key)) {
      console.warn(`[ModuleRegistry] "${mod.key}" already registered, updating`);
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
      lazy: mod.lazy ?? false,
      enabled_tenants: mod.enabled_tenants ?? [],
      disabled_tenants: [],
      _onActivate: mod.onActivate,
      _onDeactivate: mod.onDeactivate,
      _onError: mod.onError,
    });

    events.emit('module:registered', 'ModuleRegistry', {
      key: mod.key,
      label: mod.label,
      is_core: mod.is_core ?? false,
    });

    events.emit<ModuleRegisteredPayload>(
      PLATFORM_EVENTS.ModuleRegistered,
      'ModuleRegistry',
      { key: mod.key, label: mod.label, enabled: false },
    );
  }

  function unregister(key: string): boolean {
    const existed = modules.delete(key);
    if (existed) {
      events.emit('module:unregistered', 'ModuleRegistry', { key });
    }
    return existed;
  }

  function get(key: string): ModuleDescriptor | null {
    const mod = modules.get(key);
    return mod ? toDescriptor(mod) : null;
  }

  function getInternal(key: string): InternalModule | null {
    return modules.get(key) ?? null;
  }

  function list(): ModuleDescriptor[] {
    return [...modules.values()].map(toDescriptor);
  }

  function has(key: string): boolean {
    return modules.has(key);
  }

  function keys(): string[] {
    return [...modules.keys()];
  }

  function _raw(): Map<string, InternalModule> {
    return modules;
  }

  return { register, unregister, get, getInternal, list, has, keys, _raw };
}
