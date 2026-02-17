/**
 * ModuleSandbox — Isolated execution context per module.
 *
 * SECURITY CONTRACT:
 *   ✅ Modules access data ONLY through DomainGateway
 *   ✅ Modules emit events ONLY under their own namespace
 *   ❌ Modules CANNOT access SecurityKernel directly
 *   ❌ Modules CANNOT access the database directly
 *
 * Provides:
 *   - DomainGateway proxy (safe data access layer)
 *   - Scoped event namespace
 *   - Scoped state container
 *   - Error boundary integration
 *   - Resource tracking (cleanup on deactivation)
 */

import type { GlobalEventKernelAPI } from '../types';

// ── DomainGateway — Safe data access proxy ─────────────────────

/**
 * DomainGateway is the ONLY way a module can access data.
 * It proxies requests through the platform, enforcing:
 *   - Tenant isolation (auto-injects tenant_id)
 *   - Permission checks (validates caller has required access)
 *   - Audit logging (all mutations are recorded)
 */
export interface DomainGateway {
  /**
   * Query data from a domain.
   * @param domain - Target domain (e.g. 'employees', 'compensation', 'benefits')
   * @param operation - Operation name (e.g. 'list', 'getById', 'search')
   * @param params - Operation-specific parameters
   */
  query<T = unknown>(domain: string, operation: string, params?: Record<string, unknown>): Promise<T>;

  /**
   * Mutate data through a domain.
   * @param domain - Target domain
   * @param operation - Mutation name (e.g. 'create', 'update', 'delete')
   * @param payload - Mutation payload
   */
  mutate<T = unknown>(domain: string, operation: string, payload?: Record<string, unknown>): Promise<T>;

  /**
   * Subscribe to domain data changes.
   * Returns an unsubscribe function.
   */
  subscribe(domain: string, event: string, handler: (data: unknown) => void): () => void;
}

/** Factory that creates a tenant-scoped DomainGateway for a module */
export type DomainGatewayFactory = (moduleKey: string) => DomainGateway;

// ── Sandbox Types ──────────────────────────────────────────────

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
  /**
   * DomainGateway — the ONLY approved data access channel.
   * Modules MUST use this instead of direct DB or SecurityKernel access.
   */
  gateway: DomainGateway;
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
  /** Set the gateway factory (called during platform boot) */
  setGatewayFactory(factory: DomainGatewayFactory): void;
}

// ── Blocked access guards ──────────────────────────────────────

const BLOCKED_DOMAINS = ['_security_kernel', '_auth_internal', '_raw_db', '_supabase'];

function assertNotBlocked(domain: string, moduleKey: string): void {
  if (BLOCKED_DOMAINS.some(b => domain.startsWith(b))) {
    throw new Error(
      `[ModuleSandbox] Module "${moduleKey}" attempted to access blocked domain "${domain}". ` +
      `Modules must use DomainGateway operations, not direct kernel/DB access.`,
    );
  }
}

// ── Default gateway (no-op until platform wires the real one) ──

function createDefaultGateway(moduleKey: string, events: GlobalEventKernelAPI): DomainGateway {
  return {
    async query(domain, operation, params) {
      assertNotBlocked(domain, moduleKey);
      events.emit(`gateway:query`, `Sandbox[${moduleKey}]`, { domain, operation, params });
      console.warn(`[DomainGateway] No gateway factory configured. query(${domain}.${operation}) from "${moduleKey}" will return empty.`);
      return undefined as any;
    },
    async mutate(domain, operation, payload) {
      assertNotBlocked(domain, moduleKey);
      events.emit(`gateway:mutate`, `Sandbox[${moduleKey}]`, { domain, operation, payload });
      console.warn(`[DomainGateway] No gateway factory configured. mutate(${domain}.${operation}) from "${moduleKey}" will no-op.`);
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
    // Re-wire existing sandboxes with the real gateway
    for (const [key, sandbox] of sandboxes) {
      (sandbox.context as any).gateway = factory(key);
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

    const gateway = gatewayFactory
      ? gatewayFactory(moduleKey)
      : createDefaultGateway(moduleKey, events);

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
      addCleanup(fn: () => void) {
        cleanups.push(fn);
      },
      gateway,
    };

    sandboxes.set(moduleKey, { context, cleanups, state: stateStore, unsubscribers });
    events.emit('module:sandbox_created', 'ModuleSandbox', { key: moduleKey });
    return context;
  }

  function destroy(moduleKey: string): void {
    const sandbox = sandboxes.get(moduleKey);
    if (!sandbox) return;

    for (const fn of sandbox.cleanups) {
      try { fn(); } catch (e) {
        console.error(`[ModuleSandbox] cleanup error in "${moduleKey}":`, e);
      }
    }
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

  return { create, destroy, has, get, setGatewayFactory };
}
