/**
 * SecurityKernel — FeatureFlagEngine
 * 
 * Runtime feature flag evaluation.
 * Wraps the static SECURITY_FEATURES with a queryable API.
 * Supports overrides for testing and per-tenant customization.
 */

import { SECURITY_FEATURES, type SecurityFeatureKey } from '../feature-flags';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export interface FeatureFlagContext {
  tenantId?: string;
  roles?: string[];
}

type FlagOverride = {
  enabled: boolean;
  tenantId?: string; // null = global override
};

// ════════════════════════════════════
// ENGINE
// ════════════════════════════════════

export interface FeatureFlagEngineAPI {
  /** Check if a feature is enabled */
  isEnabled: (feature: SecurityFeatureKey, ctx?: FeatureFlagContext) => boolean;
  /** Get the full config for a feature */
  getConfig: <K extends SecurityFeatureKey>(feature: K) => typeof SECURITY_FEATURES[K];
  /** Set a runtime override (useful for testing or per-tenant flags) */
  setOverride: (feature: SecurityFeatureKey, override: FlagOverride) => void;
  /** Clear all runtime overrides */
  clearOverrides: () => void;
}

function createFeatureFlagEngine(): FeatureFlagEngineAPI {
  const overrides = new Map<SecurityFeatureKey, FlagOverride[]>();

  return {
    isEnabled: (feature, ctx) => {
      // Check overrides first (most specific wins)
      const featureOverrides = overrides.get(feature);
      if (featureOverrides) {
        // Tenant-specific override
        if (ctx?.tenantId) {
          const tenantOverride = featureOverrides.find(o => o.tenantId === ctx.tenantId);
          if (tenantOverride) return tenantOverride.enabled;
        }
        // Global override
        const globalOverride = featureOverrides.find(o => !o.tenantId);
        if (globalOverride) return globalOverride.enabled;
      }

      // Fall back to static config
      return SECURITY_FEATURES[feature]?.enabled ?? false;
    },

    getConfig: (feature) => SECURITY_FEATURES[feature],

    setOverride: (feature, override) => {
      const existing = overrides.get(feature) || [];
      // Replace existing override for same tenantId
      const filtered = existing.filter(o => o.tenantId !== override.tenantId);
      filtered.push(override);
      overrides.set(feature, filtered);
    },

    clearOverrides: () => {
      overrides.clear();
    },
  };
}

export const featureFlagEngine = createFeatureFlagEngine();
