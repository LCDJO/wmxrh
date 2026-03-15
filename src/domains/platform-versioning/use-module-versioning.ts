/**
 * useModuleVersioning — Hook for bumping module versions and tracking changes.
 *
 * Usage:
 *   const { bumpModule, trackChange } = useModuleVersioning();
 *   await bumpModule('support_module', 'major', 'Refactor para módulo versionado');
 *   await trackChange('support_module', 'feature', 'live_chat', 'created', { before: null, after: { enabled: true } });
 */
import { useCallback } from 'react';
import { getAdvancedVersioningEngine } from './index';
import { bumpVersion } from './version-utils';
import { useAuth } from '@/contexts/AuthContext';
import type { ChangeType } from './types';
import { MODULE_CATALOG } from './module-catalog';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';

type BumpLevel = 'major' | 'minor' | 'patch';

export function useModuleVersioning() {
  const { user } = useAuth();
  const { can } = usePlatformPermissions();

  const bumpModule = useCallback(async (
    moduleId: string,
    level: BumpLevel,
    changelogSummary: string,
    opts?: { breaking_changes?: boolean },
  ) => {
    // Permission gate — only versioning.publish holders
    if (!can('versioning.publish')) {
      throw new Error('Permissão negada: apenas PlatformSuperAdmin e PlatformOperations podem atualizar versões de módulo.');
    }

    const engine = getAdvancedVersioningEngine();
    const userId = user?.id ?? 'system';

    // Get current version or use 0.0.0 as base
    const current = await engine.modules.getLatest(moduleId);
    const baseVersion = current?.version ?? { major: 0, minor: 0, patch: 0 };
    const nextVersion = bumpVersion(baseVersion, level);

    const newVersion = await engine.modules.register(
      moduleId,
      nextVersion,
      userId,
      {
        changelog_summary: changelogSummary,
        breaking_changes: opts?.breaking_changes ?? (level === 'major'),
      },
    );

    // Validate dependencies before releasing — block if mandatory deps are unmet or
    // if publishing this version would break dependents in the registry.
    const validation = await engine.dependencies.validateBeforePublish(moduleId, nextVersion);
    if (!validation.ok) {
      // Mark the draft as deprecated so it doesn't pollute the registry
      await engine.modules.deprecate(moduleId, newVersion.id);
      const messages = validation.errors.map(e => e.message).join('\n• ');
      throw new Error(`Publicação bloqueada por dependências não satisfeitas:\n• ${messages}`);
    }

    // Release
    await engine.modules.release(moduleId, newVersion.id);

    // Track the change in changelog
    await engine.tracker.trackModuleLifecycle(
      moduleId,
      'updated',
      userId,
      newVersion.version_tag,
      current ? { version: current.version_tag } : undefined,
      { version: newVersion.version_tag, changelog: changelogSummary },
    );

    return newVersion;
  }, [user]);

  const trackChange = useCallback(async (
    moduleId: string,
    entityType: string,
    entityId: string,
    changeType: ChangeType,
    diff?: { before?: Record<string, unknown>; after?: Record<string, unknown> },
  ) => {
    const engine = getAdvancedVersioningEngine();
    const userId = user?.id ?? 'system';

    // Get current version tag
    const current = await engine.modules.getLatest(moduleId);
    const versionTag = current?.version_tag ?? 'v0.0.0';

    await engine.changelog.log({
      module_id: moduleId,
      entity_type: entityType,
      entity_id: entityId,
      change_type: changeType,
      version_tag: versionTag,
      payload_diff: {
        before: diff?.before ?? null,
        after: diff?.after ?? null,
      },
      changed_by: userId,
    });
  }, [user]);

  const getModuleInfo = useCallback((moduleId: string) => {
    return MODULE_CATALOG.find(m => m.module_id === moduleId) ?? null;
  }, []);

  return { bumpModule, trackChange, getModuleInfo };
}
