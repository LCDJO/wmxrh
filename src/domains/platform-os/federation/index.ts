/**
 * Platform Module Federation — Barrel export.
 */

export { createModuleRegistry, type ModuleRegistryAPI, type InternalModule } from './module-registry';
export { createModuleLoader, type ModuleLoaderAPI, type ModuleManifest, type ModuleWidget, type ModuleNavigationEntry, type ModuleLoadContext } from './module-loader';
export { createModuleSandbox, type ModuleSandboxAPI, type SandboxContext, type SandboxStateAPI, type DomainGateway, type DomainGatewayFactory } from './module-sandbox';
export { createModuleLifecycleManager, type ModuleLifecycleManagerAPI } from './module-lifecycle-manager';
export { createModulePermissionAdapter, type ModulePermissionAdapterAPI, type PermissionContext, type PermissionDefinition } from './module-permission-adapter';
export { createModuleNavigationBridge, type ModuleNavigationBridgeAPI } from './module-navigation-bridge';
export { createPlatformCore, type PlatformCoreAPI } from './platform-core';
export {
  CORE_HR_MANIFEST, COMPENSATION_ENGINE_MANIFEST, TENANT_ADMIN_MANIFEST, REPORTING_MANIFEST,
  CORE_HR_REGISTRATION, COMPENSATION_REGISTRATION, TENANT_ADMIN_REGISTRATION, REPORTING_REGISTRATION,
  ALL_MODULE_REGISTRATIONS, ALL_MODULE_MANIFESTS, MODULE_FEDERATION_MAP,
} from './module-definitions';
