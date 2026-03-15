/**
 * DependencyResolver — Validates inter-module dependencies before publish.
 */
import type { ModuleVersion, ModuleDependency, DependencySnapshot, DependencyConflict, SemanticVersion } from './types';
import { compareVersions, formatVersion } from './version-utils';
import type { ModuleVersionRegistry } from './module-version-registry';

export interface PrePublishResult {
  ok: boolean;
  errors: PrePublishError[];
  warnings: PrePublishWarning[];
}

export interface PrePublishError {
  module_key: string;
  dependency: string;
  required_version: string;
  actual_version: string | null;
  message: string;
}

export interface PrePublishWarning {
  module_key: string;
  message: string;
}

export class DependencyResolver {
  constructor(private moduleRegistry: ModuleVersionRegistry) {}

  async validateBeforePublish(moduleKey: string, targetVersion?: SemanticVersion): Promise<PrePublishResult> {
    const current = await this.moduleRegistry.getCurrent(moduleKey);
    if (!current) {
      return { ok: false, errors: [{ module_key: moduleKey, dependency: '-', required_version: '-', actual_version: null, message: `Module "${moduleKey}" not found in registry` }], warnings: [] };
    }

    const errors: PrePublishError[] = [];
    const warnings: PrePublishWarning[] = [];

    for (const dep of current.dependencies) {
      const actual = await this.moduleRegistry.getCurrent(dep.required_module_id);
      const isMandatory = dep.is_mandatory !== false;

      if (!actual) {
        const msg = `Dependência obrigatória não encontrada: "${dep.required_module_id}"${dep.compatibility_note ? ` — ${dep.compatibility_note}` : ''}`;
        if (isMandatory) {
          errors.push({ module_key: moduleKey, dependency: dep.required_module_id, required_version: formatVersion(dep.required_version), actual_version: null, message: msg });
        } else {
          warnings.push({ module_key: moduleKey, message: msg });
        }
        continue;
      }

      if (compareVersions(actual.version, dep.required_version) < 0) {
        const msg = `Versão incompatível: "${dep.required_module_id}" atual v${formatVersion(actual.version)}, requer >= v${formatVersion(dep.required_version)}${dep.compatibility_note ? ` — ${dep.compatibility_note}` : ''}`;
        if (isMandatory) {
          errors.push({ module_key: moduleKey, dependency: dep.required_module_id, required_version: formatVersion(dep.required_version), actual_version: formatVersion(actual.version), message: msg });
        } else {
          warnings.push({ module_key: moduleKey, message: msg });
        }
      }
    }

    if (targetVersion) {
      const broken = await this.wouldBreak(moduleKey, targetVersion);
      for (const b of broken) {
        errors.push({
          module_key: moduleKey,
          dependency: b,
          required_version: formatVersion(targetVersion),
          actual_version: formatVersion(targetVersion),
          message: `Publicar "${moduleKey}" como v${formatVersion(targetVersion)} quebrará o módulo "${b}" que depende de uma versão mais alta — atualize "${b}" primeiro ou escolha um bump de versão compatível`,
        });
      }
    }

    return { ok: errors.length === 0, errors, warnings };
  }

  async validateAll(): Promise<PrePublishResult> {
    const allCurrent = await this.moduleRegistry.listAllCurrent();
    const errors: PrePublishError[] = [];
    const warnings: PrePublishWarning[] = [];

    for (const mod of allCurrent) {
      const result = await this.validateBeforePublish(mod.module_id);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return { ok: errors.length === 0, errors, warnings };
  }

  async snapshot(): Promise<DependencySnapshot> {
    const allCurrent = await this.moduleRegistry.listAllCurrent();
    const modules = allCurrent.map(mv => ({
      module_key: mv.module_id,
      version: mv.version,
      dependencies: mv.dependencies,
    }));
    const conflicts = this.detectConflicts(modules);
    return { timestamp: new Date().toISOString(), modules, conflicts };
  }

  detectConflicts(
    modules: Array<{ module_key: string; version: SemanticVersion; dependencies: ModuleDependency[] }>,
  ): DependencyConflict[] {
    const versionMap = new Map(modules.map(m => [m.module_key, m.version]));
    const conflicts: DependencyConflict[] = [];

    for (const mod of modules) {
      for (const dep of mod.dependencies) {
        const actual = versionMap.get(dep.required_module_id);
        if (!actual) {
          conflicts.push({ module_key: dep.required_module_id, required_by: mod.module_key, required_version: dep.required_version, actual_version: { major: 0, minor: 0, patch: 0 }, severity: 'error' });
          continue;
        }
        if (compareVersions(actual, dep.required_version) < 0) {
          conflicts.push({ module_key: dep.required_module_id, required_by: mod.module_key, required_version: dep.required_version, actual_version: actual, severity: 'error' });
        }
      }
    }
    return conflicts;
  }

  async activationOrder(moduleKey: string, visited = new Set<string>()): Promise<string[]> {
    if (visited.has(moduleKey)) return [];
    visited.add(moduleKey);
    const current = await this.moduleRegistry.getCurrent(moduleKey);
    if (!current) return [moduleKey];
    const order: string[] = [];
    for (const dep of current.dependencies) {
      order.push(...await this.activationOrder(dep.required_module_id, visited));
    }
    order.push(moduleKey);
    return order;
  }

  async wouldBreak(moduleKey: string, toVersion: SemanticVersion): Promise<string[]> {
    const broken: string[] = [];
    const allCurrent = await this.moduleRegistry.listAllCurrent();
    for (const mod of allCurrent) {
      for (const dep of mod.dependencies) {
        if (dep.required_module_id === moduleKey && compareVersions(toVersion, dep.required_version) < 0) {
          broken.push(mod.module_id);
        }
      }
    }
    return broken;
  }

  async graph(): Promise<Record<string, string[]>> {
    const keys = await this.moduleRegistry.listModuleKeys();
    const g: Record<string, string[]> = {};
    for (const key of keys) {
      const cur = await this.moduleRegistry.getCurrent(key);
      g[key] = cur?.dependencies.map(d => d.required_module_id) ?? [];
    }
    return g;
  }
}
