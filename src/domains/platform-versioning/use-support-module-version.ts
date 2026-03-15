/**
 * useSupportModuleVersion — Resolves the effective SupportModule version and
 * feature flags for a tenant at runtime.
 *
 * Resolution order:
 *   1. Active sandbox preview session for this tenant
 *      → loads the preview version + merges feature_flags_override on top
 *   2. No preview → loads the globally released support_module version
 *   3. No released version → returns empty flags (all features use defaults)
 *
 * Usage:
 *   const { flag, isPreview, loading } = useSupportModuleVersion(tenantId);
 *   if (flag('live_chat_enabled', true)) { ... }
 */
import { useState, useEffect, useCallback } from 'react';
import { SupportModuleSandboxPreview } from './support-sandbox-preview';
import { SupportModuleVersionRegistry } from './support-module-version';
import type { SupportModuleVersion } from './support-module-version';
import type { SandboxPreviewSession } from './support-sandbox-preview';

export interface SupportModuleVersionContext {
  /** Resolved feature flags (preview overrides applied on top of base flags) */
  featureFlags: Record<string, boolean | string | number>;
  /** Convenience helper — reads a flag with a fallback default */
  flag: <T extends boolean | string | number>(key: string, defaultValue: T) => T;
  /** Whether the tenant is currently in a sandbox preview session */
  isPreview: boolean;
  /** Active preview session, if any */
  previewSession: SandboxPreviewSession | null;
  /** Resolved version record (base version, not the override) */
  version: SupportModuleVersion | null;
  loading: boolean;
}

const previewService = new SupportModuleSandboxPreview();
const versionRegistry = new SupportModuleVersionRegistry();

export function useSupportModuleVersion(tenantId: string | null | undefined): SupportModuleVersionContext {
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean | string | number>>({});
  const [version, setVersion] = useState<SupportModuleVersion | null>(null);
  const [previewSession, setPreviewSession] = useState<SandboxPreviewSession | null>(null);
  const [loading, setLoading] = useState(true);

  const resolve = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Check for an active preview session for this tenant
      const activePreview = await previewService.getActiveForTenant(tenantId);

      if (activePreview) {
        // Load the specific version being previewed
        const previewVersion = await versionRegistry.getById(activePreview.version_id);
        const baseFlags = previewVersion?.feature_flags ?? {};

        // Merge: base version flags first, then preview overrides on top
        const merged: Record<string, boolean | string | number> = {
          ...baseFlags,
          ...activePreview.feature_flags_override,
        };

        setVersion(previewVersion);
        setPreviewSession(activePreview);
        setFeatureFlags(merged);
      } else {
        // 2. Fall back to the globally released version
        const currentVersion = await versionRegistry.getCurrent();
        setVersion(currentVersion);
        setPreviewSession(null);
        setFeatureFlags(currentVersion?.feature_flags ?? {});
      }
    } catch {
      // Non-blocking — on error fall back to empty flags (all features use defaults)
      setVersion(null);
      setPreviewSession(null);
      setFeatureFlags({});
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { resolve(); }, [resolve]);

  const flag = useCallback(
    <T extends boolean | string | number>(key: string, defaultValue: T): T => {
      const val = featureFlags[key];
      if (val === undefined) return defaultValue;
      return val as T;
    },
    [featureFlags],
  );

  return { featureFlags, flag, isPreview: previewSession !== null, previewSession, version, loading };
}
