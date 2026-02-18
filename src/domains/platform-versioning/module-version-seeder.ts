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

      const version = await engine.modules.register(
        entry.module_id,
        entry.initial_version,
        createdBy,
        { changelog_summary: entry.changelog_summary },
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
