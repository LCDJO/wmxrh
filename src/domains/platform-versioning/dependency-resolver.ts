/**
 * DependencyResolver — Validates and resolves inter-module dependency trees.
 */
import type { ModuleVersion, ModuleDependency, DependencySnapshot, DependencyConflict, SemanticVersion } from './types';
import { compareVersions, satisfiesRange, formatVersion } from './version-utils';
import type { ModuleVersionRegistry } from './module-version-registry';

export class DependencyResolver {
  constructor(private moduleRegistry: ModuleVersionRegistry) {}

  /** Build a full dependency snapshot of current module versions */
  snapshot(): DependencySnapshot {
    const modules = this.moduleRegistry.listAllCurrent().map(mv => ({
      module_key: mv.module_id,
      version: mv.version,
      dependencies: mv.dependencies,
    }));

    const conflicts = this.detectConflicts(modules);

    return {
      timestamp: new Date().toISOString(),
      modules,
      conflicts,
    };
  }

  /** Detect conflicts in a set of module versions */
  detectConflicts(
    modules: Array<{ module_key: string; version: SemanticVersion; dependencies: ModuleDependency[] }>,
  ): DependencyConflict[] {
    const versionMap = new Map(modules.map(m => [m.module_key, m.version]));
    const conflicts: DependencyConflict[] = [];

    for (const mod of modules) {
      for (const dep of mod.dependencies) {
        const actual = versionMap.get(dep.required_module_id);
        if (!actual) {
          conflicts.push({
            module_key: dep.required_module_id,
            required_by: mod.module_key,
            required_version: dep.required_version,
            actual_version: { major: 0, minor: 0, patch: 0 },
            severity: 'error',
          });
          continue;
        }
        if (compareVersions(actual, dep.required_version) < 0) {
          conflicts.push({
            module_key: dep.required_module_id,
            required_by: mod.module_key,
            required_version: dep.required_version,
            actual_version: actual,
            severity: 'error',
          });
        }
      }
    }
    return conflicts;
  }

  /** Get topological activation order for a module (respecting dependencies) */
  activationOrder(moduleKey: string, visited = new Set<string>()): string[] {
    if (visited.has(moduleKey)) return [];
    visited.add(moduleKey);

    const current = this.moduleRegistry.getCurrent(moduleKey);
    if (!current) return [moduleKey];

    const order: string[] = [];
    for (const dep of current.dependencies) {
      order.push(...this.activationOrder(dep.required_module_id, visited));
    }
    order.push(moduleKey);
    return order;
  }

  /** Check if upgrading a module would break dependents */
  wouldBreak(moduleKey: string, toVersion: SemanticVersion): string[] {
    const broken: string[] = [];
    const allCurrent = this.moduleRegistry.listAllCurrent();

    for (const mod of allCurrent) {
      for (const dep of mod.dependencies) {
        if (dep.required_module_id === moduleKey) {
          // If the new version is lower than what's required, it breaks
          if (compareVersions(toVersion, dep.required_version) < 0) {
            broken.push(mod.module_id);
          }
        }
      }
    }
    return broken;
  }

  /** Full dependency graph as adjacency list */
  graph(): Record<string, string[]> {
    const g: Record<string, string[]> = {};
    for (const key of this.moduleRegistry.listModuleKeys()) {
      const cur = this.moduleRegistry.getCurrent(key);
      g[key] = cur?.dependencies.map(d => d.required_module_id) ?? [];
    }
    return g;
  }
}
