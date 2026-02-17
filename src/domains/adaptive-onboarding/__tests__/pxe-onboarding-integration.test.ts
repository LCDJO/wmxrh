/**
 * PXE ↔ Adaptive Onboarding Integration Test
 *
 * Validates that:
 *   1. Unconfigured modules are hidden from navigation
 *   2. Features unlock progressively as onboarding advances
 *   3. Widgets are gated by onboarding progress
 *   4. Completed onboarding removes all gates
 *   5. Plan-level gating still applies on top of onboarding gating
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createOnboardingAwareExperience, type OnboardingAwareExperienceAPI } from '../onboarding-experience-bridge';
import { createOnboardingProgressTracker, initializeProgress } from '../onboarding-progress-tracker';
import { createOnboardingFlowResolver } from '../onboarding-flow-resolver';
import type { ExperienceOrchestratorAPI, ExperienceProfile, UpgradePrompt } from '@/domains/platform-experience/types';
import type { OnboardingProgressTrackerAPI, FlowResolverContext } from '../types';

// ── Mock base ExperienceOrchestrator ────────────────────────────

function createMockBaseExperience(): ExperienceOrchestratorAPI {
  const profile: ExperienceProfile = {
    tenant_id: '',
    plan_tier: 'professional',
    visible_navigation: [
      '/companies', '/departments', '/positions',
      '/employees', '/compensation', '/benefits',
      '/compliance', '/health', '/esocial',
    ],
    hidden_navigation: ['/workforce-intelligence'], // plan-gated
    locked_navigation: [],
    available_widgets: [
      'widget:company_overview',
      'widget:headcount_kpi',
      'widget:recent_hires',
      'widget:active_users',
      'widget:compliance_status',
    ],
    ui_features: {
      'ui:company_dashboard': true,
      'ui:company_selector': true,
      'ui:department_tree': true,
      'ui:employee_list': true,
      'ui:compliance_alerts': true,
      'ui:health_exams': true,
    },
    resolved_at: Date.now(),
  };

  return {
    resolveProfile(tenantId) {
      return { ...profile, tenant_id: tenantId };
    },
    isNavigationVisible(_tenantId, path) {
      return profile.visible_navigation.some(p => path.startsWith(p));
    },
    isNavigationLocked(_tenantId, path) {
      return profile.locked_navigation.some(l => path.startsWith(l.path));
    },
    getUpgradePromptForPath() { return null; },
    getAvailableWidgets() { return [...profile.available_widgets]; },
    getUIFeature(_tenantId, key) { return profile.ui_features[key] ?? false; },
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('PXE ↔ Adaptive Onboarding Integration', () => {
  const TENANT = 'test_tenant';
  let tracker: OnboardingProgressTrackerAPI;
  let bridge: OnboardingAwareExperienceAPI;

  beforeEach(() => {
    const resolver = createOnboardingFlowResolver();
    const ctx: FlowResolverContext = {
      planTier: 'professional',
      allowedModules: ['employees', 'companies', 'departments', 'compensation', 'benefits', 'compliance', 'health'],
      userRole: 'tenant_admin',
    };

    tracker = createOnboardingProgressTracker();
    const flow = resolver.resolveFlow(TENANT, ctx);
    initializeProgress(TENANT, flow);

    const base = createMockBaseExperience();
    bridge = createOnboardingAwareExperience(base, tracker);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. MODULE HIDING — unconfigured modules hidden
  // ─────────────────────────────────────────────────────────────

  describe('Module hiding — unconfigured modules', () => {
    it('hides /companies before create_company step is done', () => {
      expect(bridge.isNavigationVisible(TENANT, '/companies')).toBe(false);
    });

    it('shows /companies after create_company step is completed', () => {
      tracker.markStepCompleted(TENANT, 'welcome');
      tracker.markStepCompleted(TENANT, 'create_company');

      expect(bridge.isNavigationVisible(TENANT, '/companies')).toBe(true);
    });

    it('hides /departments before setup_departments is done', () => {
      expect(bridge.isNavigationVisible(TENANT, '/departments')).toBe(false);
    });

    it('hides /employees before add_employees is done', () => {
      expect(bridge.isNavigationVisible(TENANT, '/employees')).toBe(false);
    });

    it('shows /employees after add_employees is completed', () => {
      tracker.markStepCompleted(TENANT, 'add_employees');
      expect(bridge.isNavigationVisible(TENANT, '/employees')).toBe(true);
    });

    it('resolveProfile moves hidden modules to hidden_navigation', () => {
      const profile = bridge.resolveProfile(TENANT);

      // /companies should be in hidden (not visible)
      expect(profile.visible_navigation).not.toContain('/companies');
      expect(profile.hidden_navigation).toContain('/companies');
    });

    it('getLockedModules returns all locked modules with blocking step', () => {
      const locked = bridge.getLockedModules(TENANT);
      expect(locked.length).toBeGreaterThan(0);

      const companiesLock = locked.find(l => l.moduleKey === 'companies');
      expect(companiesLock).toBeTruthy();
      expect(companiesLock!.blockedByStep).toBe('create_company');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. PROGRESSIVE FEATURE UNLOCK
  // ─────────────────────────────────────────────────────────────

  describe('Progressive feature unlocking', () => {
    it('ui:company_dashboard is locked before create_company', () => {
      const result = bridge.isFeatureUnlockedByOnboarding(TENANT, 'ui:company_dashboard');
      expect(result.accessible).toBe(false);
      expect(result.blocked_by_step).toBe('create_company');
    });

    it('ui:company_dashboard unlocks after create_company', () => {
      tracker.markStepCompleted(TENANT, 'create_company');
      expect(bridge.isFeatureUnlockedByOnboarding(TENANT, 'ui:company_dashboard').accessible).toBe(true);
    });

    it('getUIFeature respects both plan and onboarding gates', () => {
      // Plan says true, but onboarding blocks it
      expect(bridge.getUIFeature(TENANT, 'ui:company_dashboard')).toBe(false);

      tracker.markStepCompleted(TENANT, 'create_company');
      expect(bridge.getUIFeature(TENANT, 'ui:company_dashboard')).toBe(true);
    });

    it('ui:compliance_alerts is locked before compliance_check', () => {
      expect(bridge.getUIFeature(TENANT, 'ui:compliance_alerts')).toBe(false);
    });

    it('ui:compliance_alerts unlocks after compliance_check', () => {
      tracker.markStepCompleted(TENANT, 'compliance_check');
      expect(bridge.getUIFeature(TENANT, 'ui:compliance_alerts')).toBe(true);
    });

    it('unknown features pass through as accessible', () => {
      const result = bridge.isFeatureUnlockedByOnboarding(TENANT, 'ui:unknown_feature');
      expect(result.accessible).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. WIDGET GATING
  // ─────────────────────────────────────────────────────────────

  describe('Widget gating by onboarding', () => {
    it('no widgets available before any step completes', () => {
      const widgets = bridge.getAvailableWidgets(TENANT);
      expect(widgets.length).toBe(0);
    });

    it('widget:company_overview unlocks after create_company', () => {
      tracker.markStepCompleted(TENANT, 'create_company');
      const widgets = bridge.getAvailableWidgets(TENANT);
      expect(widgets).toContain('widget:company_overview');
    });

    it('widget:headcount_kpi unlocks after add_employees', () => {
      tracker.markStepCompleted(TENANT, 'add_employees');
      const widgets = bridge.getAvailableWidgets(TENANT);
      expect(widgets).toContain('widget:headcount_kpi');
      expect(widgets).toContain('widget:recent_hires');
    });

    it('resolveProfile filters widgets by onboarding progress', () => {
      const profile = bridge.resolveProfile(TENANT);
      expect(profile.available_widgets.length).toBe(0);

      tracker.markStepCompleted(TENANT, 'create_company');
      tracker.markStepCompleted(TENANT, 'add_employees');

      const profile2 = bridge.resolveProfile(TENANT);
      expect(profile2.available_widgets).toContain('widget:company_overview');
      expect(profile2.available_widgets).toContain('widget:headcount_kpi');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. COMPLETED ONBOARDING — all gates removed
  // ─────────────────────────────────────────────────────────────

  describe('Completed onboarding removes all gates', () => {
    it('all modules accessible after onboarding is 100%', () => {
      // Complete all steps
      const progress = tracker.getProgress(TENANT)!;
      for (const step of progress.flow.steps) {
        tracker.markStepCompleted(TENANT, step.id);
      }

      expect(bridge.isNavigationVisible(TENANT, '/companies')).toBe(true);
      expect(bridge.isNavigationVisible(TENANT, '/employees')).toBe(true);
      expect(bridge.isNavigationVisible(TENANT, '/compliance')).toBe(true);
    });

    it('all features accessible after onboarding complete', () => {
      const progress = tracker.getProgress(TENANT)!;
      for (const step of progress.flow.steps) {
        tracker.markStepCompleted(TENANT, step.id);
      }

      expect(bridge.getUIFeature(TENANT, 'ui:company_dashboard')).toBe(true);
      expect(bridge.getUIFeature(TENANT, 'ui:employee_list')).toBe(true);
    });

    it('getLockedModules returns empty after completion', () => {
      const progress = tracker.getProgress(TENANT)!;
      for (const step of progress.flow.steps) {
        tracker.markStepCompleted(TENANT, step.id);
      }

      expect(bridge.getLockedModules(TENANT).length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. INTEGRATION STATUS
  // ─────────────────────────────────────────────────────────────

  describe('Integration status reporting', () => {
    it('reports full status before any progress', () => {
      const status = bridge.getOnboardingIntegrationStatus(TENANT);
      expect(status.onboarding_complete).toBe(false);
      expect(status.locked_modules.length).toBeGreaterThan(0);
      expect(status.locked_features.length).toBeGreaterThan(0);
      expect(status.unlocked_modules.length).toBe(0);
      expect(status.unlocked_features.length).toBe(0);
    });

    it('partial progress shows mixed status', () => {
      tracker.markStepCompleted(TENANT, 'create_company');
      tracker.markStepCompleted(TENANT, 'add_employees');

      const status = bridge.getOnboardingIntegrationStatus(TENANT);
      expect(status.unlocked_modules).toContain('companies');
      expect(status.unlocked_modules).toContain('employees');
      expect(status.locked_modules.length).toBeGreaterThan(0);
    });

    it('skipped steps also unlock modules', () => {
      tracker.markStepSkipped(TENANT, 'setup_departments');

      const result = bridge.isModuleUnlockedByOnboarding(TENANT, 'departments');
      expect(result.accessible).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. NO ONBOARDING PROGRESS — all gates open
  // ─────────────────────────────────────────────────────────────

  describe('No onboarding data — all gates open', () => {
    it('unknown tenant gets full access', () => {
      expect(bridge.isModuleUnlockedByOnboarding('unknown_tenant', 'companies').accessible).toBe(true);
      expect(bridge.isFeatureUnlockedByOnboarding('unknown_tenant', 'ui:company_dashboard').accessible).toBe(true);
    });

    it('resolveProfile returns base profile for unknown tenant', () => {
      const profile = bridge.resolveProfile('unknown_tenant');
      expect(profile.visible_navigation).toContain('/companies');
      expect(profile.visible_navigation).toContain('/employees');
    });
  });
});
