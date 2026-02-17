/**
 * RestrictionBridge — Maps restricted_access announcements
 * to FeatureFlagEngine overrides.
 *
 * When a TenantAnnouncement with blocking_level='restricted_access' is active,
 * the bridge disables the corresponding feature flags via runtime overrides.
 *
 * Mapping:
 *   billing  → payroll_module, benefits_management
 *   fiscal   → payroll_module, labor_compliance
 *   system   → (all business features)
 *   security → (all business features)
 */

import { featureFlagEngine } from '@/domains/security/kernel';
import type { AlertType, TenantAnnouncement } from './announcement-hub';
import type { BusinessFeatureKey } from '@/domains/security/feature-flags';
import { BUSINESS_FEATURES } from '@/domains/security/feature-flags';

// ═══════════════════════════════════════════
// Alert → Features restriction map
// ═══════════════════════════════════════════

const RESTRICTION_MAP: Record<AlertType, readonly BusinessFeatureKey[]> = {
  billing:  ['payroll_module', 'benefits_management'],
  fiscal:   ['payroll_module', 'labor_compliance'],
  system:   BUSINESS_FEATURES,
  security: BUSINESS_FEATURES,
};

// Internal key prefix to track bridge-set overrides
const BRIDGE_PREFIX = '__restriction_bridge__';

let appliedKeys: string[] = [];

// ═══════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════

/**
 * Apply feature flag overrides based on active restricted_access announcements.
 * Should be called whenever announcements change.
 */
export function applyRestrictions(
  announcements: TenantAnnouncement[],
  tenantId?: string,
): void {
  // 1. Clear previous bridge overrides
  clearRestrictions();

  // 2. Collect restricted announcements
  const restricted = announcements.filter(
    a => a.blocking_level === 'restricted_access',
  );

  if (restricted.length === 0) return;

  // 3. Collect all features to disable (deduplicated)
  const featuresToDisable = new Set<BusinessFeatureKey>();
  for (const ann of restricted) {
    const features = RESTRICTION_MAP[ann.alert_type];
    if (features) {
      for (const f of features) featuresToDisable.add(f);
    }
  }

  // 4. Set overrides in the FeatureFlagEngine
  for (const feature of featuresToDisable) {
    featureFlagEngine.setOverride(feature, {
      enabled: false,
      tenantId,
    });
    appliedKeys.push(feature);
  }
}

/**
 * Clear all restriction overrides previously set by the bridge.
 */
export function clearRestrictions(): void {
  if (appliedKeys.length === 0) return;
  // Re-clear overrides — the engine will fall back to DB/static values
  featureFlagEngine.clearOverrides();
  appliedKeys = [];
}

/**
 * Get the list of features currently restricted by announcements.
 */
export function getRestrictedFeatures(
  announcements: TenantAnnouncement[],
): BusinessFeatureKey[] {
  const restricted = announcements.filter(
    a => a.blocking_level === 'restricted_access',
  );
  const features = new Set<BusinessFeatureKey>();
  for (const ann of restricted) {
    const mapped = RESTRICTION_MAP[ann.alert_type];
    if (mapped) for (const f of mapped) features.add(f);
  }
  return [...features];
}

/**
 * Get the restriction map for reference.
 */
export function getRestrictionMap() {
  return RESTRICTION_MAP;
}
