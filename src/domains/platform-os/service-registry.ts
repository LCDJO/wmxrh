/**
 * ServiceRegistry — Inversion-of-Control container for platform services.
 *
 * Allows any domain service to register itself and be resolved by name.
 * Provides dependency tracking and lifecycle (dispose).
 */

import type { ServiceRegistryAPI, ServiceDescriptor, ServiceStatus } from './types';

export function createServiceRegistry(): ServiceRegistryAPI {
  const services = new Map<string, ServiceDescriptor>();

  function register<T>(name: string, instance: T, opts?: { version?: string; dependencies?: string[] }): void {
    if (services.has(name)) {
      console.warn(`[ServiceRegistry] overwriting service "${name}"`);
    }

    // Validate dependencies exist
    const deps = opts?.dependencies ?? [];
    const missing = deps.filter(d => !services.has(d));
    if (missing.length > 0) {
      console.warn(`[ServiceRegistry] "${name}" has unresolved deps: ${missing.join(', ')}`);
    }

    services.set(name, {
      name,
      version: opts?.version ?? '1.0.0',
      instance: instance as unknown,
      status: 'ready' as ServiceStatus,
      dependencies: deps,
      registered_at: Date.now(),
    });
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
    return [...services.values()];
  }

  function dispose(name: string): void {
    const desc = services.get(name);
    if (desc) {
      desc.status = 'disposed';
      desc.instance = null;
    }
  }

  return { register, resolve, has, list, dispose };
}
