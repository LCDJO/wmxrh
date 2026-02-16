/**
 * FeatureLifecycleManager — Feature flag registration with lifecycle phases.
 *
 * Extends the Security Kernel's FeatureFlagEngine with lifecycle tracking
 * (alpha → beta → GA → deprecated → sunset) and rollout percentages.
 */

import type {
  FeatureLifecycleAPI,
  FeatureDescriptor,
  FeaturePhase,
  GlobalEventKernelAPI,
} from './types';
import { featureFlagEngine } from '@/domains/security/kernel/feature-flag-engine';

export function createFeatureLifecycleManager(events: GlobalEventKernelAPI): FeatureLifecycleAPI {
  const features = new Map<string, FeatureDescriptor>();

  function register(feature: Omit<FeatureDescriptor, 'toggled_at'>): void {
    features.set(feature.key, { ...feature, toggled_at: null });
    events.emit('feature:registered', 'FeatureLifecycleManager', { key: feature.key, phase: feature.phase });
  }

  function isEnabled(key: string, ctx?: { tenantId?: string }): boolean {
    const descriptor = features.get(key);

    // Check POSL-level descriptor first
    if (descriptor) {
      if (!descriptor.enabled) return false;

      // Rollout check (deterministic hash-based)
      if (descriptor.rollout_pct < 100 && ctx?.tenantId) {
        const hash = simpleHash(`${key}:${ctx.tenantId}`) % 100;
        if (hash >= descriptor.rollout_pct) return false;
      }
    }

    // Delegate to Security Kernel's engine for DB/override resolution
    return featureFlagEngine.isEnabled(key as any, ctx ? { tenantId: ctx.tenantId } : undefined);
  }

  function toggle(key: string, enabled: boolean): void {
    const descriptor = features.get(key);
    if (descriptor) {
      descriptor.enabled = enabled;
      descriptor.toggled_at = Date.now();
      events.emit('feature:toggled', 'FeatureLifecycleManager', { key, enabled });
    }
  }

  function list(): FeatureDescriptor[] {
    return [...features.values()];
  }

  function getPhase(key: string): FeaturePhase | null {
    return features.get(key)?.phase ?? null;
  }

  return { register, isEnabled, toggle, list, getPhase };
}

/** Simple deterministic hash for rollout bucketing */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
