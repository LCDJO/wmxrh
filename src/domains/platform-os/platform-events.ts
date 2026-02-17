/**
 * Platform OS — Canonical Event Catalog
 *
 * These are the 5 PRIMARY lifecycle events of the Platform OS.
 * All POSL orchestrators emit these through the GlobalEventKernel.
 *
 * ┌─────────────────────────────┬──────────────────────────────────────────┐
 * │ Event                       │ Emitted by                               │
 * ├─────────────────────────────┼──────────────────────────────────────────┤
 * │ PlatformBootstrapped        │ PlatformRuntime.boot()                   │
 * │ ModuleRegistered            │ ModuleOrchestrator.register()            │
 * │ IdentitySnapshotUpdated     │ IdentityOrchestrator.refresh() / change  │
 * │ NavigationTreeUpdated       │ NavigationOrchestrator (any mutation)    │
 * │ FeatureLifecycleChanged     │ FeatureLifecycleManager (toggle/phase)   │
 * └─────────────────────────────┴──────────────────────────────────────────┘
 *
 * Secondary/granular events (module:activated, feature:toggled, etc.)
 * still exist but these 5 are the canonical contract for consumers.
 */

// ══════════════════════════════════════════════════════════════════
// Event type constants
// ══════════════════════════════════════════════════════════════════

export const PLATFORM_EVENTS = {
  /** Runtime finished boot sequence, all services registered */
  PlatformBootstrapped: 'platform:bootstrapped',

  /** A new module was registered in the ModuleOrchestrator */
  ModuleRegistered: 'platform:module_registered',

  /** The OperationalIdentitySnapshot changed (any layer) */
  IdentitySnapshotUpdated: 'platform:identity_snapshot_updated',

  /** The merged NavigationTree was recomputed */
  NavigationTreeUpdated: 'platform:navigation_tree_updated',

  /** A feature flag was toggled or transitioned phase */
  FeatureLifecycleChanged: 'platform:feature_lifecycle_changed',

  // ── Module Lifecycle Events ─────────────────────────────────
  /** Module was installed (first-time registration with manifest) */
  ModuleInstalled: 'platform:module_installed',
  /** Module was enabled for a tenant / globally activated */
  ModuleEnabled: 'platform:module_enabled',
  /** Module was disabled for a tenant / globally deactivated */
  ModuleDisabled: 'platform:module_disabled',
  /** Module was upgraded to a new version */
  ModuleUpgraded: 'platform:module_upgraded',

  // ── Website / Growth Events ────────────────────────────────
  /** A website or landing page was published to production */
  WebsitePublished: 'platform:website_published',
  /** A new versioned snapshot of a landing page was created */
  LandingVersionCreated: 'platform:landing_version_created',
  /** AI Conversion Designer produced an optimization suggestion */
  AIConversionSuggested: 'platform:ai_conversion_suggested',
  /** FAB Content Engine generated a new Feature-Advantage-Benefit section */
  FABSectionGenerated: 'platform:fab_section_generated',
  /** Google Tag Manager container was injected into a published page */
  GTMInjected: 'platform:gtm_injected',

  // ── Versioning Events ─────────────────────────────────────
  /** A new module version was created (draft) */
  ModuleVersionCreated: 'platform:module_version_created',
  /** A module version was promoted to released */
  ModuleVersionReleased: 'platform:module_version_released',
  /** A platform release was finalized and published */
  PlatformReleasePublished: 'platform:release_published',
  /** A dependency conflict was detected between modules */
  DependencyConflictDetected: 'platform:dependency_conflict_detected',
  /** A rollback was executed on a release or module */
  RollbackExecuted: 'platform:rollback_executed',

  // ── Menu Structure Events ─────────────────────────────────
  /** The full menu structure was saved / updated */
  MenuStructureUpdated: 'platform:menu_structure_updated',
  /** A single menu item was moved (reordered or reparented) */
  MenuItemMoved: 'platform:menu_item_moved',
  /** A new versioned snapshot of the menu structure was created */
  MenuVersionCreated: 'platform:menu_version_created',
} as const;

export type PlatformEventType = typeof PLATFORM_EVENTS[keyof typeof PLATFORM_EVENTS];

// ══════════════════════════════════════════════════════════════════
// Typed payloads
// ══════════════════════════════════════════════════════════════════

