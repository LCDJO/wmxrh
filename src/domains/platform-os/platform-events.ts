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
