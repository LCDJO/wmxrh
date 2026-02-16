/**
 * ServiceRegistry — Inversion-of-Control container for platform services.
 *
 * Every domain service registers itself with:
 *   - service_id (name)
 *   - capabilities[]   — what it can do (for discovery)
 *   - required_permissions[] — who can consume it
 *   - dependencies[]   — what it depends on
 *
 * Other modules discover services via:
 *   registry.resolve<T>('ServiceName')
 *   registry.findByCapability('auth:verify')
 *   registry.dependentsOf('SecurityKernel.PermissionEngine')
 */

import type { ServiceRegistryAPI, ServiceDescriptor, ServiceRegistrationOpts } from './types';

export function createServiceRegistry(): ServiceRegistryAPI {
  const services = new Map<string, ServiceDescriptor>();

  // ── Capability index (capability → service names) ────────
  const capabilityIndex = new Map<string, Set<string>>();

  // ── Cached snapshots ─────────────────────────────────────
  let listCache: ServiceDescriptor[] | null = null;
  let graphCache: Record<string, string[]> | null = null;

  function invalidateCaches(): void {
    listCache = null;
    graphCache = null;
  }

  function register<T>(name: string, instance: T, opts?: ServiceRegistrationOpts): void {
    if (services.has(name)) {
      const old = services.get(name)!;
      for (const cap of old.capabilities) {
        capabilityIndex.get(cap)?.delete(name);
      }
      console.warn(`[ServiceRegistry] overwriting service "${name}"`);
    }

    const deps = opts?.dependencies ?? [];
    const missing = deps.filter(d => !services.has(d));
    if (missing.length > 0) {
      console.warn(`[ServiceRegistry] "${name}" has unresolved deps: ${missing.join(', ')}`);
    }

    const capabilities = opts?.capabilities ?? [];
    const required_permissions = opts?.required_permissions ?? [];

    services.set(name, {
      name,
      version: opts?.version ?? '1.0.0',
      instance: instance as unknown,
      status: 'ready',
      dependencies: deps,
      capabilities,
      required_permissions,
      registered_at: Date.now(),
      metadata: opts?.metadata,
    });

    for (const cap of capabilities) {
      if (!capabilityIndex.has(cap)) {
        capabilityIndex.set(cap, new Set());
      }
      capabilityIndex.get(cap)!.add(name);
    }

    invalidateCaches();
  }

  function resolve<T>(name: string): T | null {
    const desc = services.get(name);
    if (!desc || desc.status === 'disposed' || desc.status === 'failed') return null;
    return desc.instance as T;
  }

  function has(name: string): boolean {
    return services.has(name) && services.get(name)!.status !== 'disposed';
  }

  function list(): ServiceDescriptor[] {
    if (listCache) return listCache;
    listCache = [...services.values()];
    return listCache;
  }

  function dispose(name: string): void {
    const desc = services.get(name);
    if (desc) {
      for (const cap of desc.capabilities) {
        capabilityIndex.get(cap)?.delete(name);
      }
      desc.status = 'disposed';
      desc.instance = null;
      invalidateCaches();
    }
  }

  // ── Discovery ──────────────────────────────────────────────

  function findByCapability(capability: string): ServiceDescriptor[] {
    const names = capabilityIndex.get(capability);
    if (!names) return [];
    return [...names]
      .map(n => services.get(n)!)
      .filter(s => s.status !== 'disposed' && s.status !== 'failed');
  }

  function dependentsOf(name: string): ServiceDescriptor[] {
    return list().filter(
      s => s.dependencies.includes(name) && s.status !== 'disposed',
    );
  }

  function dependencyGraph(): Record<string, string[]> {
    if (graphCache) return graphCache;
    const graph: Record<string, string[]> = {};
    for (const [svcName, desc] of services) {
      if (desc.status !== 'disposed') {
        graph[svcName] = [...desc.dependencies];
      }
    }
    graphCache = graph;
    return graph;
  }

  return { register, resolve, has, list, dispose, findByCapability, dependentsOf, dependencyGraph };
}
