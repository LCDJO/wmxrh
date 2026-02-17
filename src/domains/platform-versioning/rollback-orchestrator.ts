/**
 * RollbackOrchestrator — Plans and executes rollbacks by module or full release.
 */
import type { RollbackPlan, RollbackStep, Release, RollbackScope, SemanticVersion } from './types';
import { ROLLBACK_PROTECTED_MODULES } from './types';
import type { ReleaseManager } from './release-manager';
import type { DependencyResolver } from './dependency-resolver';
import type { ModuleVersionRegistry } from './module-version-registry';
import { versionId } from './version-utils';

export class RollbackOrchestrator {
  constructor(
    private releaseManager: ReleaseManager,
    private moduleRegistry: ModuleVersionRegistry,
    private dependencyResolver: DependencyResolver,
  ) {}

  async planModuleRollback(
    moduleKey: string,
    targetVersionId: string,
    createdBy: string,
  ): Promise<RollbackPlan | null> {
    if (this.isProtected(moduleKey)) return null;

    const current = await this.moduleRegistry.getCurrent(moduleKey);
    const target = await this.moduleRegistry.getById(moduleKey, targetVersionId);
    if (!current || !target) return null;

    const steps: RollbackStep[] = [];

    steps.push({
      order: 1,
      action: 'downgrade_module',
      target: moduleKey,
      from_version: current.version,
      to_version: target.version,
      status: 'pending',
    });

    const broken = await this.dependencyResolver.wouldBreak(moduleKey, target.version);
    for (const dep of broken) {
      if (this.isProtected(dep)) {
        steps.push({
          order: steps.length + 1,
          action: 'skip_protected',
          target: dep,
          reason: `Módulo financeiro "${dep}" não pode ser afetado pelo rollback`,
          status: 'skipped',
        });
      }
    }

    steps.push({ order: steps.length + 1, action: 'notify', target: 'all_stakeholders', status: 'pending' });

    const snapshot = await this.dependencyResolver.snapshot();
    const depSafe = snapshot.conflicts.filter(c => c.severity === 'error').length === 0;

    return {
      id: versionId(),
      scope: 'module',
      release_id: '',
      target_release_id: '',
      modules_affected: [moduleKey],
      modules_skipped: [],
      dependency_safe: depSafe,
      breaking_rollback: current.breaking_changes,
      steps,
      created_at: new Date().toISOString(),
      created_by: createdBy,
    };
  }

  async plan(currentReleaseId: string, targetReleaseId: string, createdBy: string): Promise<RollbackPlan | null> {
    const current = await this.releaseManager.getById(currentReleaseId);
    const target = await this.releaseManager.getById(targetReleaseId);
    if (!current || !target) return null;

    const steps: RollbackStep[] = [];
    const modulesAffected: string[] = [];
    const modulesSkipped: string[] = [];
    let hasBreaking = false;

    const currentModules = new Set(current.module_versions);
    const targetModules = new Set(target.module_versions);

    const allKeys = await this.moduleRegistry.listModuleKeys();

    for (const mvId of currentModules) {
      if (!targetModules.has(mvId)) {
        for (const key of allKeys) {
          const mv = await this.moduleRegistry.getById(key, mvId);
          if (!mv) continue;

          if (this.isProtected(key)) {
            modulesSkipped.push(key);
            steps.push({
              order: steps.length + 1,
              action: 'skip_protected',
              target: key,
              from_version: mv.version,
              reason: `Módulo financeiro "${key}" protegido contra rollback — dados imutáveis`,
              status: 'skipped',
            });
            break;
          }

          modulesAffected.push(key);
          const targetMv = await this.findModuleInRelease(target, key);

          if (targetMv) {
            steps.push({
              order: steps.length + 1,
              action: 'downgrade_module',
              target: key,
              from_version: mv.version,
              to_version: targetMv.version,
              status: 'pending',
            });
            if (mv.breaking_changes) hasBreaking = true;
          } else {
            steps.push({
              order: steps.length + 1,
              action: 'deactivate_module',
              target: key,
              from_version: mv.version,
              status: 'pending',
            });
          }
          break;
        }
      }
    }

    if (current.platform_version_id !== target.platform_version_id && target.platform_version_id) {
      steps.push({
        order: steps.length + 1,
        action: 'restore_platform_version',
        target: target.platform_version_id,
        status: 'pending',
      });
    }

    steps.push({ order: steps.length + 1, action: 'notify', target: 'all_stakeholders', status: 'pending' });

    const snapshot = await this.dependencyResolver.snapshot();
    const depSafe = snapshot.conflicts.filter(c => c.severity === 'error').length === 0;

    return {
      id: versionId(),
      scope: 'release',
      release_id: currentReleaseId,
      target_release_id: targetReleaseId,
      modules_affected: modulesAffected,
      modules_skipped: modulesSkipped,
      dependency_safe: depSafe,
      breaking_rollback: hasBreaking,
      steps,
      created_at: new Date().toISOString(),
      created_by: createdBy,
    };
  }

  executeStep(plan: RollbackPlan, stepOrder: number): RollbackStep | null {
    const step = plan.steps.find(s => s.order === stepOrder);
    if (!step || step.status === 'skipped' || step.status === 'done') return null;
    if (step.status !== 'pending') return null;
    step.status = 'in_progress';
    step.status = 'done';
    return step;
  }

  async executeFull(plan: RollbackPlan): Promise<RollbackPlan> {
    for (const step of plan.steps.sort((a, b) => a.order - b.order)) {
      if (step.status === 'skipped') continue;
      this.executeStep(plan, step.order);
    }
    if (plan.scope === 'release' && plan.release_id) {
      await this.releaseManager.transition(plan.release_id, 'rolled_back');
    }
    return plan;
  }

  isProtected(moduleKey: string): boolean {
    return ROLLBACK_PROTECTED_MODULES.includes(moduleKey);
  }

  private async findModuleInRelease(release: Release, moduleKey: string) {
    for (const mvId of release.module_versions) {
      const mv = await this.moduleRegistry.getById(moduleKey, mvId);
      if (mv) return mv;
    }
    return null;
  }
}
