/**
 * FeatureLifecycleManager — Feature flag registration with lifecycle phases.
 *
 * Manages three categories of features:
 *
 *   1. Feature Flags      — simple on/off toggles with rollout %
 *   2. Beta Features      — phase = 'experimental' | 'alpha' | 'beta'
 *   3. Módulos experimentais — tied to a module key, phase-gated
 *
 * Lifecycle:  experimental → alpha → beta → active/ga → deprecated → sunset
 *
 * Extends the Security Kernel's FeatureFlagEngine with lifecycle tracking,
 * tenant scoping, phase transitions, and sunset auto-disable.
 */

import type {
  FeatureLifecycleAPI,
  FeatureDescriptor,
  FeaturePhase,
  GlobalEventKernelAPI,
} from './types';
import { featureFlagEngine } from '@/domains/security/kernel/feature-flag-engine';
import { PLATFORM_EVENTS } from './platform-events';
import type { FeatureLifecycleChangedPayload } from './platform-events';

// ════════════════════════════════════
// Phase transition rules (valid edges)
// ════════════════════════════════════

const PHASE_ORDER: Record<FeaturePhase, number> = {
  experimental: 0,
  alpha: 1,
  beta: 2,
  active: 3,
  ga: 3, // alias for active
  deprecated: 4,
  sunset: 5,
};

/** Allowed forward transitions (backward allowed only for deprecated→active) */
function isValidTransition(from: FeaturePhase, to: FeaturePhase): boolean {
  if (from === to) return false;
  // Allow un-deprecate back to active/ga
  if (from === 'deprecated' && (to === 'active' || to === 'ga')) return true;
  return PHASE_ORDER[to] > PHASE_ORDER[from];
}

// ════════════════════════════════════
// Factory
// ════════════════════════════════════