export interface PlatformBootstrappedPayload {
  booted_at: number;
  services_count: number;
  modules_count: number;
}

export interface ModuleRegisteredPayload {
  key: string;
  label: string;
  enabled: boolean;
}

export interface IdentitySnapshotUpdatedPayload {
  user_id: string | null;
  is_authenticated: boolean;
  is_impersonating: boolean;
  tenant_id: string | null;
  scope_level: string | null;
  trigger: 'refresh' | 'context_switch' | 'phase_transition' | 'workspace_switch' | 'external';
}

export interface NavigationTreeUpdatedPayload {
  core_count: number;
  module_count: number;
  cognitive_count: number;
  pinned_count: number;
  trigger: 'core_registered' | 'module_registered' | 'module_removed' | 'cognitive_hints' | 'pin_change' | 'navigate';
}

export interface FeatureLifecycleChangedPayload {
  key: string;
  change: 'toggled' | 'phase_transitioned' | 'registered';
  enabled?: boolean;
  phase?: string;
  previous_phase?: string | null;
}

// ── Module Lifecycle Payloads ──────────────────────────────────

export interface ModuleInstalledPayload {
  key: string;
  label: string;
  version: string;
  is_core: boolean;
  has_manifest: boolean;
}

export interface ModuleEnabledPayload {
  key: string;
  tenant_id?: string;
  /** 'global' when activated platform-wide, 'tenant' when scoped */
  scope: 'global' | 'tenant';
}

export interface ModuleDisabledPayload {
  key: string;
  tenant_id?: string;
  scope: 'global' | 'tenant';
  reason?: string;
}

export interface ModuleUpgradedPayload {
  key: string;
  previous_version: string;
  new_version: string;
  breaking: boolean;
}

// ── Website / Growth Payloads ─────────────────────────────────

export interface WebsitePublishedPayload {
  page_id: string;
  page_slug: string;
  page_title: string;
  version: number;
  published_by: string;
  publisher_role: string;
  url: string;
}

export interface LandingVersionCreatedPayload {
  page_id: string;
  page_title: string;
  version_number: number;
  change_summary: string;
  created_by: string;
  snapshot_size_bytes: number;
}

export interface AIConversionSuggestedPayload {
  page_id: string;
  page_title: string;
  suggestion_id: string;
  category: string;
  predicted_lift_pct: number;
  confidence: number;
}

export interface FABSectionGeneratedPayload {
  page_id: string;
  block_id: string;
  block_type: string;
  fields_generated: ('feature' | 'advantage' | 'benefit')[];
  generated_by: 'ai' | 'manual';
}

export interface GTMInjectedPayload {
  page_id: string;
  page_slug: string;
  container_id: string;
  events_count: number;
  injected_by: string;
}

// ── Versioning Payloads ───────────────────────────────────

export interface ModuleVersionCreatedPayload {
  module_id: string;
  module_label: string;
  version_tag: string;
  breaking_changes: boolean;
  created_by: string;
}

export interface ModuleVersionReleasedPayload {
  module_id: string;
  module_label: string;
  version_tag: string;
  breaking_changes: boolean;
  released_by: string;
}

export interface PlatformReleasePublishedPayload {
  release_id: string;
  release_name: string;
  version_tag: string;
  modules_count: number;
  published_by: string;
  publisher_role: string;
}

export interface DependencyConflictDetectedPayload {
  module_key: string;
  required_by: string;
  required_version: string;
  actual_version: string;
  severity: 'warning' | 'error';
  release_id?: string;
}

export interface RollbackExecutedPayload {
  release_id: string;
  release_name: string;
  target_release_id: string;
  modules_affected: string[];
  modules_skipped: string[];
  executed_by: string;
  reason?: string;
}

// ── Menu Structure Payloads ───────────────────────────────

export interface MenuStructureUpdatedPayload {
  total_nodes: number;
  root_count: number;
  max_depth: number;
  updated_by: string;
}

export interface MenuItemMovedPayload {
  item_id: string;
  item_label: string;
  from_parent: string | null;
  to_parent: string | null;
  new_index: number;
}

export interface MenuVersionCreatedPayload {
  version_id: string;
  version_number: number;
  created_by: string;
  node_count: number;
}
