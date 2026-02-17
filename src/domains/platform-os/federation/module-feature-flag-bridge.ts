/**
 * ModuleFeatureFlagBridge — Syncs module-declared feature flags
 * with the FeatureLifecycleManager.
 *
 * Each module manifest declares `feature_flags[]`. This bridge:
 *   1. Auto-registers each flag in the FeatureLifecycleManager on module install
 *   2. Provides a module-scoped `isEnabled(flag)` check
 *   3. Supports `default_enabled` per flag via ModuleFeatureFlagDeclaration
 */

import type { FeatureLifecycleAPI, FeaturePhase, GlobalEventKernelAPI } from '../types';
import type { ModuleManifest } from './module-loader';

// ── Types ──────────────────────────────────────────────────────

export interface ModuleFeatureFlagDeclaration {
  /** Flag key (e.g. "ads_module", "ff_hr_bulk_import") */
  feature: string;
  /** Whether the flag is enabled by default */
  default_enabled: boolean;
  /** Optional initial phase */
  phase?: FeaturePhase;
  /** Human-readable description */
  description?: string;
  /** Rollout percentage (0-100) */
  rollout_pct?: number;
}

export interface ModuleFeatureFlagBridgeAPI {
  /** Register all flags from a module manifest using declarations */
  registerModuleFlags(moduleId: string, declarations: ModuleFeatureFlagDeclaration[]): void;
  /** Auto-register flags from manifest with default settings */
  registerFromManifest(manifest: ModuleManifest): void;
  /** Check if a module flag is enabled */
  isEnabled(flag: string, ctx?: { tenantId?: string }): boolean;
  /** List all flags registered by a specific module */
  listFlagsForModule(moduleId: string): string[];
  /** Get all module → flag mappings */
  flagMap(): Record<string, string[]>;
  /** Start auto-registration on module install events */
  startAutoSync(): () => void;
}

export function createModuleFeatureFlagBridge(
  features: FeatureLifecycleAPI,
  events: GlobalEventKernelAPI,
): ModuleFeatureFlagBridgeAPI {
  /** moduleId → flag keys */
  const moduleFlagMap = new Map<string, string[]>();

  function registerModuleFlags(moduleId: string, declarations: ModuleFeatureFlagDeclaration[]): void {
    const keys: string[] = [];

    for (const decl of declarations) {
      keys.push(decl.feature);

      // Register in FeatureLifecycleManager if not already present
      try {
        features.register({
          key: decl.feature,
          label: decl.description ?? decl.feature,
          phase: decl.phase ?? (decl.default_enabled ? 'active' : 'experimental'),
          enabled: decl.default_enabled,
          module: moduleId,
          rollout_pct: decl.rollout_pct ?? 100,
          allowed_tenants: [],
          denied_tenants: [],
          sunset_at: null,
          description: decl.description,
        });
      } catch {
        // Flag may already exist — that's fine
      }

      // If default_enabled and currently disabled, toggle it on
      if (decl.default_enabled && !features.isEnabled(decl.feature)) {
        try { features.toggle(decl.feature, true); } catch { /* ignore */ }
      }
    }

    moduleFlagMap.set(moduleId, keys);

    events.emit('module:feature_flags_registered', 'FeatureFlagBridge', {
      module_id: moduleId,
      count: declarations.length,
      flags: keys,
    });
  }

  function registerFromManifest(manifest: ModuleManifest): void {
    if (manifest.feature_flags.length === 0) return;

    const declarations: ModuleFeatureFlagDeclaration[] = manifest.feature_flags.map(flag => ({
      feature: flag,
      default_enabled: false,
      description: `Feature flag "${flag}" from module ${manifest.module_name}`,
    }));

    registerModuleFlags(manifest.module_id, declarations);
  }

  function isEnabled(flag: string, ctx?: { tenantId?: string }): boolean {
    return features.isEnabled(flag, ctx);
  }

  function listFlagsForModule(moduleId: string): string[] {
    return moduleFlagMap.get(moduleId) ?? [];
  }

  function flagMap(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const [k, v] of moduleFlagMap) map[k] = [...v];
    return map;
  }

  function startAutoSync(): () => void {
    // Listen for manifest registrations and auto-register flags
    return events.on('module:manifest_registered', (payload: any) => {
      if (!payload?.key) return;
      // We need the manifest — emit a request to PlatformCore
      events.emit('module:feature_flags_sync_requested', 'FeatureFlagBridge', { key: payload.key });
    });
  }

  return {
    registerModuleFlags,
    registerFromManifest,
    isEnabled,
    listFlagsForModule,
    flagMap,
    startAutoSync,
  };
}
