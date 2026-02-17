/**
 * ModuleSandbox — Isolated execution context per module.
 *
 * SECURITY CONTRACT:
 *   ✅ Modules access data ONLY through DomainGateway
 *   ✅ Modules emit events ONLY under their own namespace
 *   ❌ Modules CANNOT access SecurityKernel directly
 *   ❌ Modules CANNOT access the database directly
 *   ❌ Modules CANNOT import from blocked paths
 *
 * Isolation enforced via:
 *   1. BLOCKED_DOMAINS — gateway-level domain deny-list
 *   2. BLOCKED_IMPORT_PATTERNS — static import path validation
 *   3. Proxy-wrapped gateway — runtime property access guard
 */

import type { GlobalEventKernelAPI } from '../types';

// ── DomainGateway — Safe data access proxy ─────────────────────

export interface DomainGateway {
  query<T = unknown>(domain: string, operation: string, params?: Record<string, unknown>): Promise<T>;
  mutate<T = unknown>(domain: string, operation: string, payload?: Record<string, unknown>): Promise<T>;
  subscribe(domain: string, event: string, handler: (data: unknown) => void): () => void;
}

export type DomainGatewayFactory = (moduleKey: string) => DomainGateway;

// ── Sandbox Types ──────────────────────────────────────────────

export interface SandboxContext {
  readonly moduleKey: string;
  emit(event: string, payload?: unknown): void;
  on(event: string, handler: (...args: any[]) => void): () => void;
  state: SandboxStateAPI;
  addCleanup(fn: () => void): void;
  readonly gateway: DomainGateway;
  /** Validate an import path — throws if blocked */
  assertImportAllowed(importPath: string): void;
}

export interface SandboxStateAPI {
  get<T = unknown>(key: string): T | undefined;
  set<T = unknown>(key: string, value: T): void;
  delete(key: string): boolean;
  clear(): void;
  keys(): string[];
}

export interface ModuleSandboxAPI {
  create(moduleKey: string): SandboxContext;
  destroy(moduleKey: string): void;
  has(moduleKey: string): boolean;
  get(moduleKey: string): SandboxContext | null;
  setGatewayFactory(factory: DomainGatewayFactory): void;
}

// ── Security Guards ────────────────────────────────────────────

const BLOCKED_DOMAINS = [
  '_security_kernel',
  '_auth_internal',
  '_raw_db',
  '_supabase',
  '_platform_internals',
  'auth.users',
] as const;

/**
 * Import paths that modules are NOT allowed to reference.
 * Enforced at build-time via `assertImportAllowed` and
 * at review-time via lint rules.
 */
const BLOCKED_IMPORT_PATTERNS = [
  /supabase\/client/i,
  /integrations\/supabase/i,
  /@supabase\//i,
  /security-kernel/i,
  /SecurityKernel/i,
  /platform-os\/(?!federation|ui)/i,  // only federation + ui are public
  /\.env/i,
] as const;

function assertNotBlocked(domain: string, moduleKey: string): void {
  const lower = domain.toLowerCase();
  if (BLOCKED_DOMAINS.some(b => lower.startsWith(b))) {
    throw new Error(
      `[ModuleSandbox] Module "${moduleKey}" attempted to access blocked domain "${domain}". ` +
      `Modules must use DomainGateway operations, not direct kernel/DB access.`,
    );
  }
}

function assertImportAllowed(importPath: string, moduleKey: string): void {
  for (const pattern of BLOCKED_IMPORT_PATTERNS) {
    if (pattern.test(importPath)) {
      throw new Error(
        `[ModuleSandbox] Module "${moduleKey}" attempted to import blocked path "${importPath}". ` +
        `Use the DomainGateway instead.`,
      );
    }
  }
}

// ── Proxy-wrapped gateway ──────────────────────────────────────

/**
 * Wraps a DomainGateway in a Proxy that:
 *   - Blocks access to forbidden properties (e.g. _raw, _client)
 *   - Intercepts query/mutate to validate domain names
 *   - Prevents prototype pollution
 */
