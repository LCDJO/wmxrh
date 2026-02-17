/**
 * DependencyResolver — Validates and resolves inter-module dependency trees.
 */
import type { ModuleVersion, ModuleDependency, DependencySnapshot, DependencyConflict } from './types';
import { compareVersions, satisfiesRange, formatVersion } from './version-utils';
import type { ModuleVersionRegistry } from './module-version-registry';

export class DependencyResolver {
  constructor(private moduleRegistry: ModuleVersionRegistry) {}

  /** Build a full dependency snapshot of current module versions */
  snapshot(): DependencySnapshot {
    const modules = this.moduleRegistry.listAllCurrent().map(mv => ({
      module_key: mv.module_key,
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
    modules: Array<{ module_key: string; version: import('./types').SemanticVersion; dependencies: ModuleDependency[] }>,
  ): DependencyConflict[] {
    const versionMap = new Map(modules.map(m => [m.module_key, m.version]));
    const conflicts: DependencyConflict[] = [];

    for (const mod of modules) {
      for (const dep of mod.dependencies) {
        if (dep.optional) continue;
        const actual = versionMap.get(dep.module_key);
        if (!actual) {
          conflicts.push({
            module_key: dep.module_key,
            required_by: mod.module_key,
            required_version: dep.min_version,
            actual_version: { major: 0, minor: 0, patch: 0 },
            severity: 'error',
          });
          continue;
        }
        if (!satisfiesRange(actual, dep.min_version, dep.max_version)) {
          conflicts.push({
            module_key: dep.module_key,
            required_by: mod.module_key,
            required_version: dep.min_version,
            actual_version: actual,
            severity: compareVersions(actual, dep.min_version) < 0 ? 'error' : 'warning',
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
      if (!dep.optional) {
        order.push(...this.activationOrder(dep.module_key, visited));
      }
    }
    order.push(moduleKey);
    return order;
  }

  /** Check if upgrading a module would break dependents */
  wouldBreak(moduleKey: string, toVersion: import('./types').SemanticVersion): string[] {
    const broken: string[] = [];
    const allCurrent = this.moduleRegistry.listAllCurrent();

    for (const mod of allCurrent) {
      for (const dep of mod.dependencies) {
        if (dep.module_key === moduleKey && dep.max_version) {
          if (compareVersions(toVersion, dep.max_version) > 0) {
            broken.push(mod.module_key);
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
      g[key] = cur?.dependencies.filter(d => !d.optional).map(d => d.module_key) ?? [];
    }
    return g;
  }
}
