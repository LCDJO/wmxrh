/**
 * ModuleVersionSeeder — Seeds initial versions for all cataloged modules.
 * Idempotent: skips modules that already have a version registered.
 */
import { getAdvancedVersioningEngine } from './index';
import { MODULE_CATALOG } from './module-catalog';

export async function seedAllModuleVersions(createdBy: string): Promise<{
  seeded: string[];
  skipped: string[];
  errors: Array<{ module_id: string; error: string }>;
}> {
  const engine = getAdvancedVersioningEngine();
  const seeded: string[] = [];
  const skipped: string[] = [];
  const errors: Array<{ module_id: string; error: string }> = [];

  for (const entry of MODULE_CATALOG) {
    try {
      const existing = await engine.modules.getLatest(entry.module_id);
      if (existing) {
        skipped.push(entry.module_id);
        continue;
      }

      const opts: Record<string, any> = { changelog_summary: entry.changelog_summary };

      // Two-layer modules get layer-specific versions
      if (entry.module_id === 'support_module') {
        opts.tenant_app_version = `v${entry.initial_version.major}.${entry.initial_version.minor}.${entry.initial_version.patch}`;
        opts.platform_console_version = `v${entry.initial_version.major}.${entry.initial_version.minor}.${entry.initial_version.patch}`;
      }

      const version = await engine.modules.register(
        entry.module_id,
        entry.initial_version,
        createdBy,
        opts,
      );

      // Auto-release initial version
      await engine.modules.release(entry.module_id, version.id);
      seeded.push(entry.module_id);
    } catch (err: any) {
      errors.push({ module_id: entry.module_id, error: err.message });
    }
  }

  return { seeded, skipped, errors };
}
