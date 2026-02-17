/**
 * ModuleSandbox — Isolated execution context per module.
 *
 * Provides:
 *   - Scoped event namespace (modules can only emit under their own prefix)
 *   - Scoped state container (isolated per module)
 *   - Error boundary integration metadata
 *   - Resource tracking (cleanup on deactivation)
 */

import type { GlobalEventKernelAPI } from '../types';

// ── Types ──────────────────────────────────────────────────────

export interface SandboxContext {
  /** Module key owning this sandbox */
  moduleKey: string;
  /** Emit an event scoped to this module */
  emit(event: string, payload?: unknown): void;
  /** Subscribe to events (any namespace) */
  on(event: string, handler: (...args: any[]) => void): () => void;
  /** Scoped key-value store */
  state: SandboxStateAPI;
  /** Register a cleanup function to run on deactivation */
  addCleanup(fn: () => void): void;
}

export interface SandboxStateAPI {
  get<T = unknown>(key: string): T | undefined;
  set<T = unknown>(key: string, value: T): void;
  delete(key: string): boolean;
  clear(): void;
  keys(): string[];
}

export interface ModuleSandboxAPI {
  /** Create or retrieve an isolated sandbox for a module */
  create(moduleKey: string): SandboxContext;
  /** Destroy a sandbox and run all cleanup functions */
  destroy(moduleKey: string): void;
  /** Check if a sandbox exists */
  has(moduleKey: string): boolean;
  /** Get sandbox for inspection */
  get(moduleKey: string): SandboxContext | null;
}

// ── Implementation ─────────────────────────────────────────────

export function createModuleSandbox(events: GlobalEventKernelAPI): ModuleSandboxAPI {
  const sandboxes = new Map<string, {
    context: SandboxContext;
    cleanups: Array<() => void>;
    state: Map<string, unknown>;
    unsubscribers: Array<() => void>;
  }>();

  function create(moduleKey: string): SandboxContext {
    if (sandboxes.has(moduleKey)) return sandboxes.get(moduleKey)!.context;

    const stateStore = new Map<string, unknown>();
    const cleanups: Array<() => void> = [];
    const unsubscribers: Array<() => void> = [];

    const state: SandboxStateAPI = {
      get: <T>(key: string) => stateStore.get(key) as T | undefined,
      set: <T>(key: string, value: T) => { stateStore.set(key, value); },
      delete: (key: string) => stateStore.delete(key),
      clear: () => stateStore.clear(),
      keys: () => [...stateStore.keys()],
    };

    const context: SandboxContext = {
      moduleKey,
      emit(event: string, payload?: unknown) {
        // Scope events under module namespace
        events.emit(`module:${moduleKey}:${event}`, `Sandbox[${moduleKey}]`, payload);
      },
      on(event: string, handler: (...args: any[]) => void) {
        const unsub = events.on(event, handler);
        unsubscribers.push(unsub);
        return unsub;
      },
      state,
      addCleanup(fn: () => void) {
        cleanups.push(fn);
      },
    };

    sandboxes.set(moduleKey, { context, cleanups, state: stateStore, unsubscribers });
    events.emit('module:sandbox_created', 'ModuleSandbox', { key: moduleKey });
    return context;
  }

  function destroy(moduleKey: string): void {
    const sandbox = sandboxes.get(moduleKey);
    if (!sandbox) return;

    // Run registered cleanups
    for (const fn of sandbox.cleanups) {
      try { fn(); } catch (e) {
        console.error(`[ModuleSandbox] cleanup error in "${moduleKey}":`, e);
      }
    }

    // Unsubscribe all event listeners
    for (const unsub of sandbox.unsubscribers) {
      try { unsub(); } catch { /* ignore */ }
    }

    sandbox.state.clear();
    sandboxes.delete(moduleKey);
    events.emit('module:sandbox_destroyed', 'ModuleSandbox', { key: moduleKey });
  }

  function has(moduleKey: string): boolean {
    return sandboxes.has(moduleKey);
  }

  function get(moduleKey: string): SandboxContext | null {
    return sandboxes.get(moduleKey)?.context ?? null;
  }

  return { create, destroy, has, get };
}
