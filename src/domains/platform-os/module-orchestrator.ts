/**
 * ModuleOrchestrator — Legacy-compatible facade.
 *
 * Now delegates entirely to the PlatformCore federation layer.
 * Kept for backward compatibility with existing consumers.
 *
 * @see src/domains/platform-os/federation/platform-core.ts
 */

import type {
  ModuleOrchestratorAPI,
  ModuleRegistration,
  ModuleDescriptor,
  GlobalEventKernelAPI,
} from './types';
import { createPlatformCore, type PlatformCoreAPI } from './federation/platform-core';

export function createModuleOrchestrator(events: GlobalEventKernelAPI): ModuleOrchestratorAPI & { core: PlatformCoreAPI } {
  const core = createPlatformCore(events);

  return {
    register: (mod: ModuleRegistration) => core.register(mod),
    activate: (key: string) => core.activate(key),
    deactivate: (key: string) => core.deactivate(key),
    get: (key: string) => core.get(key),
    list: () => core.list(),
    listActive: () => core.listActive(),
    activateIfNeeded: (key: string) => core.activateIfNeeded(key),
    isEnabledForTenant: (key: string, tenantId: string) => core.isEnabledForTenant(key, tenantId),
    enableForTenant: (key: string, tenantId: string) => core.enableForTenant(key, tenantId),
    disableForTenant: (key: string, tenantId: string) => core.disableForTenant(key, tenantId),
    listForTenant: (tenantId: string) => core.listForTenant(tenantId),
    dependencyGraph: () => core.dependencyGraph(),
    activationOrder: (key: string) => core.activationOrder(key),
    activateWithDeps: (key: string) => core.activateWithDeps(key),
    deactivateWithDeps: (key: string) => core.deactivateWithDeps(key),
    /** Access the full PlatformCore for advanced federation features */
    core,
  };
}
