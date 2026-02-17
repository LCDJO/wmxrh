/**
 * Platform Federation — Integration Test
 *
 * Validates that all subsystems compose correctly:
 *   ✅ ModuleRegistry — register, list, get
 *   ✅ ModuleLoader — manifest, getComponent, resolveForContext
 *   ✅ ModuleLifecycle — activate, deactivate, dependency graph
 *   ✅ ModulePermissionAdapter — canActivate, tenant scoping, permission registry
 *   ✅ WidgetRegistry — registerWidget, resolveWidgets
 *   ✅ FeatureFlagBridge — registerModuleFlags, isEnabled
 *   ✅ ModuleSandbox — gateway isolation, blocked domains
 *   ✅ PlatformCore — composed register + registerAll
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlatformCore } from '../federation/platform-core';
import type { GlobalEventKernelAPI, KernelEvent } from '../types';

// ── Mock Event Kernel ──────────────────────────────────────────

function createMockEventKernel(): GlobalEventKernelAPI {
  const handlers = new Map<string, Array<(event: KernelEvent) => void>>();

  return {
    emit(type, source, payload, opts) {
      const event: KernelEvent = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        source,
        timestamp: Date.now(),
        priority: opts?.priority ?? 'normal',
        payload,
        correlation_id: opts?.correlation_id,
      };
      const fns = handlers.get(type) ?? [];
      for (const fn of fns) fn(event);
    },
    on(type, handler, _opts) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type)!.push(handler as any);
      return () => {
        const arr = handlers.get(type);
        if (arr) {
          const idx = arr.indexOf(handler as any);
          if (idx >= 0) arr.splice(idx, 1);
        }
      };
    },
    once(type, handler) {
      const unsub = this.on(type, (event) => {
        unsub();
        (handler as any)(event);
      });
      return unsub;
    },
    stats() {
      return { total_emitted: 0, total_handled: 0, active_subscriptions: 0, events_per_type: {} };
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('Platform Federation — End-to-End', () => {
  let events: GlobalEventKernelAPI;
  let core: ReturnType<typeof createPlatformCore>;

  beforeEach(() => {
    events = createMockEventKernel();
    core = createPlatformCore(events);
  });

  // ── 1. ModuleRegistry ──────────────────────────────────────

  describe('ModuleRegistry', () => {
    it('registers and retrieves modules', () => {
      core.register({ key: 'test_mod', label: 'Test', version: '1.0.0' });
      expect(core.get('test_mod')).toBeTruthy();
      expect(core.get('test_mod')?.label).toBe('Test');
    });

    it('lists all registered modules', () => {
      core.register({ key: 'a', label: 'A' });
      core.register({ key: 'b', label: 'B' });
      expect(core.list().length).toBe(2);
    });

    it('unregisters modules', () => {
      core.register({ key: 'x', label: 'X' });
      core.unregister('x');
      expect(core.get('x')).toBeNull();
    });
  });

  // ── 2. ModuleLoader + Manifest ─────────────────────────────

  describe('ModuleLoader', () => {
    const mockManifest = {
      module_id: 'hr',
      module_name: 'HR',
      version: '1.0.0',
      routes: ['/hr'],
      widgets: [{
        widget_id: 'hr:kpi',
        label: 'Headcount',
        slot: 'dashboard' as const,
        loadComponent: () => Promise.resolve({ default: () => null }),
        priority: 1,
      }],
      permissions: ['hr:read', 'hr:write'],
      feature_flags: ['ff_hr_org_chart'],
      navigation_entries: [
        { path: '/hr', label: 'RH', icon: 'Users', order: 1 },
        { path: '/hr/employees', label: 'Colaboradores', parent: '/hr', order: 1 },
      ],
      loadComponent: () => Promise.resolve({ default: () => null }),
    };

    it('registers manifest and retrieves it', () => {
      core.register({ key: 'hr', label: 'HR' }, mockManifest);
      expect(core.getManifest('hr')).toBeTruthy();
      expect(core.getManifest('hr')?.module_name).toBe('HR');
    });

    it('returns a lazy component', () => {
      core.register({ key: 'hr', label: 'HR' }, mockManifest);
      const Component = core.getComponent('hr');
      expect(Component).toBeTruthy();
    });

    it('resolves modules for context with tenant + permissions', () => {
      core.register({ key: 'hr', label: 'HR' }, mockManifest);
      core.enableForTenant('hr', 'tenant_1');

      const resolved = core.resolveForContext({
        tenant_id: 'tenant_1',
        roles: ['admin'],
        permissions: ['hr:read'],
        feature_flags: ['ff_hr_org_chart'],
      });

      expect(resolved.length).toBe(1);
      expect(resolved[0].module_id).toBe('hr');
    });

    it('filters out modules missing feature flags', () => {
      core.register({ key: 'hr', label: 'HR' }, mockManifest);

      const resolved = core.resolveForContext({
        tenant_id: 'tenant_1',
        roles: ['admin'],
        permissions: ['hr:read'],
        feature_flags: [], // no flags
      });

      expect(resolved.length).toBe(0);
    });
  });

  // ── 3. ModuleLifecycle ─────────────────────────────────────

  describe('ModuleLifecycle', () => {
    it('activates and deactivates modules', async () => {
      core.register({ key: 'mod1', label: 'Mod1' });
      await core.activate('mod1');
      expect(core.get('mod1')?.status).toBe('active');
      expect(core.listActive().length).toBe(1);

      await core.deactivate('mod1');
      expect(core.get('mod1')?.status).toBe('suspended');
    });

    it('resolves dependencies on activation', async () => {
      core.register({ key: 'base', label: 'Base', is_core: true });
      core.register({ key: 'child', label: 'Child', dependencies: ['base'] });

      await core.activateWithDeps('child');
      expect(core.get('base')?.status).toBe('active');
      expect(core.get('child')?.status).toBe('active');
    });

    it('returns correct activation order', () => {
      core.register({ key: 'a', label: 'A' });
      core.register({ key: 'b', label: 'B', dependencies: ['a'] });
      core.register({ key: 'c', label: 'C', dependencies: ['b'] });

      const order = core.activationOrder('c');
      expect(order).toEqual(['a', 'b', 'c']);
    });

    it('prevents deactivation of core modules', async () => {
      core.register({ key: 'core', label: 'Core', is_core: true });
      await core.activate('core');

      await expect(core.deactivate('core')).rejects.toThrow('Cannot deactivate core module');
    });
  });

  // ── 4. Permissions + Tenant Scoping ────────────────────────

  describe('Permissions & Tenant Scoping', () => {
    it('checks canActivate with required permissions', () => {
      core.register({ key: 'comp', label: 'Comp', required_permissions: ['comp:read'] });

      const ctx = { userId: 'u1', tenantId: 't1', roles: ['user'], permissions: ['comp:read'] };
      expect(core.canActivate('comp', ctx)).toBe(true);

      const ctxMissing = { userId: 'u1', tenantId: 't1', roles: ['user'], permissions: [] };
      expect(core.canActivate('comp', ctxMissing)).toBe(false);
    });

    it('reports missing permissions', () => {
      core.register({ key: 'm', label: 'M', required_permissions: ['a', 'b', 'c'] });
      const missing = core.missingPermissions('m', {
        userId: 'u1', tenantId: 't1', roles: [], permissions: ['a'],
      });
      expect(missing).toEqual(['b', 'c']);
    });

    it('enables/disables modules per tenant', () => {
      core.register({ key: 'ads', label: 'ADS' });

      core.enableForTenant('ads', 'tenant_a');
      expect(core.isEnabledForTenant('ads', 'tenant_a')).toBe(true);

      core.disableForTenant('ads', 'tenant_a');
      expect(core.isEnabledForTenant('ads', 'tenant_a')).toBe(false);
    });

    it('lists modules for a tenant', () => {
      core.register({ key: 'hr', label: 'HR', is_core: true });
      core.register({ key: 'ads', label: 'ADS' });

      core.disableForTenant('ads', 't1');

      const forTenant = core.listForTenant('t1');
      expect(forTenant.map(m => m.key)).toContain('hr');
      expect(forTenant.map(m => m.key)).not.toContain('ads');
    });

    it('registers permissions from manifest', () => {
      const manifest = {
        module_id: 'ads',
        module_name: 'ADS',
        version: '1.0.0',
        routes: [],
        widgets: [],
        permissions: ['ads.create_campaign', 'ads.view_reports'],
        feature_flags: [],
        navigation_entries: [],
        loadComponent: () => Promise.resolve({ default: () => null }),
      };

      core.register({ key: 'ads', label: 'ADS' }, manifest);

      const perms = core.permissions.listPermissionsForModule('ads');
      expect(perms.length).toBe(2);
      expect(perms.map(p => p.key)).toContain('ads.create_campaign');
    });
  });

  // ── 5. WidgetRegistry ──────────────────────────────────────

  describe('WidgetRegistry', () => {
    it('registers widgets from manifest and resolves by context', () => {
      const manifest = {
        module_id: 'hr',
        module_name: 'HR',
        version: '1.0.0',
        routes: [],
        widgets: [{
          widget_id: 'hr:kpi',
          label: 'Headcount KPI',
          slot: 'dashboard' as const,
          loadComponent: () => Promise.resolve({ default: () => null }),
          priority: 1,
        }],
        permissions: [],
        feature_flags: [],
        navigation_entries: [],
        loadComponent: () => Promise.resolve({ default: () => null }),
      };

      core.register({ key: 'hr', label: 'HR' }, manifest);

      const resolved = core.resolveWidgetsForContext('dashboard', {
        roles: ['admin'],
        permissions: [],
        tenant_id: 't1',
        feature_flags: [],
      });

      expect(resolved.length).toBe(1);
      expect(resolved[0].registration.widget_id).toBe('hr:kpi');
    });

    it('filters widgets by role', () => {
      core.registerWidget({
        widget_id: 'admin:panel',
        label: 'Admin Panel',
        module_id: 'admin',
        allowed_roles: ['super_admin'],
        contexts: ['dashboard'],
        loadComponent: () => Promise.resolve({ default: () => null }),
      });

      const noAccess = core.resolveWidgetsForContext('dashboard', {
        roles: ['viewer'],
        permissions: [],
        tenant_id: 't1',
        feature_flags: [],
      });
      expect(noAccess.length).toBe(0);

      const hasAccess = core.resolveWidgetsForContext('dashboard', {
        roles: ['super_admin'],
        permissions: [],
        tenant_id: 't1',
        feature_flags: [],
      });
      expect(hasAccess.length).toBe(1);
    });

    it('cleans up widgets on module unregister', () => {
      const manifest = {
        module_id: 'rpt',
        module_name: 'Reports',
        version: '1.0.0',
        routes: [],
        widgets: [{
          widget_id: 'rpt:quick',
          label: 'Quick Reports',
          slot: 'sidebar' as const,
          loadComponent: () => Promise.resolve({ default: () => null }),
        }],
        permissions: [],
        feature_flags: [],
        navigation_entries: [],
        loadComponent: () => Promise.resolve({ default: () => null }),
      };

      core.register({ key: 'rpt', label: 'Reports' }, manifest);
      expect(core.widgets.hasWidget('rpt:quick')).toBe(true);

      core.unregister('rpt');
      expect(core.widgets.hasWidget('rpt:quick')).toBe(false);
    });
  });

  // ── 6. FeatureFlagBridge ───────────────────────────────────

  describe('FeatureFlagBridge', () => {
    it('registers flags from manifest', () => {
      const manifest = {
        module_id: 'hr',
        module_name: 'HR',
        version: '1.0.0',
        routes: [],
        widgets: [],
        permissions: [],
        feature_flags: ['ff_hr_org_chart', 'ff_hr_bulk_import'],
        navigation_entries: [],
        loadComponent: () => Promise.resolve({ default: () => null }),
      };

      core.register({ key: 'hr', label: 'HR' }, manifest);

      const flags = core.featureFlags.listFlagsForModule('hr');
      expect(flags).toContain('ff_hr_org_chart');
      expect(flags).toContain('ff_hr_bulk_import');
    });

    it('checks flag enabled state', () => {
      // Default stub returns false
      expect(core.isFeatureEnabled('ff_nonexistent')).toBe(false);
    });
  });

  // ── 7. ModuleSandbox — Isolation ───────────────────────────

  describe('ModuleSandbox Isolation', () => {
    it('creates sandboxes for registered modules', () => {
      core.register({ key: 'test', label: 'Test' });
      const sandbox = core.sandbox('test');
      expect(sandbox.moduleKey).toBe('test');
    });

    it('blocks access to forbidden domains via gateway', () => {
      core.register({ key: 'evil', label: 'Evil' });
      const sandbox = core.sandbox('evil');

      expect(() =>
        sandbox.gateway.query('_security_kernel', 'steal_tokens')
      ).toThrow('blocked domain');
    });

    it('blocks access to _raw_db via gateway', () => {
      core.register({ key: 'sneaky', label: 'Sneaky' });
      const sandbox = core.sandbox('sneaky');

      expect(() =>
        sandbox.gateway.mutate('_raw_db', 'drop_tables')
      ).toThrow('blocked domain');
    });

    it('validates import paths', () => {
      core.register({ key: 'plugin', label: 'Plugin' });
      const sandbox = core.sandbox('plugin');

      expect(() =>
        sandbox.assertImportAllowed('@/integrations/supabase/client')
      ).toThrow('blocked path');

      expect(() =>
        sandbox.assertImportAllowed('@/modules/hr/gateway')
      ).not.toThrow();
    });

    it('destroys sandbox and runs cleanups', () => {
      core.register({ key: 'temp', label: 'Temp' });
      const sandbox = core.sandbox('temp');
      const cleanupFn = vi.fn();
      sandbox.addCleanup(cleanupFn);

      core.destroySandbox('temp');
      expect(cleanupFn).toHaveBeenCalledOnce();
    });
  });

  // ── 8. registerAll (bulk federation) ───────────────────────

  describe('registerAll', () => {
    it('registers all predefined modules from MODULE_FEDERATION_MAP', () => {
      core.registerAll();

      expect(core.get('core_hr')).toBeTruthy();
      expect(core.get('compensation_engine')).toBeTruthy();
      expect(core.get('tenant_admin')).toBeTruthy();
      expect(core.get('reporting')).toBeTruthy();

      // Manifests should also be available
      expect(core.getManifest('core_hr')).toBeTruthy();
      expect(core.getManifest('compensation_engine')).toBeTruthy();
    });

    it('widgets from all modules are registered', () => {
      core.registerAll();

      const allWidgets = core.widgets.listWidgets();
      expect(allWidgets.length).toBeGreaterThan(0);

      // HR should have dashboard and sidebar widgets
      const hrWidgets = core.widgets.listWidgetsForModule('core_hr');
      expect(hrWidgets.length).toBeGreaterThan(0);
    });

    it('permissions from all modules are registered', () => {
      core.registerAll();

      const allPerms = core.permissions.listPermissions();
      expect(allPerms.length).toBeGreaterThan(0);
      expect(allPerms.map(p => p.key)).toContain('hr:read');
      expect(allPerms.map(p => p.key)).toContain('compensation:read');
    });
  });
});
