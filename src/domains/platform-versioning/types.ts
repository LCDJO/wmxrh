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
export interface PlatformVersion {
  id: string;
  version: SemanticVersion;
  label: string;             // e.g. "v3.2.0 — Titan"
  codename?: string;
  status: ReleaseStatus;
  release_id?: string;       // linked Release
  changelog_entries: string[];
  created_at: string;
  created_by: string;
  published_at?: string;
  rollback_from?: string;    // version id it rolled back from
}

// ── Module Version ──
export interface ModuleVersion {
  id: string;
  module_key: string;
  version: SemanticVersion;
  status: ReleaseStatus;
  min_platform_version?: SemanticVersion;
  dependencies: ModuleDependency[];
  changelog_entries: string[];
  breaking_changes: string[];
  migration_notes?: string;
  created_at: string;
  created_by: string;
  published_at?: string;
}

export interface ModuleDependency {
  module_key: string;
  min_version: SemanticVersion;
  max_version?: SemanticVersion;
  optional: boolean;
}

// ── Changelog ──
export type ChangeCategory = 'feature' | 'fix' | 'improvement' | 'breaking' | 'deprecation' | 'security' | 'performance' | 'docs';

export interface ChangeLogEntry {
  id: string;
  category: ChangeCategory;
  scope: 'platform' | 'module';
  scope_key?: string;        // module_key if scope=module
  title: string;
  description: string;
  author: string;
  linked_version_id?: string;
  linked_release_id?: string;
  tags: string[];
  created_at: string;
}

// ── Release ──
export type ReleaseStatus = 'draft' | 'staging' | 'canary' | 'published' | 'rolled_back' | 'archived';

export interface Release {
  id: string;
  name: string;              // e.g. "Sprint 42 Release"
  status: ReleaseStatus;
  platform_version_id?: string;
  module_versions: string[]; // ModuleVersion ids
  changelog_entries: string[];
  dependency_snapshot: DependencySnapshot;
  pre_checks: PreReleaseCheck[];
  approved_by?: string;
  approved_at?: string;
  published_at?: string;
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
