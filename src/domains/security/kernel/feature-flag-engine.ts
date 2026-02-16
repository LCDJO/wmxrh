/**
 * SecurityKernel — FeatureFlagEngine
 * 
 * Dual-layer feature flag evaluation:
 *   1. Static SECURITY_FEATURES (code defaults)
 *   2. Dynamic feature_flags table (DB, per tenant/group/company)
 * 
 * Resolution order (most specific wins):
 *   company flag → group flag → tenant flag → static default
 * 
 * The engine caches DB flags and provides a reactive query hook.
 */

import { SECURITY_FEATURES, type SecurityFeatureKey, type BusinessFeatureKey, type FeatureKey } from '../feature-flags';
import type { SecurityContext } from './identity.service';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export interface FeatureFlagContext {
  tenantId?: string;
  companyGroupId?: string | null;
  companyId?: string | null;
  roles?: string[];
}

export interface FeatureFlagRecord {
  id: string;
  tenant_id: string;
  feature_name: string;
  enabled: boolean;
  company_group_id: string | null;
  company_id: string | null;
  metadata: Record<string, unknown>;
}

type FlagOverride = {
  enabled: boolean;
  tenantId?: string;
  companyGroupId?: string;
  companyId?: string;
};

// ════════════════════════════════════
// ENGINE
// ════════════════════════════════════

export interface FeatureFlagEngineAPI {
  // ── Query API ──
  /** Check if a feature is enabled (merges static + DB + overrides) */
  isEnabled: (feature: FeatureKey, ctx?: FeatureFlagContext) => boolean;
  /** Check feature from SecurityContext (preferred) */
  isEnabledForContext: (feature: FeatureKey, ctx: SecurityContext) => boolean;
  /** Get static config for a security feature */
  getConfig: <K extends SecurityFeatureKey>(feature: K) => typeof SECURITY_FEATURES[K];

  // ── DB Cache ──
  /** Load flags from DB into cache */
  loadFlags: (flags: FeatureFlagRecord[]) => void;
  /** Clear cached DB flags */
  clearCache: () => void;
  /** Get all cached flags for a tenant */
  getCachedFlags: (tenantId: string) => FeatureFlagRecord[];

  // ── Runtime Overrides ──
  /** Set a runtime override (testing / per-tenant) */
  setOverride: (feature: FeatureKey, override: FlagOverride) => void;
  /** Clear all runtime overrides */
  clearOverrides: () => void;
}

function createFeatureFlagEngine(): FeatureFlagEngineAPI {
  const overrides = new Map<string, FlagOverride[]>();
  let cachedFlags: FeatureFlagRecord[] = [];

  function resolveFromDB(
    feature: string,
    tenantId?: string,
    companyGroupId?: string | null,
    companyId?: string | null,
  ): boolean | null {
    if (!tenantId) return null;

    const tenantFlags = cachedFlags.filter(
      f => f.tenant_id === tenantId && f.feature_name === feature,
    );

    if (tenantFlags.length === 0) return null;

    // Most specific wins: company → group → tenant
    if (companyId) {
      const companyFlag = tenantFlags.find(f => f.company_id === companyId);
      if (companyFlag) return companyFlag.enabled;
    }

    if (companyGroupId) {
      const groupFlag = tenantFlags.find(
        f => f.company_group_id === companyGroupId && !f.company_id,
      );
      if (groupFlag) return groupFlag.enabled;
    }

    // Tenant-wide flag (no group/company)
    const tenantFlag = tenantFlags.find(
      f => !f.company_group_id && !f.company_id,
    );
    if (tenantFlag) return tenantFlag.enabled;

    return null;
  }

  function resolveFromOverrides(
    feature: string,
    tenantId?: string,
    companyGroupId?: string | null,
    companyId?: string | null,
  ): boolean | null {
    const featureOverrides = overrides.get(feature);
    if (!featureOverrides || featureOverrides.length === 0) return null;

    // Most specific override wins
    if (companyId) {
      const co = featureOverrides.find(o => o.companyId === companyId);
      if (co) return co.enabled;
    }
    if (companyGroupId) {
      const go = featureOverrides.find(o => o.companyGroupId === companyGroupId && !o.companyId);
      if (go) return go.enabled;
    }
    if (tenantId) {
      const to = featureOverrides.find(o => o.tenantId === tenantId && !o.companyGroupId && !o.companyId);
      if (to) return to.enabled;
    }
    // Global override
    const global = featureOverrides.find(o => !o.tenantId && !o.companyGroupId && !o.companyId);
    if (global) return global.enabled;

    return null;
  }

  function isEnabledInternal(
    feature: string,
    tenantId?: string,
    companyGroupId?: string | null,
    companyId?: string | null,
  ): boolean {
    // 1. Runtime overrides (highest priority)
    const override = resolveFromOverrides(feature, tenantId, companyGroupId, companyId);
    if (override !== null) return override;

    // 2. DB flags
    const dbResult = resolveFromDB(feature, tenantId, companyGroupId, companyId);
    if (dbResult !== null) return dbResult;

    // 3. Static security features (lowest priority)
    if (feature in SECURITY_FEATURES) {
      return SECURITY_FEATURES[feature as SecurityFeatureKey]?.enabled ?? false;
    }

    // Unknown feature = disabled
    return false;
  }

  return {
    isEnabled: (feature, ctx) => {
      return isEnabledInternal(
        feature,
        ctx?.tenantId,
        ctx?.companyGroupId,
        ctx?.companyId,
      );
    },

    isEnabledForContext: (feature, ctx) => {
      const sr = ctx.meta.scopeResolution;
      return isEnabledInternal(
        feature,
        ctx.tenant_id,
        sr.uiScope.groupId,
        sr.uiScope.companyId,
      );
    },

    getConfig: (feature) => SECURITY_FEATURES[feature],

    loadFlags: (flags) => {
      cachedFlags = [...flags];
    },

    clearCache: () => {
      cachedFlags = [];
    },

    getCachedFlags: (tenantId) => cachedFlags.filter(f => f.tenant_id === tenantId),

    setOverride: (feature, override) => {
      const existing = overrides.get(feature) || [];
      const key = `${override.tenantId}-${override.companyGroupId}-${override.companyId}`;
      const filtered = existing.filter(o =>
        `${o.tenantId}-${o.companyGroupId}-${o.companyId}` !== key,
      );
      filtered.push(override);
      overrides.set(feature, filtered);
    },

    clearOverrides: () => {
      overrides.clear();
    },
  };
}

export const featureFlagEngine = createFeatureFlagEngine();
