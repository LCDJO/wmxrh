/**
 * Platform Module Federation — Barrel export.
 */

export { createModuleRegistry, type ModuleRegistryAPI, type InternalModule } from './module-registry';
export { createModuleLoader, type ModuleLoaderAPI, type ModuleManifest } from './module-loader';
export { createModuleSandbox, type ModuleSandboxAPI, type SandboxContext, type SandboxStateAPI } from './module-sandbox';
export { createModuleLifecycleManager, type ModuleLifecycleManagerAPI } from './module-lifecycle-manager';
export { createModulePermissionAdapter, type ModulePermissionAdapterAPI, type PermissionContext } from './module-permission-adapter';
export { createPlatformCore, type PlatformCoreAPI } from './platform-core';
