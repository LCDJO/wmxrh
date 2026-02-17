/**
 * Tests for:
 *   10) Security — only TenantAdmin can complete onboarding
 *   11) Events — domain events emitted during onboarding lifecycle
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isOnboardingAdmin,
  assertOnboardingAdmin,
  createGuardedProgressTracker,
  OnboardingAuthorizationError,
  type OnboardingSecurityContext,
} from '../onboarding-security-guard';
import {
  emitTenantOnboardingStarted,
  emitOnboardingStepCompleted,
  emitOnboardingStepSkipped,
  emitOnboardingFinished,
  emitRoleBootstrapCompleted,
  onOnboardingEvent,
  onOnboardingEventType,
  getOnboardingEventLog,
  clearOnboardingEventLog,
  type OnboardingDomainEvent,
} from '../onboarding.events';
import { createOnboardingProgressTracker, initializeProgress } from '../onboarding-progress-tracker';
import { createOnboardingFlowResolver } from '../onboarding-flow-resolver';
import type { FlowResolverContext } from '../types';

// ═══════════════════════════════════════════════════════════════
// 10) SECURITY
// ═══════════════════════════════════════════════════════════════

describe('Onboarding Security Guard', () => {
  const adminCtx: OnboardingSecurityContext = {
    user_id: 'user_1',
    tenant_id: 'tenant_1',
    effective_roles: ['tenant_admin'],
  };

  const ownerCtx: OnboardingSecurityContext = {
    user_id: 'user_2',
    tenant_id: 'tenant_1',
    effective_roles: ['owner'],
  };

  const managerCtx: OnboardingSecurityContext = {
    user_id: 'user_3',
    tenant_id: 'tenant_1',
    effective_roles: ['manager', 'hr_analyst'],
  };

  const employeeCtx: OnboardingSecurityContext = {
    user_id: 'user_4',
    tenant_id: 'tenant_1',
    effective_roles: ['employee'],
  };

  const noRolesCtx: OnboardingSecurityContext = {
    user_id: 'user_5',
    tenant_id: 'tenant_1',
    effective_roles: [],
  };

  // ── isOnboardingAdmin ──

  describe('isOnboardingAdmin', () => {
    it('allows tenant_admin', () => {
      expect(isOnboardingAdmin(adminCtx)).toBe(true);
    });

    it('allows owner', () => {
      expect(isOnboardingAdmin(ownerCtx)).toBe(true);
    });

    it('allows admin role', () => {
      expect(isOnboardingAdmin({ ...adminCtx, effective_roles: ['admin'] })).toBe(true);
    });

    it('allows superadmin', () => {
      expect(isOnboardingAdmin({ ...adminCtx, effective_roles: ['superadmin'] })).toBe(true);
    });

    it('denies manager', () => {
      expect(isOnboardingAdmin(managerCtx)).toBe(false);
    });

    it('denies employee', () => {
      expect(isOnboardingAdmin(employeeCtx)).toBe(false);
    });

    it('denies empty roles', () => {
      expect(isOnboardingAdmin(noRolesCtx)).toBe(false);
    });
  });

  // ── assertOnboardingAdmin ──

  describe('assertOnboardingAdmin', () => {
    it('does not throw for tenant_admin', () => {
      expect(() => assertOnboardingAdmin(adminCtx, 'test')).not.toThrow();
    });

    it('throws OnboardingAuthorizationError for non-admin', () => {
      expect(() => assertOnboardingAdmin(managerCtx, 'completeStep')).toThrow(OnboardingAuthorizationError);
    });

    it('error contains action, user_id, tenant_id', () => {
      try {
        assertOnboardingAdmin(employeeCtx, 'markStepCompleted');
      } catch (e) {
        const err = e as OnboardingAuthorizationError;
        expect(err.action).toBe('markStepCompleted');
        expect(err.user_id).toBe('user_4');
        expect(err.tenant_id).toBe('tenant_1');
        expect(err.code).toBe('ONBOARDING_UNAUTHORIZED');
        expect(err.required_roles).toContain('tenant_admin');
      }
    });
  });

  // ── Guarded Progress Tracker ──

  describe('createGuardedProgressTracker', () => {
    const TENANT = 'guard_tenant';

    beforeEach(() => {
      const resolver = createOnboardingFlowResolver();
      const ctx: FlowResolverContext = { planTier: 'professional' };
      const inner = createOnboardingProgressTracker();
      const flow = resolver.resolveFlow(TENANT, ctx);
      initializeProgress(TENANT, flow);
    });

    it('getProgress is accessible without guard (read-only)', () => {
      const inner = createOnboardingProgressTracker();
      const guarded = createGuardedProgressTracker(inner);
      // read-only: no exception
      const progress = guarded.getProgress(TENANT);
      expect(progress).toBeTruthy();
    });

    it('guarded.markStepCompleted succeeds for tenant_admin', () => {
      const inner = createOnboardingProgressTracker();
      const guarded = createGuardedProgressTracker(inner);
      expect(() => guarded.guarded.markStepCompleted(adminCtx, 'welcome')).not.toThrow();
    });

    it('guarded.markStepCompleted throws for employee', () => {
      const inner = createOnboardingProgressTracker();
      const guarded = createGuardedProgressTracker(inner);
      expect(() => guarded.guarded.markStepCompleted(employeeCtx, 'welcome')).toThrow(OnboardingAuthorizationError);
    });

    it('guarded.markStepSkipped throws for non-admin', () => {
      const inner = createOnboardingProgressTracker();
      const guarded = createGuardedProgressTracker(inner);
      expect(() => guarded.guarded.markStepSkipped(managerCtx, 'welcome')).toThrow(OnboardingAuthorizationError);
    });

    it('guarded.reset throws for non-admin', () => {
      const inner = createOnboardingProgressTracker();
      const guarded = createGuardedProgressTracker(inner);
      expect(() => guarded.guarded.reset(employeeCtx)).toThrow(OnboardingAuthorizationError);
    });

    it('guarded.setCurrentStep succeeds for owner', () => {
      const inner = createOnboardingProgressTracker();
      const guarded = createGuardedProgressTracker(inner);
      expect(() => guarded.guarded.setCurrentStep(ownerCtx, 'welcome')).not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 11) EVENTS
// ═══════════════════════════════════════════════════════════════

describe('Onboarding Domain Events', () => {
  beforeEach(() => {
    clearOnboardingEventLog();
  });

  // ── TenantOnboardingStarted ──

  describe('TenantOnboardingStarted', () => {
    it('emits and logs the event', () => {
      emitTenantOnboardingStarted('t1', 'u1', {
        plan_tier: 'professional',
        total_steps: 8,
        estimated_minutes: 25,
      });

      const log = getOnboardingEventLog();
      expect(log.length).toBe(1);
      expect(log[0].type).toBe('TenantOnboardingStarted');
      expect(log[0].tenant_id).toBe('t1');
      expect(log[0].user_id).toBe('u1');
    });

    it('notifies global listeners', () => {
      const handler = vi.fn();
      const unsub = onOnboardingEvent(handler);

      emitTenantOnboardingStarted('t1', 'u1', {
        plan_tier: 'starter',
        total_steps: 5,
        estimated_minutes: 10,
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe('TenantOnboardingStarted');

      unsub();
    });

    it('notifies typed listeners', () => {
      const handler = vi.fn();
      const unsub = onOnboardingEventType('TenantOnboardingStarted', handler);

      emitTenantOnboardingStarted('t1', 'u1', {
        plan_tier: 'enterprise',
        total_steps: 12,
        estimated_minutes: 45,
      });

      expect(handler).toHaveBeenCalledTimes(1);
      unsub();
    });
  });

  // ── OnboardingStepCompleted ──

  describe('OnboardingStepCompleted', () => {
    it('emits with step metadata', () => {
      emitOnboardingStepCompleted('t1', 'u1', {
        step_id: 'create_company',
        step_title: 'Criar Empresa',
        phase: 'company_setup',
        completion_pct: 25,
        elapsed_ms: 30000,
      });

      const log = getOnboardingEventLog();
      expect(log.length).toBe(1);
      const event = log[0] as any;
      expect(event.type).toBe('OnboardingStepCompleted');
      expect(event.metadata.step_id).toBe('create_company');
      expect(event.metadata.completion_pct).toBe(25);
    });
  });

  // ── OnboardingStepSkipped ──

  describe('OnboardingStepSkipped', () => {
    it('emits skip event', () => {
      emitOnboardingStepSkipped('t1', 'u1', {
        step_id: 'setup_departments',
        step_title: 'Configurar Departamentos',
        phase: 'company_setup',
        completion_pct: 30,
      });

      const log = getOnboardingEventLog();
      expect(log[0].type).toBe('OnboardingStepSkipped');
    });
  });

  // ── OnboardingFinished ──

  describe('OnboardingFinished', () => {
    it('emits finished event with summary', () => {
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
      const event = handler.mock.calls[0][0];
      expect(event.metadata.completed_steps).toBe(6);
      expect(event.metadata.skipped_steps).toBe(2);

      unsub();
    });
  });

  // ── RoleBootstrapCompleted ──

  describe('RoleBootstrapCompleted', () => {
    it('emits with roles list', () => {
      emitRoleBootstrapCompleted('t1', 'u1', {
        roles_created: ['admin', 'rh_manager', 'analyst'],
        plan_tier: 'professional',
      });

      const log = getOnboardingEventLog();
      const event = log[0] as any;
      expect(event.type).toBe('RoleBootstrapCompleted');
      expect(event.metadata.roles_created).toContain('rh_manager');
    });
  });

  // ── Event Bus behavior ──

  describe('Event Bus behavior', () => {
    it('unsubscribe stops notifications', () => {
      const handler = vi.fn();
      const unsub = onOnboardingEvent(handler);

      emitTenantOnboardingStarted('t1', 'u1', { plan_tier: 'free', total_steps: 3, estimated_minutes: 5 });
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();

      emitTenantOnboardingStarted('t1', 'u1', { plan_tier: 'free', total_steps: 3, estimated_minutes: 5 });
      expect(handler).toHaveBeenCalledTimes(1); // still 1
    });

    it('typed listener does not fire for other event types', () => {
      const handler = vi.fn();
      const unsub = onOnboardingEventType('OnboardingFinished', handler);

      emitTenantOnboardingStarted('t1', 'u1', { plan_tier: 'free', total_steps: 3, estimated_minutes: 5 });
      expect(handler).toHaveBeenCalledTimes(0);

      unsub();
    });

    it('event log is capped at MAX_LOG', () => {
      for (let i = 0; i < 250; i++) {
        emitOnboardingStepCompleted('t1', 'u1', {
          step_id: `step_${i}`,
          step_title: `Step ${i}`,
          phase: 'company_setup',
          completion_pct: i,
          elapsed_ms: 1000,
        });
      }

      expect(getOnboardingEventLog().length).toBe(200);
    });

    it('clearOnboardingEventLog empties the log', () => {
      emitTenantOnboardingStarted('t1', 'u1', { plan_tier: 'free', total_steps: 3, estimated_minutes: 5 });
      expect(getOnboardingEventLog().length).toBe(1);

      clearOnboardingEventLog();
      expect(getOnboardingEventLog().length).toBe(0);
    });

    it('handler errors do not break other listeners', () => {
      const badHandler = vi.fn(() => { throw new Error('boom'); });
      const goodHandler = vi.fn();

      const unsub1 = onOnboardingEvent(badHandler);
      const unsub2 = onOnboardingEvent(goodHandler);

      emitTenantOnboardingStarted('t1', 'u1', { plan_tier: 'free', total_steps: 3, estimated_minutes: 5 });

      expect(badHandler).toHaveBeenCalledTimes(1);
      expect(goodHandler).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });
  });
});