function createGuardedGateway(inner: DomainGateway, moduleKey: string, events: GlobalEventKernelAPI): DomainGateway {
  const FORBIDDEN_PROPS = new Set([
    '_raw', '_client', '_db', '_supabase', 'client',
    'constructor', '__proto__', 'prototype',
  ]);

  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && FORBIDDEN_PROPS.has(prop)) {
        events.emit('sandbox:access_violation', `Sandbox[${moduleKey}]`, {
          module: moduleKey,
          property: prop,
          type: 'forbidden_property',
        });
        throw new Error(
          `[ModuleSandbox] Module "${moduleKey}" attempted to access forbidden gateway property "${prop}".`,
        );
      }

      const value = Reflect.get(target, prop, receiver);

      // Wrap query/mutate to inject domain validation
      if (prop === 'query' || prop === 'mutate') {
        return (domain: string, operation: string, data?: Record<string, unknown>) => {
          assertNotBlocked(domain, moduleKey);
          return (value as Function).call(target, domain, operation, data);
        };
      }

      if (prop === 'subscribe') {
        return (domain: string, event: string, handler: (d: unknown) => void) => {
          assertNotBlocked(domain, moduleKey);
          return (value as Function).call(target, domain, event, handler);
        };
      }

      return value;
    },

    set(_target, prop) {
      events.emit('sandbox:access_violation', `Sandbox[${moduleKey}]`, {
        module: moduleKey,
        property: String(prop),
        type: 'write_attempt',
      });
      throw new Error(
        `[ModuleSandbox] Module "${moduleKey}" attempted to write to gateway property "${String(prop)}". Gateway is read-only.`,
      );
    },
  });
}

// ── Default gateway (no-op until platform wires the real one) ──

function createDefaultGateway(moduleKey: string, events: GlobalEventKernelAPI): DomainGateway {
  return {
    async query(domain, operation, params) {
      assertNotBlocked(domain, moduleKey);
      events.emit('gateway:query', `Sandbox[${moduleKey}]`, { domain, operation, params });
      console.warn(`[DomainGateway] No factory configured. query(${domain}.${operation}) from "${moduleKey}" → empty.`);
      return undefined as any;
    },
    async mutate(domain, operation, payload) {
      assertNotBlocked(domain, moduleKey);
      events.emit('gateway:mutate', `Sandbox[${moduleKey}]`, { domain, operation, payload });
      console.warn(`[DomainGateway] No factory configured. mutate(${domain}.${operation}) from "${moduleKey}" → no-op.`);
      return undefined as any;
    },
    subscribe(domain, event, handler) {
      assertNotBlocked(domain, moduleKey);
      return events.on(`domain:${domain}:${event}`, handler);
    },
  };
}

// ── Implementation ─────────────────────────────────────────────

export function createModuleSandbox(events: GlobalEventKernelAPI): ModuleSandboxAPI {
  const sandboxes = new Map<string, {
    context: SandboxContext;
    cleanups: Array<() => void>;
    state: Map<string, unknown>;
    unsubscribers: Array<() => void>;
  }>();

  let gatewayFactory: DomainGatewayFactory | null = null;

  function setGatewayFactory(factory: DomainGatewayFactory): void {
    gatewayFactory = factory;
    for (const [key, sandbox] of sandboxes) {
      (sandbox.context as any).gateway = createGuardedGateway(factory(key), key, events);
    }
    events.emit('module:gateway_factory_set', 'ModuleSandbox', { count: sandboxes.size });
  }

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

    const rawGateway = gatewayFactory
      ? gatewayFactory(moduleKey)
      : createDefaultGateway(moduleKey, events);

    const gateway = createGuardedGateway(rawGateway, moduleKey, events);

    const context: SandboxContext = {
      moduleKey,
      emit(event: string, payload?: unknown) {
        events.emit(`module:${moduleKey}:${event}`, `Sandbox[${moduleKey}]`, payload);
      },
      on(event: string, handler: (...args: any[]) => void) {
        const unsub = events.on(event, handler);
        unsubscribers.push(unsub);
        return unsub;
      },
      state,
      addCleanup(fn: () => void) { cleanups.push(fn); },
      gateway,
      assertImportAllowed(importPath: string) {
        assertImportAllowed(importPath, moduleKey);
      },
    };

    sandboxes.set(moduleKey, { context, cleanups, state: stateStore, unsubscribers });
    events.emit('module:sandbox_created', 'ModuleSandbox', { key: moduleKey });
    return context;
  }

  function destroy(moduleKey: string): void {
    const sandbox = sandboxes.get(moduleKey);
    if (!sandbox) return;
    for (const fn of sandbox.cleanups) {
      try { fn(); } catch (e) { console.error(`[ModuleSandbox] cleanup error in "${moduleKey}":`, e); }
    }
    for (const unsub of sandbox.unsubscribers) {
      try { unsub(); } catch { /* ignore */ }
    }
    sandbox.state.clear();
    sandboxes.delete(moduleKey);
    events.emit('module:sandbox_destroyed', 'ModuleSandbox', { key: moduleKey });
  }

  return {
    create,
    destroy,
    has: (k) => sandboxes.has(k),
    get: (k) => sandboxes.get(k)?.context ?? null,
    setGatewayFactory,
  };
}
