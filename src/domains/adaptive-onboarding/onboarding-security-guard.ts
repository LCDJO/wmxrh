/**
 * OnboardingSecurityGuard — Enforces TenantAdmin-only access to onboarding mutations.
 *
 * SECURITY CONTRACT:
 *   Only users with role `tenant_admin`, `admin`, `owner`, or `superadmin`
 *   can execute onboarding actions (complete step, skip step, setup wizard, etc.).
 *   Read-only operations (view progress, hints) are allowed for all authenticated users.
 *
 * This guard wraps the OnboardingProgressTrackerAPI and AdaptiveOnboardingEngineAPI
 * to inject authorization checks before any state mutation.
 */

import type {
  OnboardingProgressTrackerAPI,
  AdaptiveOnboardingEngineAPI,
  OnboardingProgress,
} from './types';

// ── Allowed roles for onboarding mutations ──────────────────────

const ONBOARDING_ADMIN_ROLES = [
  'tenant_admin',
  'admin',
  'owner',
  'superadmin',
] as const;

export type OnboardingAdminRole = (typeof ONBOARDING_ADMIN_ROLES)[number];

// ── Guard context ───────────────────────────────────────────────

export interface OnboardingSecurityContext {
  user_id: string;
  tenant_id: string;
  /** Effective roles for the current user in the current scope */
  effective_roles: string[];
}

// ── Errors ──────────────────────────────────────────────────────

export class OnboardingAuthorizationError extends Error {
  public readonly code = 'ONBOARDING_UNAUTHORIZED';
  public readonly required_roles = [...ONBOARDING_ADMIN_ROLES];

  constructor(
    public readonly action: string,
    public readonly user_id: string,
    public readonly tenant_id: string,
  ) {
    super(
      `[OnboardingSecurity] Ação "${action}" negada para user=${user_id} no tenant=${tenant_id}. ` +
      `Requer uma das roles: ${ONBOARDING_ADMIN_ROLES.join(', ')}.`
    );
    this.name = 'OnboardingAuthorizationError';
  }
}

// ── Authorization check ─────────────────────────────────────────

export function isOnboardingAdmin(ctx: OnboardingSecurityContext): boolean {
  return ctx.effective_roles.some(role =>
    ONBOARDING_ADMIN_ROLES.includes(role as OnboardingAdminRole)
  );
}

export function assertOnboardingAdmin(ctx: OnboardingSecurityContext, action: string): void {
  if (!isOnboardingAdmin(ctx)) {
    throw new OnboardingAuthorizationError(action, ctx.user_id, ctx.tenant_id);
  }
}

// ── Guarded Progress Tracker ────────────────────────────────────

export function createGuardedProgressTracker(
  inner: OnboardingProgressTrackerAPI,
): OnboardingProgressTrackerAPI & {
  /** Guarded versions that require security context */
  guarded: {
    markStepCompleted(ctx: OnboardingSecurityContext, stepId: string): void;
    markStepSkipped(ctx: OnboardingSecurityContext, stepId: string): void;
    setCurrentStep(ctx: OnboardingSecurityContext, stepId: string): void;
    reset(ctx: OnboardingSecurityContext): void;
  };
} {
  return {
    // ── Read-only: no guard needed ──
    getProgress(tenantId: string): OnboardingProgress | null {
      return inner.getProgress(tenantId);
    },

    // ── Mutation: passthrough (for internal/engine use) ──
    markStepCompleted: inner.markStepCompleted.bind(inner),
    markStepSkipped: inner.markStepSkipped.bind(inner),
    setCurrentStep: inner.setCurrentStep.bind(inner),
    reset: inner.reset.bind(inner),

    // ── Guarded mutations: require TenantAdmin ──
    guarded: {
      markStepCompleted(ctx: OnboardingSecurityContext, stepId: string): void {
        assertOnboardingAdmin(ctx, 'markStepCompleted');
        inner.markStepCompleted(ctx.tenant_id, stepId);
      },

      markStepSkipped(ctx: OnboardingSecurityContext, stepId: string): void {
        assertOnboardingAdmin(ctx, 'markStepSkipped');
        inner.markStepSkipped(ctx.tenant_id, stepId);
      },

      setCurrentStep(ctx: OnboardingSecurityContext, stepId: string): void {
        assertOnboardingAdmin(ctx, 'setCurrentStep');
        inner.setCurrentStep(ctx.tenant_id, stepId);
      },

      reset(ctx: OnboardingSecurityContext): void {
        assertOnboardingAdmin(ctx, 'reset');
        inner.reset(ctx.tenant_id);
      },
    },
  };
}
