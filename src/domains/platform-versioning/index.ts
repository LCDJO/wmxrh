/**
 * AdvancedVersioningEngine — Enterprise Release Governance
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  AdvancedVersioningEngine                                       ║
 * ║   ├── PlatformVersionRegistry   (platform semver history)       ║
 * ║   ├── ModuleVersionRegistry     (per-module version tracking)   ║
 * ║   ├── ChangeLogger              (immutable audit changelog)     ║
 * ║   ├── ReleaseManager            (grouped release lifecycle)     ║
 * ║   ├── DependencyResolver        (inter-module dep validation)   ║
 * ║   ├── FeatureChangeTracker      (feature-level mutations)       ║
 * ║   ├── RollbackOrchestrator      (planned release rollbacks)     ║
 * ║   └── ChangelogRenderer         (human-readable changelogs)     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { PlatformVersionRegistry } from './platform-version-registry';
import { ModuleVersionRegistry } from './module-version-registry';
import { ChangeLogger } from './change-logger';
import { ReleaseManager } from './release-manager';
import { DependencyResolver } from './dependency-resolver';
import { FeatureChangeTracker } from './feature-change-tracker';
import { RollbackOrchestrator } from './rollback-orchestrator';
import { ChangelogRenderer } from './changelog-renderer';
import { AutoChangeTracker } from './auto-change-tracker';

export interface AdvancedVersioningEngineAPI {
  platform: PlatformVersionRegistry;
  modules: ModuleVersionRegistry;
  changelog: ChangeLogger;
  releases: ReleaseManager;
  dependencies: DependencyResolver;
  features: FeatureChangeTracker;
  rollback: RollbackOrchestrator;
  renderer: ChangelogRenderer;
  tracker: AutoChangeTracker;
}

export function createAdvancedVersioningEngine(): AdvancedVersioningEngineAPI {
  const platform = new PlatformVersionRegistry();
  const modules = new ModuleVersionRegistry();
  const changelog = new ChangeLogger();
  const releases = new ReleaseManager();
  const dependencies = new DependencyResolver(modules);
  const features = new FeatureChangeTracker();
  const rollback = new RollbackOrchestrator(releases, modules, dependencies);
  const renderer = new ChangelogRenderer(changelog, releases);
  const tracker = new AutoChangeTracker(changelog);

  return { platform, modules, changelog, releases, dependencies, features, rollback, renderer, tracker };
}

// Singleton
let _engine: AdvancedVersioningEngineAPI | null = null;

export function getAdvancedVersioningEngine(): AdvancedVersioningEngineAPI {
  if (!_engine) _engine = createAdvancedVersioningEngine();
  return _engine;
}

export function resetAdvancedVersioningEngine(): void {
  _engine = null;
}

// Re-exports
export * from './types';
export { PlatformVersionRegistry } from './platform-version-registry';
export { ModuleVersionRegistry } from './module-version-registry';
export { ChangeLogger } from './change-logger';
export { ReleaseManager } from './release-manager';
export { DependencyResolver } from './dependency-resolver';
export { FeatureChangeTracker } from './feature-change-tracker';
export { RollbackOrchestrator } from './rollback-orchestrator';
export { ChangelogRenderer } from './changelog-renderer';
export { AutoChangeTracker } from './auto-change-tracker';
export { formatVersion, parseVersion, compareVersions, bumpVersion, satisfiesRange } from './version-utils';
export { MODULE_CATALOG } from './module-catalog';
export { seedAllModuleVersions } from './module-version-seeder';
export { useModuleVersioning } from './use-module-versioning';
export { SupportModuleVersionRegistry } from './support-module-version';
export type { SupportModuleVersion } from './support-module-version';
