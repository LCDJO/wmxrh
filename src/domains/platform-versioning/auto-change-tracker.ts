/**
 * AutoChangeTracker — Automatically logs changes to key platform entities
 * into the PlatformChangeLog via the ChangeLogger.
 *
 * Tracked entities:
 *  1. Landing Pages
 *  2. Website Pages
 *  3. Plans & Billing
 *  4. Roles & Permissions
 *  5. Automation Rules
 *  6. Growth Experiments
 *  7. Module Lifecycle
 */

import type { ChangeType } from './types';
import type { ChangeLogger } from './change-logger';

// ── Tracked entity definitions ──

export type TrackedEntityType =
  | 'landing_page'
  | 'website_page'
  | 'plan'
  | 'billing_adjustment'
  | 'role'
  | 'permission'
  | 'automation_rule'
  | 'growth_experiment'
  | 'module';

interface TrackOpts {
  module_id?: string;
  entity_type: TrackedEntityType;
  entity_id: string;
  change_type: ChangeType;
  version_tag: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changed_by: string;
}

export class AutoChangeTracker {
  constructor(private logger: ChangeLogger) {}

  /** Generic track — works for any tracked entity */
  track(opts: TrackOpts): void {
    this.logger.log({
      module_id: opts.module_id,
      entity_type: opts.entity_type,
      entity_id: opts.entity_id,
      change_type: opts.change_type,
      version_tag: opts.version_tag,
      payload_diff: {
        before: opts.before ?? null,
        after: opts.after ?? null,
      },
      changed_by: opts.changed_by,
    });
  }

  // ── Convenience methods per entity ──

  trackLandingPage(entityId: string, changeType: ChangeType, changedBy: string, versionTag: string, before?: Record<string, unknown>, after?: Record<string, unknown>) {
    this.track({ module_id: 'landing_engine', entity_type: 'landing_page', entity_id: entityId, change_type: changeType, version_tag: versionTag, before, after, changed_by: changedBy });
  }

  trackWebsitePage(entityId: string, changeType: ChangeType, changedBy: string, versionTag: string, before?: Record<string, unknown>, after?: Record<string, unknown>) {
    this.track({ module_id: 'website_engine', entity_type: 'website_page', entity_id: entityId, change_type: changeType, version_tag: versionTag, before, after, changed_by: changedBy });
  }

  trackPlan(entityId: string, changeType: ChangeType, changedBy: string, versionTag: string, before?: Record<string, unknown>, after?: Record<string, unknown>) {
    this.track({ module_id: 'billing', entity_type: 'plan', entity_id: entityId, change_type: changeType, version_tag: versionTag, before, after, changed_by: changedBy });
  }

  trackBillingAdjustment(entityId: string, changeType: ChangeType, changedBy: string, versionTag: string, before?: Record<string, unknown>, after?: Record<string, unknown>) {
    this.track({ module_id: 'billing', entity_type: 'billing_adjustment', entity_id: entityId, change_type: changeType, version_tag: versionTag, before, after, changed_by: changedBy });
  }

  trackRole(entityId: string, changeType: ChangeType, changedBy: string, versionTag: string, before?: Record<string, unknown>, after?: Record<string, unknown>) {
    this.track({ module_id: 'iam', entity_type: 'role', entity_id: entityId, change_type: changeType, version_tag: versionTag, before, after, changed_by: changedBy });
  }

  trackPermission(entityId: string, changeType: ChangeType, changedBy: string, versionTag: string, before?: Record<string, unknown>, after?: Record<string, unknown>) {
    this.track({ module_id: 'iam', entity_type: 'permission', entity_id: entityId, change_type: changeType, version_tag: versionTag, before, after, changed_by: changedBy });
  }

  trackAutomationRule(entityId: string, changeType: ChangeType, changedBy: string, versionTag: string, before?: Record<string, unknown>, after?: Record<string, unknown>) {
    this.track({ module_id: 'automation', entity_type: 'automation_rule', entity_id: entityId, change_type: changeType, version_tag: versionTag, before, after, changed_by: changedBy });
  }

  trackGrowthExperiment(entityId: string, changeType: ChangeType, changedBy: string, versionTag: string, before?: Record<string, unknown>, after?: Record<string, unknown>) {
    this.track({ module_id: 'growth', entity_type: 'growth_experiment', entity_id: entityId, change_type: changeType, version_tag: versionTag, before, after, changed_by: changedBy });
  }

  trackModuleLifecycle(moduleId: string, changeType: ChangeType, changedBy: string, versionTag: string, before?: Record<string, unknown>, after?: Record<string, unknown>) {
    this.track({ entity_type: 'module', entity_id: moduleId, change_type: changeType, version_tag: versionTag, before, after, changed_by: changedBy });
  }

  // ── Query helpers ──

  getByEntity(entityType: TrackedEntityType, entityId?: string) {
    return this.logger.getByEntity(entityType, entityId);
  }

  getByModule(moduleId: string) {
    return this.logger.getByModule(moduleId);
  }

  getHistory(entityType: TrackedEntityType, entityId: string, limit = 50) {
    return this.logger
      .getByEntity(entityType, entityId)
      .reverse()
      .slice(0, limit);
  }
}