export function createFeatureLifecycleManager(events: GlobalEventKernelAPI): FeatureLifecycleAPI {
  const features = new Map<string, FeatureDescriptor>();

  // ── Registration ──────────────────────────────────────────

  function register(
    feature: Omit<FeatureDescriptor, 'toggled_at' | 'phase_changed_at' | 'previous_phase'>,
  ): void {
    features.set(feature.key, {
      ...feature,
      allowed_tenants: feature.allowed_tenants ?? [],
      denied_tenants: feature.denied_tenants ?? [],
      sunset_at: feature.sunset_at ?? null,
      toggled_at: null,
      phase_changed_at: null,
      previous_phase: null,
    });
    events.emit('feature:registered', 'FeatureLifecycleManager', {
      key: feature.key,
      phase: feature.phase,
      module: feature.module ?? null,
    });
    events.emit<FeatureLifecycleChangedPayload>(
      PLATFORM_EVENTS.FeatureLifecycleChanged,
      'FeatureLifecycleManager',
      { key: feature.key, change: 'registered', enabled: feature.enabled, phase: feature.phase },
    );
  }

  // ── Query ─────────────────────────────────────────────────

  function isEnabled(key: string, ctx?: { tenantId?: string }): boolean {
    const descriptor = features.get(key);
    if (!descriptor) {
      // Fallback to Security Kernel for unknown features
      return featureFlagEngine.isEnabled(key as any, ctx ? { tenantId: ctx.tenantId } : undefined);
    }

    // Sunset auto-disable
    if (descriptor.sunset_at && Date.now() >= descriptor.sunset_at) return false;

    // Phase gate — sunset/deprecated = disabled
    if (descriptor.phase === 'sunset') return false;
    if (descriptor.phase === 'deprecated' && !descriptor.enabled) return false;

    if (!descriptor.enabled) return false;

    // Tenant scoping
    if (ctx?.tenantId) {
      if (descriptor.denied_tenants.includes(ctx.tenantId)) return false;
      if (descriptor.allowed_tenants.length > 0 && !descriptor.allowed_tenants.includes(ctx.tenantId)) {
        return false;
      }
    }

    // Rollout check (deterministic hash-based)
    if (descriptor.rollout_pct < 100 && ctx?.tenantId) {
      const hash = simpleHash(`${key}:${ctx.tenantId}`) % 100;
      if (hash >= descriptor.rollout_pct) return false;
    }

    // Delegate to Security Kernel for final resolution
    return featureFlagEngine.isEnabled(key as any, ctx ? { tenantId: ctx.tenantId } : undefined);
  }

  // ── Mutations ─────────────────────────────────────────────

  function toggle(key: string, enabled: boolean): void {
    const descriptor = features.get(key);
    if (!descriptor) return;

    descriptor.enabled = enabled;
    descriptor.toggled_at = Date.now();
    events.emit('feature:toggled', 'FeatureLifecycleManager', { key, enabled, phase: descriptor.phase });
    events.emit<FeatureLifecycleChangedPayload>(
      PLATFORM_EVENTS.FeatureLifecycleChanged,
      'FeatureLifecycleManager',
      { key, change: 'toggled', enabled, phase: descriptor.phase },
    );
  }

  function transitionPhase(key: string, newPhase: FeaturePhase): void {
    const descriptor = features.get(key);
    if (!descriptor) return;

    if (!isValidTransition(descriptor.phase, newPhase)) {
      events.emit('feature:transition_rejected', 'FeatureLifecycleManager', {
        key,
        from: descriptor.phase,
        to: newPhase,
        reason: 'invalid_transition',
      });
      return;
    }

    const previousPhase = descriptor.phase;
    descriptor.previous_phase = previousPhase;
    descriptor.phase = newPhase;
    descriptor.phase_changed_at = Date.now();

    // Auto-disable on sunset
    if (newPhase === 'sunset') {
      descriptor.enabled = false;
      descriptor.toggled_at = Date.now();
    }

    events.emit('feature:phase_transitioned', 'FeatureLifecycleManager', {
      key,
      from: previousPhase,
      to: newPhase,
      module: descriptor.module ?? null,
    });
    events.emit<FeatureLifecycleChangedPayload>(
      PLATFORM_EVENTS.FeatureLifecycleChanged,
      'FeatureLifecycleManager',
      { key, change: 'phase_transitioned', phase: newPhase, previous_phase: previousPhase },
    );
  }

  // ── List / Filter ─────────────────────────────────────────

  function list(filter?: { phase?: FeaturePhase; module?: string; enabledOnly?: boolean }): FeatureDescriptor[] {
    let result = [...features.values()];
    if (filter?.phase) result = result.filter(f => f.phase === filter.phase);
    if (filter?.module) result = result.filter(f => f.module === filter.module);
    if (filter?.enabledOnly) result = result.filter(f => f.enabled);
    return result;
  }

  function getPhase(key: string): FeaturePhase | null {
    return features.get(key)?.phase ?? null;
  }

  function get(key: string): FeatureDescriptor | null {
    return features.get(key) ?? null;
  }

  function listSunsetting(): FeatureDescriptor[] {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return [...features.values()].filter(f =>
      f.phase === 'deprecated' ||
      (f.sunset_at !== null && f.sunset_at - now < thirtyDays && f.sunset_at > now),
    );
  }

  // ── Tenant scoping ────────────────────────────────────────

  function enableForTenant(key: string, tenantId: string): void {
    const descriptor = features.get(key);
    if (!descriptor) return;

    descriptor.denied_tenants = descriptor.denied_tenants.filter(t => t !== tenantId);
    if (descriptor.allowed_tenants.length > 0 && !descriptor.allowed_tenants.includes(tenantId)) {
      descriptor.allowed_tenants.push(tenantId);
    }
    events.emit('feature:tenant_enabled', 'FeatureLifecycleManager', { key, tenantId });
  }

  function disableForTenant(key: string, tenantId: string): void {
    const descriptor = features.get(key);
    if (!descriptor) return;

    if (!descriptor.denied_tenants.includes(tenantId)) {
      descriptor.denied_tenants.push(tenantId);
    }
    descriptor.allowed_tenants = descriptor.allowed_tenants.filter(t => t !== tenantId);
    events.emit('feature:tenant_disabled', 'FeatureLifecycleManager', { key, tenantId });
  }

  // ── Listen for module deactivation → auto-disable features ──

  events.on('module:deactivated', (evt) => {
    const moduleKey = (evt.payload as { key: string }).key;
    for (const f of features.values()) {
      if (f.module === moduleKey && f.enabled) {
        f.enabled = false;
        f.toggled_at = Date.now();
        events.emit('feature:auto_disabled', 'FeatureLifecycleManager', {
          key: f.key,
          reason: 'module_deactivated',
          module: moduleKey,
        });
      }
    }
  });

  return {
    register,
    isEnabled,
    toggle,
    transitionPhase,
    list,
    getPhase,
    get,
    listSunsetting,
    enableForTenant,
    disableForTenant,
  };
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
