/**
 * RollbackOrchestrator — Plans and executes release rollbacks.
 */
import type { RollbackPlan, RollbackStep, Release } from './types';
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

  /** Plan a rollback from current release to a target release */
  plan(currentReleaseId: string, targetReleaseId: string, createdBy: string): RollbackPlan | null {
    const current = this.releaseManager.getById(currentReleaseId);
    const target = this.releaseManager.getById(targetReleaseId);
    if (!current || !target) return null;

    const steps: RollbackStep[] = [];
    const modulesAffected: string[] = [];
    let hasBreaking = false;

    const currentModules = new Set(current.module_versions);
    const targetModules = new Set(target.module_versions);

    for (const mvId of currentModules) {
      if (!targetModules.has(mvId)) {
        for (const key of this.moduleRegistry.listModuleKeys()) {
          const mv = this.moduleRegistry.getById(key, mvId);
          if (mv) {
            modulesAffected.push(key);
            const targetMv = this.findModuleInRelease(target, key);
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
    }

    if (current.platform_version_id !== target.platform_version_id && target.platform_version_id) {
      steps.push({
        order: steps.length + 1,
        action: 'restore_platform_version',
        target: target.platform_version_id,
        status: 'pending',
      });
    }

    steps.push({
      order: steps.length + 1,
      action: 'notify',
      target: 'all_stakeholders',
      status: 'pending',
    });

    const snapshot = this.dependencyResolver.snapshot();
    const depSafe = snapshot.conflicts.filter(c => c.severity === 'error').length === 0;

    return {
      id: versionId(),
      release_id: currentReleaseId,
      target_release_id: targetReleaseId,
      modules_affected: modulesAffected,
      dependency_safe: depSafe,
      breaking_rollback: hasBreaking,
      steps,
      created_at: new Date().toISOString(),
      created_by: createdBy,
    };
  }

  executeStep(plan: RollbackPlan, stepOrder: number): RollbackStep | null {
    const step = plan.steps.find(s => s.order === stepOrder);
    if (!step || step.status !== 'pending') return null;
    step.status = 'in_progress';
    step.status = 'done';
    return step;
  }

  executeFull(plan: RollbackPlan): RollbackPlan {
    for (const step of plan.steps.sort((a, b) => a.order - b.order)) {
      this.executeStep(plan, step.order);
    }
    this.releaseManager.transition(plan.release_id, 'rolled_back');
    return plan;
  }

  private findModuleInRelease(release: Release, moduleKey: string) {
    for (const mvId of release.module_versions) {
      const mv = this.moduleRegistry.getById(moduleKey, mvId);
      if (mv) return mv;
    }
    return null;
  }
}
