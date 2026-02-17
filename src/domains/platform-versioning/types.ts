/**
 * Advanced Platform & Module Versioning Engine — Types
 *
 * Enterprise Release Governance for modular SaaS platforms.
 */

// ── Semantic Versioning ──
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;       // e.g. 'beta.1'
  build?: string;            // e.g. '20260217'
}

// ── Platform Version ──
export type PlatformReleaseType = 'feature' | 'fix' | 'security' | 'improvement';

export interface PlatformVersion {
  id: string;
  version: SemanticVersion;
  version_tag: string;                // "vMAJOR.MINOR.PATCH"
  title: string;
  description: string;
  release_type: PlatformReleaseType;
  modules_included: string[];         // module keys included in this version
  status: ReleaseStatus;
  release_id?: string;                // linked Release
  changelog_entries: string[];
  released_by: string;
  released_at: string | null;
  created_at: string;
  rollback_from?: string;
}

// ── Module Version ──
export type ModuleVersionStatus = 'draft' | 'released' | 'deprecated';

export interface ModuleVersion {
  id: string;
  module_id: string;
  version: SemanticVersion;
  version_tag: string;               // "vMAJOR.MINOR.PATCH"
  status: ModuleVersionStatus;
  breaking_changes: boolean;
  dependencies: ModuleDependency[];
  changelog_summary: string;
  released_at: string | null;
  created_at: string;
  created_by: string;
}

export interface ModuleDependency {
  module_id: string;
  required_module_id: string;
  required_version: SemanticVersion;
  is_mandatory?: boolean;       // default true — blocks publish if unmet
  compatibility_note?: string;  // e.g. "GrowthEngine v2.0 requer BillingCore >= v1.5"
}

// ── Changelog ──
export type ChangeCategory = 'feature' | 'fix' | 'improvement' | 'breaking' | 'deprecation' | 'security' | 'performance' | 'docs';
export type ChangeType = 'created' | 'updated' | 'deleted' | 'published' | 'rolled_back' | 'deprecated' | 'activated' | 'deactivated';

export interface PlatformChangeLog {
  id: string;
  module_id?: string;          // optional — null = platform-level change
  entity_type: string;         // e.g. 'landing_page', 'module', 'release', 'feature_flag'
  entity_id: string;
  change_type: ChangeType;
  version_tag: string;         // "vMAJOR.MINOR.PATCH" at time of change
  payload_diff: Record<string, unknown>;  // { before: ..., after: ... }
  changed_by: string;
  changed_at: string;
}

/** @deprecated Use PlatformChangeLog instead */
export interface ChangeLogEntry {
  id: string;
  category: ChangeCategory;
  scope: 'platform' | 'module';
  scope_key?: string;
  title: string;
  description: string;
  author: string;
  linked_version_id?: string;
  linked_release_id?: string;
  tags: string[];
  created_at: string;
}

// ── Release ──
export type ReleaseStatus = 'draft' | 'candidate' | 'final' | 'rolled_back' | 'archived';

export interface Release {
  id: string;
  name: string;                        // e.g. "Sprint 42 Release"
  status: ReleaseStatus;
  platform_version_id: string | null;  // linked PlatformVersion
  module_versions: string[];           // ModuleVersion ids grouped in this release
  changelog_entries: string[];
  dependency_snapshot: DependencySnapshot;
  pre_checks: PreReleaseCheck[];
  promoted_to_candidate_by?: string;
  promoted_to_candidate_at?: string;
  finalized_by?: string;
  finalized_at?: string;
  rolled_back_at?: string;
  rollback_reason?: string;
  created_at: string;
  created_by: string;
}

export interface PreReleaseCheck {
  name: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  message?: string;
  checked_at?: string;
}

// ── Dependency Snapshot ──
export interface DependencySnapshot {
  timestamp: string;
  modules: Array<{
    module_key: string;
    version: SemanticVersion;
    dependencies: ModuleDependency[];
  }>;
  conflicts: DependencyConflict[];
}

export interface DependencyConflict {
  module_key: string;
  required_by: string;
  required_version: SemanticVersion;
  actual_version: SemanticVersion;
  severity: 'warning' | 'error';
}

// ── Feature Change ──
export interface FeatureChange {
  id: string;
  feature_key: string;
  change_type: 'added' | 'modified' | 'removed' | 'phase_transition';
  previous_state?: Record<string, unknown>;
  new_state: Record<string, unknown>;
  module_key?: string;
  version_id?: string;
  author: string;
  created_at: string;
}

// ── Rollback ──
export interface RollbackPlan {
  id: string;
  release_id: string;
  target_release_id: string;  // rollback TO
  modules_affected: string[];
  dependency_safe: boolean;
  breaking_rollback: boolean;
  steps: RollbackStep[];
  created_at: string;
  created_by: string;
}

export interface RollbackStep {
  order: number;
  action: 'deactivate_module' | 'downgrade_module' | 'restore_platform_version' | 'run_migration' | 'notify';
  target: string;
  from_version?: SemanticVersion;
  to_version?: SemanticVersion;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
}
