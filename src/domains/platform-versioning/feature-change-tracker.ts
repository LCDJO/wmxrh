/**
 * FeatureChangeTracker — Records feature-level mutations across versions.
 */
import type { FeatureChange } from './types';
import { versionId } from './version-utils';

export class FeatureChangeTracker {
  private changes: FeatureChange[] = [];

  track(opts: {
    feature_key: string;
    change_type: FeatureChange['change_type'];
    previous_state?: Record<string, unknown>;
    new_state: Record<string, unknown>;
    module_key?: string;
    version_id?: string;
    author: string;
  }): FeatureChange {
    const change: FeatureChange = {
      id: versionId(),
      feature_key: opts.feature_key,
      change_type: opts.change_type,
      previous_state: opts.previous_state,
      new_state: opts.new_state,
      module_key: opts.module_key,
      version_id: opts.version_id,
      author: opts.author,
      created_at: new Date().toISOString(),
    };
    this.changes.push(change);
    return change;
  }

  getByFeature(featureKey: string): FeatureChange[] {
    return this.changes.filter(c => c.feature_key === featureKey);
  }

  getByModule(moduleKey: string): FeatureChange[] {
    return this.changes.filter(c => c.module_key === moduleKey);
  }

  getByVersion(versionId: string): FeatureChange[] {
    return this.changes.filter(c => c.version_id === versionId);
  }

  getAll(): FeatureChange[] {
    return [...this.changes];
  }
}
