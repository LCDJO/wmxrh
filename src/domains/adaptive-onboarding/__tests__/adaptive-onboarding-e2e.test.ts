/**
 * Adaptive Onboarding Engine — End-to-End Integration Test
 *
 * Validates the FULL lifecycle:
 *   1. Engine instantiation (all sub-systems wired)
 *   2. Flow resolution per plan tier
 *   3. Module wizard & role bootstrapper outputs
 *   4. Tenant setup orchestrator pipeline
 *   5. Progress tracker: init → complete → skip → auto-advance
 *   6. Experience hints per step
 *   7. Security guard (admin-only mutations)
 *   8. Domain events emitted at each lifecycle point
 *   9. Progress cache: write-through → load → TTL → hydration
 *  10. Full flow completion: all steps → 100% → finished event
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createAdaptiveOnboardingEngine } from '../adaptive-onboarding-engine';
import { initializeProgress } from '../onboarding-progress-tracker';
import {
  saveProgressToCache,
  loadProgressFromCache,
  invalidateCache,
  isOnboardingCompleteFromCache,
  isCacheValidForFlow,
  hydrateProgressFromCache,
} from '../onboarding-progress-cache';
import {
  isOnboardingAdmin,
  assertOnboardingAdmin,
  createGuardedProgressTracker,
  OnboardingAuthorizationError,
} from '../onboarding-security-guard';
import type { OnboardingSecurityContext } from '../onboarding-security-guard';
import {
  onOnboardingEvent,
  onOnboardingEventType,
  getOnboardingEventLog,
  clearOnboardingEventLog,
  emitTenantOnboardingStarted,
  emitOnboardingStepCompleted,
  emitOnboardingStepSkipped,
  emitOnboardingFinished,
  emitRoleBootstrapCompleted,
} from '../onboarding.events';
import type {
  AdaptiveOnboardingEngineAPI,
  OnboardingFlow,
  OnboardingProgress,
  FlowResolverContext,
} from '../types';
import type { PlanTier } from '@/domains/platform-experience/types';

// ── Helpers ─────────────────────────────────────────────────────

function makeCtx(tier: PlanTier, modules?: string[], role?: string): FlowResolverContext {
  return { planTier: tier, allowedModules: modules, userRole: role };
}

const ADMIN_CTX: OnboardingSecurityContext = {
  user_id: 'u1',
  tenant_id: 't1',
  effective_roles: ['tenant_admin'],
};

const VIEWER_CTX: OnboardingSecurityContext = {
  user_id: 'u2',
  tenant_id: 't1',
  effective_roles: ['viewer'],
};

// ── Setup ───────────────────────────────────────────────────────

let engine: AdaptiveOnboardingEngineAPI;

beforeEach(() => {
  engine = createAdaptiveOnboardingEngine();
  clearOnboardingEventLog();
  invalidateCache('e2e-tenant');
  localStorage.clear();
});

// ═════════════════════════════════════════════════════════════════
// 1. ENGINE INSTANTIATION
// ═════════════════════════════════════════════════════════════════

describe('1. Engine Instantiation', () => {
  it('creates engine with all sub-systems', () => {
    expect(engine.flowResolver).toBeDefined();
    expect(engine.tenantSetup).toBeDefined();
    expect(engine.roleBootstrapper).toBeDefined();
    expect(engine.moduleWizard).toBeDefined();
    expect(engine.progressTracker).toBeDefined();
    expect(engine.experienceHints).toBeDefined();
  });

  it('each sub-system has expected API methods', () => {
    expect(typeof engine.flowResolver.resolveFlow).toBe('function');
    expect(typeof engine.flowResolver.getNextStep).toBe('function');
    expect(typeof engine.flowResolver.getStepsForPhase).toBe('function');
    expect(typeof engine.tenantSetup.suggestSetup).toBe('function');
    expect(typeof engine.roleBootstrapper.suggestRoles).toBe('function');
    expect(typeof engine.moduleWizard.getAvailableModules).toBe('function');
    expect(typeof engine.moduleWizard.getRecommendedModules).toBe('function');
    expect(typeof engine.progressTracker.getProgress).toBe('function');
    expect(typeof engine.progressTracker.markStepCompleted).toBe('function');
    expect(typeof engine.progressTracker.markStepSkipped).toBe('function');
    expect(typeof engine.experienceHints.getHintsForStep).toBe('function');
    expect(typeof engine.experienceHints.dismissHint).toBe('function');
  });
});

// ═════════════════════════════════════════════════════════════════
// 2. FLOW RESOLUTION PER PLAN TIER
// ═════════════════════════════════════════════════════════════════

describe('2. Flow Resolution', () => {
  it('free tier gets minimal steps (welcome, create_company, roles_basic, add_employees, review)', () => {
    const flow = engine.flowResolver.resolveFlow('t-free', makeCtx('free'));
    expect(flow.plan_tier).toBe('free');
    expect(flow.steps.length).toBeGreaterThanOrEqual(4);
    const ids = flow.steps.map(s => s.id);
    expect(ids).toContain('welcome');
    expect(ids).toContain('create_company');
    expect(ids).toContain('add_employees');
    expect(ids).toContain('review');
    // Should NOT have enterprise-only steps
    expect(ids).not.toContain('setup_company_groups');
    expect(ids).not.toContain('configure_advanced_iam');
    expect(ids).not.toContain('activate_analytics');
  });

  it('professional tier gets compliance and module steps', () => {
    const flow = engine.flowResolver.resolveFlow('t-pro', makeCtx('professional', ['compliance', 'health'], 'tenant_admin'));
    const ids = flow.steps.map(s => s.id);
    expect(ids).toContain('configure_roles');
    expect(ids).toContain('activate_modules');
    expect(ids).toContain('compliance_check');
    expect(ids).toContain('configure_health_programs');
    expect(ids).toContain('invite_users');
  });

  it('enterprise tier includes advanced IAM and analytics', () => {
    const flow = engine.flowResolver.resolveFlow('t-ent', makeCtx('enterprise', ['intelligence', 'compliance', 'health'], 'tenant_admin'));
    const ids = flow.steps.map(s => s.id);
    expect(ids).toContain('setup_company_groups');
    expect(ids).toContain('configure_advanced_iam');
    expect(ids).toContain('activate_analytics');
  });

  it('filters steps by requires_modules', () => {
    // No esocial module → no esocial step
    const flow = engine.flowResolver.resolveFlow('t1', makeCtx('professional', ['compliance'], 'tenant_admin'));
    const ids = flow.steps.map(s => s.id);
    expect(ids).not.toContain('activate_esocial');
  });

  it('filters steps by allowed_roles', () => {
    // 'gestor' role should not see tenant_admin-only steps
    const flow = engine.flowResolver.resolveFlow('t1', makeCtx('enterprise', ['intelligence'], 'gestor'));
    const ids = flow.steps.map(s => s.id);
    expect(ids).not.toContain('setup_company_groups');
    expect(ids).not.toContain('configure_roles');
  });

  it('all steps start as pending', () => {
    const flow = engine.flowResolver.resolveFlow('t1', makeCtx('professional'));
    expect(flow.steps.every(s => s.status === 'pending')).toBe(true);
  });

  it('calculates estimated_total_minutes', () => {
    const flow = engine.flowResolver.resolveFlow('t1', makeCtx('professional'));
    const expected = flow.steps.reduce((s, st) => s + st.estimated_minutes, 0);
    expect(flow.estimated_total_minutes).toBe(expected);
  });

  it('getStepsForPhase returns correct subset', () => {
    const flow = engine.flowResolver.resolveFlow('t1', makeCtx('professional', ['compliance', 'health'], 'tenant_admin'));
    const complianceSteps = engine.flowResolver.getStepsForPhase(flow, 'compliance_check');
    expect(complianceSteps.length).toBeGreaterThanOrEqual(1);
    expect(complianceSteps.every(s => s.phase === 'compliance_check')).toBe(true);
  });

  it('getNextStep returns first pending step with satisfied dependencies', () => {
    const flow = engine.flowResolver.resolveFlow('t1', makeCtx('free'));
    const next = engine.flowResolver.getNextStep(flow);
    expect(next).not.toBeNull();
    expect(next!.id).toBe('welcome');
  });
});

// ═════════════════════════════════════════════════════════════════
// 3. MODULE WIZARD
// ═════════════════════════════════════════════════════════════════

describe('3. Module Wizard', () => {
  it('free tier gets basic modules', () => {
    const mods = engine.moduleWizard.getAvailableModules('free');
    expect(mods.length).toBeGreaterThanOrEqual(3);
    expect(mods.map(m => m.module_key)).toContain('employees');
  });

  it('professional tier includes compliance and health', () => {
    const mods = engine.moduleWizard.getAvailableModules('professional');
    const keys = mods.map(m => m.module_key);
    expect(keys).toContain('compliance');
    expect(keys).toContain('health');
    expect(keys).toContain('esocial');
  });

  it('enterprise tier includes intelligence and audit', () => {
    const mods = engine.moduleWizard.getAvailableModules('enterprise');
    const keys = mods.map(m => m.module_key);
    expect(keys).toContain('workforce_intelligence');
    expect(keys).toContain('audit');
  });

  it('recommended modules are a subset of available', () => {
    const available = engine.moduleWizard.getAvailableModules('professional');
    const recommended = engine.moduleWizard.getRecommendedModules('professional');
    const availableKeys = new Set(available.map(m => m.module_key));
    expect(recommended.every(m => availableKeys.has(m.module_key))).toBe(true);
    expect(recommended.every(m => m.recommended)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════
// 4. ROLE BOOTSTRAPPER
// ═════════════════════════════════════════════════════════════════

describe('4. Role Bootstrapper', () => {
  it('free tier gets basic roles only', () => {
    const plan = engine.roleBootstrapper.suggestRoles('free');
    expect(plan.plan_tier).toBe('free');
    const slugs = plan.roles.map(r => r.slug);
    expect(slugs).toContain('rh');
    expect(slugs).toContain('gestor');
    expect(slugs).not.toContain('rh_manager');
  });

  it('professional tier adds RH Manager and Finance', () => {
    const plan = engine.roleBootstrapper.suggestRoles('professional');
    const slugs = plan.roles.map(r => r.slug);
    expect(slugs).toContain('rh_manager');
    expect(slugs).toContain('finance');
  });

  it('enterprise tier adds HR Admin, Finance Admin, Operations', () => {
    const plan = engine.roleBootstrapper.suggestRoles('enterprise');
    const slugs = plan.roles.map(r => r.slug);
    expect(slugs).toContain('hr_admin');
    expect(slugs).toContain('finance_admin');
    expect(slugs).toContain('operations');
  });

  it('all roles have permissions array', () => {
    const plan = engine.roleBootstrapper.suggestRoles('enterprise');
    for (const role of plan.roles) {
      expect(Array.isArray(role.permissions)).toBe(true);
      expect(role.permissions.length).toBeGreaterThan(0);
    }
  });
});

// ═════════════════════════════════════════════════════════════════
// 5. TENANT SETUP ORCHESTRATOR
// ═════════════════════════════════════════════════════════════════

describe('5. Tenant Setup Orchestrator', () => {
  it('suggests departments based on industry', () => {
    const result = engine.tenantSetup.suggestSetup('professional', {
      tenant_name: 'Test Corp',
      industry: 'healthcare',
    });
    expect(result.departments_suggested).toContain('Assistencial');
    expect(result.compliance_requirements.length).toBeGreaterThan(0);
  });

  it('uses default industry when not specified', () => {
    const result = engine.tenantSetup.suggestSetup('free', { tenant_name: 'X' });
    expect(result.departments_suggested).toContain('Administrativo');
  });
});

// ═════════════════════════════════════════════════════════════════
// 6. PROGRESS TRACKER — FULL LIFECYCLE
// ═════════════════════════════════════════════════════════════════

describe('6. Progress Tracker Lifecycle', () => {
  let flow: OnboardingFlow;
  let progress: OnboardingProgress;
  const TID = 'e2e-tenant';

  beforeEach(() => {
    engine.progressTracker.reset(TID);
    flow = engine.flowResolver.resolveFlow(TID, makeCtx('free'));
    progress = initializeProgress(TID, flow);
  });

  it('initializes with first step active', () => {
    expect(progress.current_step_id).toBe('welcome');
    expect(progress.completed_steps).toHaveLength(0);
    expect(progress.flow.steps[0].status).toBe('active');
  });

  it('markStepCompleted updates progress', () => {
    engine.progressTracker.markStepCompleted(TID, 'welcome');
    const p = engine.progressTracker.getProgress(TID)!;
    expect(p.completed_steps).toContain('welcome');
    expect(p.flow.steps.find(s => s.id === 'welcome')!.status).toBe('completed');
    expect(p.flow.completion_pct).toBeGreaterThan(0);
  });

  it('markStepSkipped updates progress', () => {
    engine.progressTracker.markStepSkipped(TID, 'welcome');
    const p = engine.progressTracker.getProgress(TID)!;
    expect(p.skipped_steps).toContain('welcome');
    expect(p.flow.steps.find(s => s.id === 'welcome')!.status).toBe('skipped');
  });

  it('setCurrentStep changes active step', () => {
    engine.progressTracker.setCurrentStep(TID, 'create_company');
    const p = engine.progressTracker.getProgress(TID)!;
    expect(p.current_step_id).toBe('create_company');
    expect(p.flow.steps.find(s => s.id === 'create_company')!.status).toBe('active');
  });

  it('getNextStep respects dependencies', () => {
    // Before completing welcome, first pending step with no unmet deps
    const next1 = engine.flowResolver.getNextStep(flow);
    expect(next1).not.toBeNull();
    // welcome or review (both have empty depends_on)
    expect(['welcome', 'review']).toContain(next1!.id);

    engine.progressTracker.markStepCompleted(TID, 'welcome');
    const updated = engine.progressTracker.getProgress(TID)!;
    const next2 = engine.flowResolver.getNextStep(updated.flow);
    expect(next2).not.toBeNull();
    // After welcome, create_company or add_employees should be available
    expect(['create_company', 'add_employees', 'configure_roles_basic', 'review']).toContain(next2!.id);
  });

  it('completing all steps reaches 100%', () => {
    const stepIds = flow.steps.map(s => s.id);
    for (const id of stepIds) {
      engine.progressTracker.markStepCompleted(TID, id);
    }
    const final = engine.progressTracker.getProgress(TID)!;
    expect(final.flow.completion_pct).toBe(100);
    expect(final.flow.completed_at).toBeTruthy();
    expect(final.flow.current_phase).toBe('completed');
  });

  it('reset clears all progress', () => {
    engine.progressTracker.markStepCompleted(TID, 'welcome');
    engine.progressTracker.reset(TID);
    expect(engine.progressTracker.getProgress(TID)).toBeNull();
  });

  it('duplicate markStepCompleted is idempotent', () => {
    engine.progressTracker.markStepCompleted(TID, 'welcome');
    engine.progressTracker.markStepCompleted(TID, 'welcome');
    const p = engine.progressTracker.getProgress(TID)!;
    expect(p.completed_steps.filter(s => s === 'welcome')).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════
// 7. EXPERIENCE HINTS
// ═════════════════════════════════════════════════════════════════

describe('7. Experience Hints', () => {
  it('returns hints for welcome step', () => {
    const hints = engine.experienceHints.getHintsForStep('welcome', 'professional');
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0].step_id).toBe('welcome');
  });

  it('returns compliance hints for professional tier', () => {
    const hints = engine.experienceHints.getHintsForStep('compliance_check', 'professional');
    expect(hints.some(h => h.type === 'compliance')).toBe(true);
  });

  it('returns empty for unknown step', () => {
    const hints = engine.experienceHints.getHintsForStep('nonexistent', 'free');
    expect(hints).toHaveLength(0);
  });

  it('dismissHint removes hint from future calls', () => {
    const hints1 = engine.experienceHints.getHintsForStep('welcome', 'free');
    expect(hints1.length).toBeGreaterThan(0);
    engine.experienceHints.dismissHint(hints1[0].id);
    const hints2 = engine.experienceHints.getHintsForStep('welcome', 'free');
    expect(hints2.find(h => h.id === hints1[0].id)).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════
// 8. SECURITY GUARD
// ═════════════════════════════════════════════════════════════════

describe('8. Security Guard', () => {
  it('isOnboardingAdmin returns true for admin roles', () => {
    expect(isOnboardingAdmin(ADMIN_CTX)).toBe(true);
    expect(isOnboardingAdmin({ ...ADMIN_CTX, effective_roles: ['owner'] })).toBe(true);
    expect(isOnboardingAdmin({ ...ADMIN_CTX, effective_roles: ['superadmin'] })).toBe(true);
  });

  it('isOnboardingAdmin returns false for non-admin roles', () => {
    expect(isOnboardingAdmin(VIEWER_CTX)).toBe(false);
    expect(isOnboardingAdmin({ ...VIEWER_CTX, effective_roles: ['rh', 'gestor'] })).toBe(false);
  });

  it('assertOnboardingAdmin throws for non-admin', () => {
    expect(() => assertOnboardingAdmin(VIEWER_CTX, 'test')).toThrow(OnboardingAuthorizationError);
  });

  it('assertOnboardingAdmin passes for admin', () => {
    expect(() => assertOnboardingAdmin(ADMIN_CTX, 'test')).not.toThrow();
  });

  it('guarded tracker blocks non-admin mutations', () => {
    const guarded = createGuardedProgressTracker(engine.progressTracker);
    expect(() => guarded.guarded.markStepCompleted(VIEWER_CTX, 'welcome')).toThrow(OnboardingAuthorizationError);
    expect(() => guarded.guarded.markStepSkipped(VIEWER_CTX, 'welcome')).toThrow(OnboardingAuthorizationError);
    expect(() => guarded.guarded.reset(VIEWER_CTX)).toThrow(OnboardingAuthorizationError);
  });

  it('guarded tracker allows admin mutations', () => {
    const TID = 'guard-test';
    const flow = engine.flowResolver.resolveFlow(TID, makeCtx('free'));
    initializeProgress(TID, flow);
    const guarded = createGuardedProgressTracker(engine.progressTracker);
    const ctx = { ...ADMIN_CTX, tenant_id: TID };
    expect(() => guarded.guarded.markStepCompleted(ctx, 'welcome')).not.toThrow();
  });

  it('guarded tracker allows read-only without guard', () => {
    const guarded = createGuardedProgressTracker(engine.progressTracker);
    // getProgress is not guarded
    expect(() => guarded.getProgress('any-tenant')).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════
// 9. DOMAIN EVENTS
// ═════════════════════════════════════════════════════════════════

describe('9. Domain Events', () => {
  it('emitTenantOnboardingStarted fires and logs', () => {
    const handler = vi.fn();
    const unsub = onOnboardingEventType('TenantOnboardingStarted', handler);

    emitTenantOnboardingStarted('t1', 'u1', { plan_tier: 'professional', total_steps: 10, estimated_minutes: 60 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].type).toBe('TenantOnboardingStarted');
    expect(getOnboardingEventLog().length).toBe(1);
    unsub();
  });

  it('emitOnboardingStepCompleted fires with metadata', () => {
    const handler = vi.fn();
    const unsub = onOnboardingEvent(handler);

    emitOnboardingStepCompleted('t1', 'u1', {
      step_id: 'welcome',
      step_title: 'Bem-vindo',
      phase: 'welcome',
      completion_pct: 20,
      elapsed_ms: 5000,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const evt = handler.mock.calls[0][0];
    expect(evt.metadata.step_id).toBe('welcome');
    unsub();
  });

  it('emitOnboardingStepSkipped fires correctly', () => {
    const handler = vi.fn();
    const unsub = onOnboardingEventType('OnboardingStepSkipped', handler);

    emitOnboardingStepSkipped('t1', 'u1', {
      step_id: 'invite_users',
      step_title: 'Convidar',
      phase: 'team_invite',
      completion_pct: 50,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('emitOnboardingFinished fires with summary', () => {
    const handler = vi.fn();
    const unsub = onOnboardingEventType('OnboardingFinished', handler);

    emitOnboardingFinished('t1', 'u1', {
      total_steps: 8,
      completed_steps: 6,
      skipped_steps: 2,
      total_elapsed_ms: 120000,
      plan_tier: 'professional',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].metadata.completed_steps).toBe(6);
    unsub();
  });

  it('emitRoleBootstrapCompleted fires with roles', () => {
    const handler = vi.fn();
    const unsub = onOnboardingEventType('RoleBootstrapCompleted', handler);

    emitRoleBootstrapCompleted('t1', 'u1', { roles_created: ['rh', 'gestor'], plan_tier: 'free' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].metadata.roles_created).toEqual(['rh', 'gestor']);
    unsub();
  });

  it('global listener receives all event types', () => {
    const handler = vi.fn();
    const unsub = onOnboardingEvent(handler);

    emitTenantOnboardingStarted('t1', 'u1', { plan_tier: 'free', total_steps: 3, estimated_minutes: 10 });
    emitOnboardingStepCompleted('t1', 'u1', { step_id: 'x', step_title: 'X', phase: 'welcome', completion_pct: 50, elapsed_ms: 1000 });
    emitOnboardingFinished('t1', 'u1', { total_steps: 3, completed_steps: 3, skipped_steps: 0, total_elapsed_ms: 5000, plan_tier: 'free' });

    expect(handler).toHaveBeenCalledTimes(3);
    unsub();
  });

  it('clearOnboardingEventLog empties log', () => {
    emitTenantOnboardingStarted('t1', 'u1', { plan_tier: 'free', total_steps: 1, estimated_minutes: 1 });
    expect(getOnboardingEventLog().length).toBe(1);
    clearOnboardingEventLog();
    expect(getOnboardingEventLog().length).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════
// 10. PROGRESS CACHE
// ═════════════════════════════════════════════════════════════════

describe('10. Progress Cache', () => {
  const TID = 'cache-test';

  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and loads progress snapshot', () => {
    const flow = engine.flowResolver.resolveFlow(TID, makeCtx('free'));
    const progress = initializeProgress(TID, flow);
    saveProgressToCache(progress);
    const loaded = loadProgressFromCache(TID);
    expect(loaded).not.toBeNull();
    expect(loaded!.tenant_id).toBe(TID);
    expect(loaded!.completion_pct).toBe(0);
  });

  it('isOnboardingCompleteFromCache returns null on miss', () => {
    expect(isOnboardingCompleteFromCache('nonexistent')).toBeNull();
  });

  it('isOnboardingCompleteFromCache returns false for in-progress', () => {
    const flow = engine.flowResolver.resolveFlow(TID, makeCtx('free'));
    const progress = initializeProgress(TID, flow);
    saveProgressToCache(progress);
    expect(isOnboardingCompleteFromCache(TID)).toBe(false);
  });

  it('isOnboardingCompleteFromCache returns true for completed', () => {
    const flow = engine.flowResolver.resolveFlow(TID, makeCtx('free'));
    const progress = initializeProgress(TID, flow);
    // Complete all steps
    for (const step of flow.steps) {
      engine.progressTracker.markStepCompleted(TID, step.id);
    }
    const final = engine.progressTracker.getProgress(TID)!;
    saveProgressToCache(final);
    expect(isOnboardingCompleteFromCache(TID)).toBe(true);
  });

  it('invalidateCache removes cached data', () => {
    const flow = engine.flowResolver.resolveFlow(TID, makeCtx('free'));
    const progress = initializeProgress(TID, flow);
    saveProgressToCache(progress);
    invalidateCache(TID);
    expect(loadProgressFromCache(TID)).toBeNull();
  });

  it('isCacheValidForFlow detects step count mismatch', () => {
    const flow1 = engine.flowResolver.resolveFlow(TID, makeCtx('free'));
    const progress = initializeProgress(TID, flow1);
    saveProgressToCache(progress);

    // A different flow with different step count
    const flow2 = engine.flowResolver.resolveFlow(TID, makeCtx('enterprise', ['intelligence', 'compliance', 'health'], 'tenant_admin'));
    expect(isCacheValidForFlow(TID, flow2)).toBe(false);
  });

  it('hydrateProgressFromCache restores step statuses', () => {
    const flow = engine.flowResolver.resolveFlow(TID, makeCtx('free'));
    const progress = initializeProgress(TID, flow);
    engine.progressTracker.markStepCompleted(TID, 'welcome');
    const updated = engine.progressTracker.getProgress(TID)!;
    saveProgressToCache(updated);

    const snapshot = loadProgressFromCache(TID)!;
    const freshFlow = engine.flowResolver.resolveFlow(TID, makeCtx('free'));
    const hydrated = hydrateProgressFromCache(snapshot, freshFlow);

    expect(hydrated.completed_steps).toContain('welcome');
    expect(freshFlow.steps.find(s => s.id === 'welcome')!.status).toBe('completed');
  });
});

// ═════════════════════════════════════════════════════════════════
// 11. FULL E2E LIFECYCLE SIMULATION
// ═════════════════════════════════════════════════════════════════

describe('11. Full E2E Lifecycle', () => {
  it('simulates complete onboarding journey with events', () => {
    const TID = 'e2e-full';
    const UID = 'admin-user';
    const events: string[] = [];
    const unsub = onOnboardingEvent(e => events.push(e.type));

    // ── Step 1: Resolve flow ──
    const flow = engine.flowResolver.resolveFlow(TID, makeCtx('professional', ['compliance', 'health'], 'tenant_admin'));
    expect(flow.steps.length).toBeGreaterThan(5);
    expect(flow.completion_pct).toBe(0);

    // ── Step 2: Initialize progress ──
    const progress = initializeProgress(TID, flow);
    expect(progress.current_step_id).toBe('welcome');

    // ── Step 3: Emit start event ──
    emitTenantOnboardingStarted(TID, UID, {
      plan_tier: 'professional',
      total_steps: flow.steps.length,
      estimated_minutes: flow.estimated_total_minutes,
    });

    // ── Step 4: Bootstrap roles ──
    const roles = engine.roleBootstrapper.suggestRoles('professional');
    emitRoleBootstrapCompleted(TID, UID, {
      roles_created: roles.roles.map(r => r.slug),
      plan_tier: 'professional',
    });

    // ── Step 5: Complete all steps sequentially with security check ──
    const secCtx: OnboardingSecurityContext = { user_id: UID, tenant_id: TID, effective_roles: ['tenant_admin'] };
    expect(isOnboardingAdmin(secCtx)).toBe(true);

    for (const step of flow.steps) {
      engine.progressTracker.markStepCompleted(TID, step.id);
      const p = engine.progressTracker.getProgress(TID)!;

      emitOnboardingStepCompleted(TID, UID, {
        step_id: step.id,
        step_title: step.title,
        phase: step.phase,
        completion_pct: p.flow.completion_pct,
        elapsed_ms: 1000,
      });

      // Save to cache after each step
      saveProgressToCache(p);

      // Auto-advance
      const next = engine.flowResolver.getNextStep(p.flow);
      if (next) {
        engine.progressTracker.setCurrentStep(TID, next.id);
      }
    }

    // ── Step 6: Verify completion ──
    const finalProgress = engine.progressTracker.getProgress(TID)!;
    expect(finalProgress.flow.completion_pct).toBe(100);
    expect(finalProgress.flow.completed_at).toBeTruthy();

    // ── Step 7: Emit finish event ──
    emitOnboardingFinished(TID, UID, {
      total_steps: flow.steps.length,
      completed_steps: finalProgress.completed_steps.length,
      skipped_steps: 0,
      total_elapsed_ms: 60000,
      plan_tier: 'professional',
    });

    // ── Step 8: Verify cache ──
    expect(isOnboardingCompleteFromCache(TID)).toBe(true);

    // ── Step 9: Verify events ──
    expect(events).toContain('TenantOnboardingStarted');
    expect(events).toContain('RoleBootstrapCompleted');
    expect(events.filter(e => e === 'OnboardingStepCompleted').length).toBe(flow.steps.length);
    expect(events).toContain('OnboardingFinished');

    unsub();
  });

  it('simulates journey with skipped optional steps', () => {
    const TID = 'e2e-skip';
    const flow = engine.flowResolver.resolveFlow(TID, makeCtx('professional', ['compliance', 'health'], 'tenant_admin'));
    initializeProgress(TID, flow);

    const optionalSteps = flow.steps.filter(s => !s.is_mandatory);
    const mandatorySteps = flow.steps.filter(s => s.is_mandatory);

    // Complete mandatory, skip optional
    for (const step of mandatorySteps) {
      engine.progressTracker.markStepCompleted(TID, step.id);
    }
    for (const step of optionalSteps) {
      engine.progressTracker.markStepSkipped(TID, step.id);
    }

    const final = engine.progressTracker.getProgress(TID)!;
    expect(final.flow.completion_pct).toBe(100);
    expect(final.completed_steps.length).toBe(mandatorySteps.length);
    expect(final.skipped_steps.length).toBe(optionalSteps.length);
  });

  it('non-admin cannot complete steps (security integration)', () => {
    const TID = 'e2e-sec';
    const flow = engine.flowResolver.resolveFlow(TID, makeCtx('free'));
    initializeProgress(TID, flow);

    const guarded = createGuardedProgressTracker(engine.progressTracker);
    const viewerCtx: OnboardingSecurityContext = { user_id: 'viewer', tenant_id: TID, effective_roles: ['gestor'] };

    expect(() => guarded.guarded.markStepCompleted(viewerCtx, 'welcome')).toThrow(OnboardingAuthorizationError);

    // Verify progress unchanged
    const p = engine.progressTracker.getProgress(TID)!;
    expect(p.completed_steps).toHaveLength(0);
  });
});
