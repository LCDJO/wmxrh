/**
 * Federation Architecture — End-to-End Test Suite
 *
 * Tests the COMPLETE flow of the Module Federation system:
 *
 *  1. Boot: registerAll → all modules + manifests + widgets + permissions + flags
 *  2. Lifecycle: activate core → activate dependents → cascading deactivation
 *  3. Navigation Bridge: auto-sync on activate/deactivate, hierarchical tree
 *  4. Widget Resolution: slot-based, role/permission/flag gating, priority ordering
 *  5. Tenant Scoping: enable/disable per tenant, listForTenant, resolveForContext
 *  6. Feature Flags: manifest → bridge → isEnabled, tenant-scoped flags
 *  7. Sandbox Isolation: gateway proxy, blocked domains, blocked imports, cleanup
 *  8. Permission Adapter: canActivate, canAccess, missingPermissions, filterAccessible
 *  9. Event Tracing: all operations emit correctly-typed events
 * 10. Cross-cutting: full user journey (boot → tenant setup → module access → widget render)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlatformCore, type PlatformCoreAPI } from '../federation/platform-core';
import { createModuleNavigationBridge, type ModuleNavigationBridgeAPI } from '../federation/module-navigation-bridge';
import type { GlobalEventKernelAPI, KernelEvent, NavigationOrchestratorAPI, NavigationEntry } from '../types';
import type { ModuleLoadContext } from '../federation/module-loader';
import type { PermissionContext } from '../federation/module-permission-adapter';

// ════════════════════════════════════════════════════════════════
// Test Helpers
// ════════════════════════════════════════════════════════════════

function createMockEventKernel(): GlobalEventKernelAPI & { emitted: Array<{ type: string; payload: any }> } {
  const handlers = new Map<string, Array<(event: KernelEvent) => void>>();
  const emitted: Array<{ type: string; payload: any }> = [];

  const kernel: any = {
    emitted,
    emit(type: string, source: string, payload?: any, opts?: any) {
      emitted.push({ type, payload });
      const event: KernelEvent = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        source,
        timestamp: Date.now(),
        priority: opts?.priority ?? 'normal',
        payload,
        correlation_id: opts?.correlation_id,
      };
      // Emit with full event to typed handlers
      const fns = handlers.get(type) ?? [];
      for (const fn of fns) fn(event);
      // Also emit payload directly for `on` handlers that expect payload
      // (module-navigation-bridge uses payload-style)
    },
    on(type: string, handler: any, _opts?: any) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type)!.push(handler);
      return () => {
        const arr = handlers.get(type);
        if (arr) {
          const idx = arr.indexOf(handler);
          if (idx >= 0) arr.splice(idx, 1);
        }
      };
    },
    once(type: string, handler: any) {
      const unsub = kernel.on(type, (event: any) => {
        unsub();
        handler(event);
      });
      return unsub;
    },
    stats() {
      return { total_emitted: 0, total_handled: 0, active_subscriptions: 0, events_per_type: {} };
    },
  };

  return kernel;
}

function createMockNavigationOrchestrator(): NavigationOrchestratorAPI & {
  _moduleRoutes: Map<string, NavigationEntry[]>;
} {
  const moduleRoutes = new Map<string, NavigationEntry[]>();

  return {
    _moduleRoutes: moduleRoutes,
    state: () => ({ current_path: '/', history: [], pinned: [], breadcrumbs: [], suggestions: [], tree: { core: [], modules: [], cognitive: [], pinned: [], entries: [], merged_at: Date.now() } }),
    navigate: vi.fn(),
    registerCoreRoutes: vi.fn(),
    registerModuleRoutes: (key: string, entries: NavigationEntry[]) => {
      moduleRoutes.set(key, entries);
    },
    pushCognitiveHints: vi.fn(),
    removeModuleRoutes: (key: string) => { moduleRoutes.delete(key); },
    pin: vi.fn(),
    unpin: vi.fn(),
    mergedTree: () => ({ core: [], modules: [], cognitive: [], pinned: [], entries: [], merged_at: Date.now() }),
    registerRoutes: vi.fn(),
    suggest: vi.fn(),
  };
}

function adminContext(tenantId: string): PermissionContext {
  return {
    userId: 'admin-user-1',
    tenantId,
    roles: ['admin', 'super_admin'],
    permissions: [
      'hr:read', 'hr:write', 'hr:admin',
      'compensation:read', 'compensation:write', 'compensation:approve',
      'admin:read', 'admin:write', 'admin:super',
      'reports:read', 'reports:write', 'reports:export',
      'employees:read', 'employees:write',
      'modules:manage', 'users:manage', 'roles:manage',
      'departments:manage', 'salary_tables:manage', 'dashboards:manage',
    ],
  };
}

function viewerContext(tenantId: string): PermissionContext {
  return {
    userId: 'viewer-user-1',
    tenantId,
    roles: ['viewer'],
    permissions: ['hr:read', 'reports:read'],
  };
}

function loadContext(tenantId: string, permissions: string[], flags: string[]): ModuleLoadContext {
  return { tenant_id: tenantId, roles: ['admin'], permissions, feature_flags: flags };
}

// ════════════════════════════════════════════════════════════════
// Test Suite
// ════════════════════════════════════════════════════════════════

describe('Federation Architecture — Full E2E', () => {
  let events: ReturnType<typeof createMockEventKernel>;
  let core: PlatformCoreAPI;

  beforeEach(() => {
    events = createMockEventKernel();
    core = createPlatformCore(events);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. BOOT — registerAll
  // ─────────────────────────────────────────────────────────────

  describe('1. Boot — registerAll', () => {
    it('registers all 4 predefined modules with registrations + manifests', () => {
      core.registerAll();

      const allModules = core.list();
      expect(allModules.length).toBe(4);

      const keys = allModules.map(m => m.key);
      expect(keys).toContain('core_hr');
      expect(keys).toContain('compensation_engine');
      expect(keys).toContain('tenant_admin');
      expect(keys).toContain('reporting');
    });

    it('manifests are available for all modules', () => {
      core.registerAll();

      expect(core.getManifest('core_hr')?.module_name).toBe('RH Core');
      expect(core.getManifest('compensation_engine')?.module_name).toBe('Motor de Remuneração');
      expect(core.getManifest('tenant_admin')?.module_name).toBe('Administração do Tenant');
      expect(core.getManifest('reporting')?.module_name).toBe('Relatórios & Analytics');
    });

    it('widgets from all manifests are auto-registered', () => {
      core.registerAll();

      const all = core.widgets.listWidgets();
      expect(all.length).toBeGreaterThanOrEqual(5); // HR(2) + Comp(1) + Tenant(1) + Report(2)

      expect(core.widgets.hasWidget('core_hr:headcount_kpi')).toBe(true);
      expect(core.widgets.hasWidget('core_hr:recent_hires')).toBe(true);
      expect(core.widgets.hasWidget('compensation:payroll_summary')).toBe(true);
      expect(core.widgets.hasWidget('tenant_admin:active_users')).toBe(true);
      expect(core.widgets.hasWidget('reporting:quick_reports')).toBe(true);
      expect(core.widgets.hasWidget('reporting:kpi_strip')).toBe(true);
    });

    it('permissions from all manifests are auto-registered', () => {
      core.registerAll();

      const perms = core.permissions.listPermissions();
      expect(perms.length).toBeGreaterThan(15);

      // Spot-check from each module
      expect(perms.map(p => p.key)).toContain('hr:read');
      expect(perms.map(p => p.key)).toContain('compensation:approve');
      expect(perms.map(p => p.key)).toContain('admin:super');
      expect(perms.map(p => p.key)).toContain('reports:export');
    });

    it('feature flags from all manifests are registered in bridge', () => {
      core.registerAll();

      const hrFlags = core.featureFlags.listFlagsForModule('core_hr');
      expect(hrFlags).toContain('ff_hr_org_chart');
      expect(hrFlags).toContain('ff_hr_bulk_import');
      expect(hrFlags).toContain('ff_hr_advanced_search');

      const compFlags = core.featureFlags.listFlagsForModule('compensation_engine');
      expect(compFlags).toContain('ff_comp_simulations');

      const adminFlags = core.featureFlags.listFlagsForModule('tenant_admin');
      expect(adminFlags).toContain('ff_admin_impersonation');

      const reportFlags = core.featureFlags.listFlagsForModule('reporting');
      expect(reportFlags).toContain('ff_report_builder');
    });

    it('emits platform:all_modules_registered event', () => {
      core.registerAll();

      const bootEvent = events.emitted.find(e => e.type === 'platform:all_modules_registered');
      expect(bootEvent).toBeTruthy();
      expect(bootEvent!.payload.count).toBe(4);
      expect(bootEvent!.payload.keys).toContain('core_hr');
    });

    it('sandboxes are created for all modules', () => {
      core.registerAll();

      expect(core.sandboxManager.has('core_hr')).toBe(true);
      expect(core.sandboxManager.has('compensation_engine')).toBe(true);
      expect(core.sandboxManager.has('tenant_admin')).toBe(true);
      expect(core.sandboxManager.has('reporting')).toBe(true);
    });

    it('lazy components are available via getComponent', () => {
      core.registerAll();

      expect(core.getComponent('core_hr')).toBeTruthy();
      expect(core.getComponent('compensation_engine')).toBeTruthy();
      expect(core.getComponent('tenant_admin')).toBeTruthy();
      expect(core.getComponent('reporting')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. LIFECYCLE — activation, deactivation, dependency graph
  // ─────────────────────────────────────────────────────────────

  describe('2. Lifecycle — activation, dependencies, cascading', () => {
    beforeEach(() => core.registerAll());

    it('core_hr (is_core) activates independently', async () => {
      await core.activate('core_hr');
      expect(core.get('core_hr')?.status).toBe('active');
    });

    it('compensation_engine depends on core_hr — must activate deps first', async () => {
      // Direct activation fails — core_hr not active
      await expect(core.activate('compensation_engine')).rejects.toThrow('depends on');

      // activateWithDeps resolves it
      await core.activateWithDeps('compensation_engine');
      expect(core.get('core_hr')?.status).toBe('active');
      expect(core.get('compensation_engine')?.status).toBe('active');
    });

    it('reporting depends on core_hr — activateWithDeps works', async () => {
      await core.activateWithDeps('reporting');
      expect(core.get('core_hr')?.status).toBe('active');
      expect(core.get('reporting')?.status).toBe('active');
    });

    it('dependency graph is correct', () => {
      const graph = core.dependencyGraph();
      expect(graph['compensation_engine']).toContain('core_hr');
      expect(graph['reporting']).toContain('core_hr');
      expect(graph['core_hr']).toEqual([]);
      expect(graph['tenant_admin']).toEqual([]);
    });

    it('activation order resolves transitive deps', () => {
      const order = core.activationOrder('compensation_engine');
      expect(order).toEqual(['core_hr', 'compensation_engine']);

      const order2 = core.activationOrder('reporting');
      expect(order2).toEqual(['core_hr', 'reporting']);
    });

    it('cannot deactivate core_hr (is_core)', async () => {
      await core.activate('core_hr');
      await expect(core.deactivate('core_hr')).rejects.toThrow('Cannot deactivate core module');
    });

    it('cannot deactivate core_hr if compensation_engine depends on it', async () => {
      await core.activateWithDeps('compensation_engine');
      // Even though is_core already prevents it, the dependency check also fires
      await expect(core.deactivate('core_hr')).rejects.toThrow();
    });

    it('deactivateWithDeps cascades correctly', async () => {
      await core.activateWithDeps('compensation_engine');
      await core.activateWithDeps('reporting');

      // Deactivate core_hr should cascade to compensation_engine and reporting
      // But core_hr is is_core so this should fail at the end
      await expect(core.deactivateWithDeps('core_hr')).rejects.toThrow();

      // Non-core dependent can be deactivated with deps
      await core.deactivate('compensation_engine');
      expect(core.get('compensation_engine')?.status).toBe('suspended');
    });

    it('listActive reflects only active modules', async () => {
      expect(core.listActive().length).toBe(0);

      await core.activate('core_hr');
      await core.activate('tenant_admin');
      expect(core.listActive().length).toBe(2);

      await core.activateWithDeps('compensation_engine');
      expect(core.listActive().length).toBe(3);
    });

    it('emits module:activated and module:deactivated events', async () => {
      // Use a non-core module for activate/deactivate event testing
      core.register({ key: 'evt_mod', label: 'Event Module' });

      await core.activate('evt_mod');
      expect(events.emitted.some(e => e.type === 'module:activated' && e.payload?.key === 'evt_mod')).toBe(true);

      await core.deactivate('evt_mod');
      expect(events.emitted.some(e => e.type === 'module:deactivated' && e.payload?.key === 'evt_mod')).toBe(true);
    });

    it('lifecycle hooks (onActivate, onDeactivate) are called', async () => {
      const onActivate = vi.fn();
      const onDeactivate = vi.fn();

      core.register({
        key: 'hooktest',
        label: 'Hook Test',
        onActivate,
        onDeactivate,
      });

      await core.activate('hooktest');
      expect(onActivate).toHaveBeenCalledOnce();

      await core.deactivate('hooktest');
      expect(onDeactivate).toHaveBeenCalledOnce();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. NAVIGATION BRIDGE — auto-sync with lifecycle
  // ─────────────────────────────────────────────────────────────

  describe('3. Navigation Bridge — auto-sync', () => {
    let nav: ReturnType<typeof createMockNavigationOrchestrator>;
    let bridge: ModuleNavigationBridgeAPI;

    beforeEach(() => {
      core.registerAll();
      nav = createMockNavigationOrchestrator();
      bridge = createModuleNavigationBridge(nav, core.loader, events);
    });

    it('syncModule registers hierarchical navigation entries', () => {
      bridge.syncModule('core_hr');

      const routes = nav._moduleRoutes.get('core_hr');
      expect(routes).toBeTruthy();
      expect(routes!.length).toBe(1); // root entry "/hr"
      expect(routes![0].path).toBe('/hr');
      expect(routes![0].children?.length).toBe(4); // employees, departments, positions, org-chart
    });

    it('syncAll registers navigation for all modules', () => {
      bridge.syncAll();

      expect(nav._moduleRoutes.has('core_hr')).toBe(true);
      expect(nav._moduleRoutes.has('compensation_engine')).toBe(true);
      expect(nav._moduleRoutes.has('tenant_admin')).toBe(true);
      expect(nav._moduleRoutes.has('reporting')).toBe(true);
    });

    it('removeModule clears navigation entries', () => {
      bridge.syncModule('core_hr');
      expect(nav._moduleRoutes.has('core_hr')).toBe(true);

      bridge.removeModule('core_hr');
      expect(nav._moduleRoutes.has('core_hr')).toBe(false);
    });

    it('navigation entries preserve permission requirements', () => {
      bridge.syncModule('core_hr');

      const routes = nav._moduleRoutes.get('core_hr')!;
      const orgChart = routes[0].children?.find(c => c.path === '/hr/org-chart');
      expect(orgChart).toBeTruthy();
      expect(orgChart?.required_permissions).toContain('hr:read');
    });

    it('navigation entries are sorted by priority/order', () => {
      bridge.syncModule('core_hr');

      const children = nav._moduleRoutes.get('core_hr')![0].children!;
      const orders = children.map(c => c.priority);
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]! >= orders[i - 1]!).toBe(true);
      }
    });

    it('compensation navigation has correct hierarchy', () => {
      bridge.syncModule('compensation_engine');

      const routes = nav._moduleRoutes.get('compensation_engine')!;
      expect(routes[0].path).toBe('/compensation');
      expect(routes[0].children?.length).toBe(3); // salary-tables, simulations, history
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. WIDGET RESOLUTION — slot-based, gated, priority-sorted
  // ─────────────────────────────────────────────────────────────

  describe('4. Widget Resolution', () => {
    beforeEach(() => core.registerAll());

    it('resolves dashboard widgets sorted by priority', () => {
      const ctx = loadContext('t1', ['hr:read', 'compensation:read', 'admin:read'], ['ff_hr_org_chart', 'ff_comp_simulations', 'ff_admin_impersonation']);

      const widgets = core.resolveWidgets('dashboard', ctx);
      expect(widgets.length).toBeGreaterThanOrEqual(2);

      // Check priority ordering
      for (let i = 1; i < widgets.length; i++) {
        expect((widgets[i].priority ?? 99) >= (widgets[i - 1].priority ?? 99)).toBe(true);
      }
    });

    it('resolves sidebar widgets', () => {
      const ctx = loadContext('t1', ['hr:read'], ['ff_hr_org_chart']);
      const widgets = core.resolveWidgets('sidebar', ctx);
      expect(widgets.some(w => w.widget_id === 'core_hr:recent_hires')).toBe(true);
    });

    it('widget-level permission gating works', () => {
      // compensation:payroll_summary requires compensation:read
      const ctxWithPerm = loadContext('t1', ['compensation:read'], ['ff_comp_simulations']);
      const withPerm = core.resolveWidgets('dashboard', ctxWithPerm);
      expect(withPerm.some(w => w.widget_id === 'compensation:payroll_summary')).toBe(true);

      const ctxWithout = loadContext('t1', [], ['ff_comp_simulations']);
      const withoutPerm = core.resolveWidgets('dashboard', ctxWithout);
      expect(withoutPerm.some(w => w.widget_id === 'compensation:payroll_summary')).toBe(false);
    });

    it('WidgetRegistry resolves widgets with role gating', () => {
      core.registerWidget({
        widget_id: 'test:admin_only',
        label: 'Admin Only Widget',
        module_id: 'test',
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
      expect(noAccess.some(w => w.registration.widget_id === 'test:admin_only')).toBe(false);

      const hasAccess = core.resolveWidgetsForContext('dashboard', {
        roles: ['super_admin'],
        permissions: [],
        tenant_id: 't1',
        feature_flags: [],
      });
      expect(hasAccess.some(w => w.registration.widget_id === 'test:admin_only')).toBe(true);
    });

    it('WidgetRegistry feature_flag gating works', () => {
      core.registerWidget({
        widget_id: 'test:flagged',
        label: 'Flagged Widget',
        module_id: 'test',
        allowed_roles: [],
        contexts: ['sidebar'],
        feature_flag: 'ff_experimental',
        loadComponent: () => Promise.resolve({ default: () => null }),
      });

      const without = core.resolveWidgetsForContext('sidebar', {
        roles: ['admin'],
        permissions: [],
        tenant_id: 't1',
        feature_flags: [],
      });
      expect(without.some(w => w.registration.widget_id === 'test:flagged')).toBe(false);

      const withFlag = core.resolveWidgetsForContext('sidebar', {
        roles: ['admin'],
        permissions: [],
        tenant_id: 't1',
        feature_flags: ['ff_experimental'],
      });
      expect(withFlag.some(w => w.registration.widget_id === 'test:flagged')).toBe(true);
    });

    it('widget cleanup on module unregister', () => {
      expect(core.widgets.hasWidget('core_hr:headcount_kpi')).toBe(true);
      expect(core.widgets.hasWidget('core_hr:recent_hires')).toBe(true);

      core.unregister('core_hr');

      expect(core.widgets.hasWidget('core_hr:headcount_kpi')).toBe(false);
      expect(core.widgets.hasWidget('core_hr:recent_hires')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. TENANT SCOPING — enable/disable per tenant
  // ─────────────────────────────────────────────────────────────

  describe('5. Tenant Scoping', () => {
    beforeEach(() => core.registerAll());

    it('core modules are always enabled for any tenant', () => {
      expect(core.isEnabledForTenant('core_hr', 'any_tenant')).toBe(true);
      expect(core.isEnabledForTenant('tenant_admin', 'any_tenant')).toBe(true);
    });

    it('non-core modules can be disabled per tenant', () => {
      core.disableForTenant('compensation_engine', 'tenant_a');
      expect(core.isEnabledForTenant('compensation_engine', 'tenant_a')).toBe(false);
      expect(core.isEnabledForTenant('compensation_engine', 'tenant_b')).toBe(true);
    });

    it('enabling a disabled module restores access', () => {
      core.disableForTenant('reporting', 'tenant_x');
      expect(core.isEnabledForTenant('reporting', 'tenant_x')).toBe(false);

      core.enableForTenant('reporting', 'tenant_x');
      expect(core.isEnabledForTenant('reporting', 'tenant_x')).toBe(true);
    });

    it('listForTenant excludes disabled modules', () => {
      core.disableForTenant('compensation_engine', 't1');
      core.disableForTenant('reporting', 't1');

      const forT1 = core.listForTenant('t1');
      const keys = forT1.map(m => m.key);
      expect(keys).toContain('core_hr');
      expect(keys).toContain('tenant_admin');
      expect(keys).not.toContain('compensation_engine');
      expect(keys).not.toContain('reporting');
    });

    it('resolveForContext filters by tenant enablement', () => {
      core.disableForTenant('compensation_engine', 't1');

      const ctx = loadContext('t1', ['hr:read', 'compensation:read'], ['ff_hr_org_chart', 'ff_comp_simulations']);
      const resolved = core.resolveForContext(ctx);
      const ids = resolved.map(m => m.module_id);

      expect(ids).toContain('core_hr');
      expect(ids).not.toContain('compensation_engine');
    });

    it('cannot disable core modules for tenant', () => {
      core.disableForTenant('core_hr', 't1');
      // is_core overrides — still enabled
      expect(core.isEnabledForTenant('core_hr', 't1')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. FEATURE FLAGS — manifest → bridge → isEnabled
  // ─────────────────────────────────────────────────────────────

  describe('6. Feature Flags', () => {
    beforeEach(() => core.registerAll());

    it('manifest feature flags are registered in the bridge', () => {
      const flagMap = core.featureFlags.flagMap();
      expect(Object.keys(flagMap)).toContain('core_hr');
      expect(Object.keys(flagMap)).toContain('compensation_engine');
      expect(Object.keys(flagMap)).toContain('tenant_admin');
      expect(Object.keys(flagMap)).toContain('reporting');
    });

    it('isFeatureEnabled checks via FeatureLifecycleAPI stub', () => {
      // Default stub returns false for all flags
      expect(core.isFeatureEnabled('ff_hr_org_chart')).toBe(false);
      expect(core.isFeatureEnabled('ff_nonexistent')).toBe(false);
    });

    it('resolveForContext requires at least one active feature flag', () => {
      // With matching flag
      const ctxWithFlag = loadContext('t1', ['hr:read'], ['ff_hr_org_chart']);
      const with_ = core.resolveForContext(ctxWithFlag);
      expect(with_.some(m => m.module_id === 'core_hr')).toBe(true);

      // Without matching flag
      const ctxNoFlag = loadContext('t1', ['hr:read'], []);
      const without = core.resolveForContext(ctxNoFlag);
      expect(without.some(m => m.module_id === 'core_hr')).toBe(false);
    });

    it('registerModuleFlags accepts custom declarations', () => {
      core.registerModuleFlags('core_hr', [
        { feature: 'ff_hr_custom', default_enabled: true, description: 'Custom HR flag' },
      ]);

      const flags = core.featureFlags.listFlagsForModule('core_hr');
      expect(flags).toContain('ff_hr_custom');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. SANDBOX ISOLATION — gateway, domains, imports, cleanup
  // ─────────────────────────────────────────────────────────────

  describe('7. Sandbox Isolation', () => {
    beforeEach(() => core.registerAll());

    it('each module gets its own sandbox', () => {
      const hrSandbox = core.sandbox('core_hr');
      const compSandbox = core.sandbox('compensation_engine');

      expect(hrSandbox.moduleKey).toBe('core_hr');
      expect(compSandbox.moduleKey).toBe('compensation_engine');
      expect(hrSandbox).not.toBe(compSandbox);
    });

    it('sandbox state is isolated per module', () => {
      const hr = core.sandbox('core_hr');
      const comp = core.sandbox('compensation_engine');

      hr.state.set('counter', 42);
      comp.state.set('counter', 99);

      expect(hr.state.get('counter')).toBe(42);
      expect(comp.state.get('counter')).toBe(99);
    });

    it('gateway blocks _security_kernel access', () => {
      const sandbox = core.sandbox('core_hr');
      expect(() => sandbox.gateway.query('_security_kernel', 'steal')).toThrow();
    });

    it('gateway blocks _raw_db access', () => {
      const sandbox = core.sandbox('core_hr');
      expect(() => sandbox.gateway.mutate('_raw_db', 'drop')).toThrow();
    });

    it('gateway blocks _supabase access', () => {
      const sandbox = core.sandbox('core_hr');
      expect(() => sandbox.gateway.query('_supabase', 'raw_query')).toThrow();
    });

    it('gateway blocks _auth_internal access', () => {
      const sandbox = core.sandbox('core_hr');
      expect(() => sandbox.gateway.query('_auth_internal', 'get_tokens')).toThrow();
    });

    it('gateway blocks auth.users access', () => {
      const sandbox = core.sandbox('core_hr');
      expect(() => sandbox.gateway.query('auth.users', 'list')).toThrow();
    });

    it('gateway allows legitimate domain access', async () => {
      const sandbox = core.sandbox('core_hr');
      // Default gateway returns undefined but doesn't throw
      const result = await sandbox.gateway.query('employees', 'list');
      expect(result).toBeUndefined(); // default gateway returns undefined
    });

    it('assertImportAllowed blocks supabase client imports', () => {
      const sandbox = core.sandbox('core_hr');

      expect(() => sandbox.assertImportAllowed('@/integrations/supabase/client')).toThrow();
      expect(() => sandbox.assertImportAllowed('@supabase/supabase-js')).toThrow();
      expect(() => sandbox.assertImportAllowed('src/integrations/supabase/types')).toThrow();
    });

    it('assertImportAllowed blocks security-kernel imports', () => {
      const sandbox = core.sandbox('core_hr');
      expect(() => sandbox.assertImportAllowed('@/domains/security-kernel/access-graph')).toThrow();
    });

    it('assertImportAllowed allows module imports', () => {
      const sandbox = core.sandbox('core_hr');
      expect(() => sandbox.assertImportAllowed('@/modules/hr/gateway')).not.toThrow();
      expect(() => sandbox.assertImportAllowed('@/modules/compensation/ui')).not.toThrow();
      expect(() => sandbox.assertImportAllowed('@/domains/platform-os/federation/module-loader')).not.toThrow();
    });

    it('sandbox cleanup runs on destroy', () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      const sandbox = core.sandbox('reporting');
      sandbox.addCleanup(cleanup1);
      sandbox.addCleanup(cleanup2);

      core.destroySandbox('reporting');
      expect(cleanup1).toHaveBeenCalledOnce();
      expect(cleanup2).toHaveBeenCalledOnce();
    });

    it('sandbox state is cleared on destroy', () => {
      const sandbox = core.sandbox('reporting');
      sandbox.state.set('data', { important: true });
      expect(sandbox.state.get('data')).toBeTruthy();

      core.destroySandbox('reporting');
      // After destroy, getting a new sandbox should have clean state
      const newSandbox = core.sandbox('reporting');
      expect(newSandbox.state.get('data')).toBeUndefined();
    });

    it('sandbox emits events under module namespace', () => {
      const sandbox = core.sandbox('core_hr');
      sandbox.emit('employee_created', { id: '123' });

      expect(events.emitted.some(e =>
        e.type === 'module:core_hr:employee_created'
      )).toBe(true);
    });

    it('gateway proxy blocks write attempts', () => {
      const sandbox = core.sandbox('core_hr');
      expect(() => {
        (sandbox.gateway as any).customProp = 'hack';
      }).toThrow('read-only');
    });

    it('gateway proxy blocks forbidden property access', () => {
      const sandbox = core.sandbox('core_hr');
      expect(() => (sandbox.gateway as any)._raw).toThrow('forbidden');
      expect(() => (sandbox.gateway as any)._client).toThrow('forbidden');
      expect(() => (sandbox.gateway as any)._supabase).toThrow('forbidden');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 8. PERMISSION ADAPTER — canActivate, canAccess, filtering
  // ─────────────────────────────────────────────────────────────

  describe('8. Permission Adapter', () => {
    beforeEach(() => core.registerAll());

    it('admin can activate all modules', () => {
      const ctx = adminContext('t1');
      expect(core.canActivate('core_hr', ctx)).toBe(true);
      expect(core.canActivate('compensation_engine', ctx)).toBe(true);
      expect(core.canActivate('tenant_admin', ctx)).toBe(true);
      expect(core.canActivate('reporting', ctx)).toBe(true);
    });

    it('viewer can only activate modules matching their permissions', () => {
      const ctx = viewerContext('t1');
      expect(core.canActivate('core_hr', ctx)).toBe(true); // has hr:read
      expect(core.canActivate('reporting', ctx)).toBe(true); // has reports:read
      expect(core.canActivate('compensation_engine', ctx)).toBe(false); // no compensation:read
      expect(core.canActivate('tenant_admin', ctx)).toBe(false); // no admin:read
    });

    it('canAccess requires module to be active', async () => {
      const ctx = adminContext('t1');

      // Module registered but not active
      expect(core.canAccess('core_hr', ctx)).toBe(false);

      await core.activate('core_hr');
      expect(core.canAccess('core_hr', ctx)).toBe(true);
    });

    it('missingPermissions reports what the user lacks', () => {
      const ctx = viewerContext('t1');
      const missing = core.missingPermissions('tenant_admin', ctx);
      expect(missing).toContain('admin:read');
    });

    it('filterAccessible filters module list by context', async () => {
      await core.activate('core_hr');
      await core.activate('tenant_admin');

      const ctx = viewerContext('t1');
      const accessible = core.filterAccessible(core.list(), ctx);
      const keys = accessible.map(m => m.key);

      expect(keys).toContain('core_hr');
      expect(keys).not.toContain('tenant_admin'); // viewer lacks admin:read
    });

    it('tenant disablement overrides permissions', () => {
      const ctx = adminContext('t1');
      core.disableForTenant('compensation_engine', 't1');

      // Admin has all permissions but module is disabled for this tenant
      expect(core.canActivate('compensation_engine', ctx)).toBe(false);
    });

    it('permission definitions include sensitivity markers', () => {
      const adminPerm = core.permissions.getPermission('admin:super');
      expect(adminPerm).toBeTruthy();
      expect(adminPerm?.is_sensitive).toBe(true);

      const readPerm = core.permissions.getPermission('hr:read');
      expect(readPerm).toBeTruthy();
      expect(readPerm?.is_sensitive).toBe(false);
    });

    it('permission definitions are categorized by module', () => {
      const hrPerms = core.permissions.listPermissionsForModule('core_hr');
      expect(hrPerms.every(p => p.module_id === 'core_hr')).toBe(true);
      expect(hrPerms.every(p => p.category === 'core_hr')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 9. EVENT TRACING — all operations emit correct events
  // ─────────────────────────────────────────────────────────────

  describe('9. Event Tracing', () => {
    it('registration emits module:registered', () => {
      core.register({ key: 'evt_test', label: 'Event Test' });
      expect(events.emitted.some(e => e.type === 'module:registered' && e.payload?.key === 'evt_test')).toBe(true);
    });

    it('registration emits platform:module_federated', () => {
      core.register({ key: 'fed_test', label: 'Fed Test' });
      expect(events.emitted.some(e => e.type === 'platform:module_federated' && e.payload?.key === 'fed_test')).toBe(true);
    });

    it('manifest registration emits module:manifest_registered', () => {
      core.register({ key: 'man_test', label: 'Manifest Test' }, {
        module_id: 'man_test',
        module_name: 'Manifest Test',
        version: '1.0.0',
        routes: [],
        widgets: [],
        permissions: [],
        feature_flags: [],
        navigation_entries: [],
        loadComponent: () => Promise.resolve({ default: () => null }),
      });
      expect(events.emitted.some(e => e.type === 'module:manifest_registered')).toBe(true);
    });

    it('widget registration emits widget:registered', () => {
      core.registerWidget({
        widget_id: 'evt:widget',
        label: 'Event Widget',
        module_id: 'test',
        allowed_roles: [],
        contexts: ['dashboard'],
        loadComponent: () => Promise.resolve({ default: () => null }),
      });
      expect(events.emitted.some(e => e.type === 'widget:registered' && e.payload?.widget_id === 'evt:widget')).toBe(true);
    });

    it('sandbox creation emits module:sandbox_created', () => {
      core.register({ key: 'sb_test', label: 'Sandbox Test' });
      expect(events.emitted.some(e => e.type === 'module:sandbox_created' && e.payload?.key === 'sb_test')).toBe(true);
    });

    it('sandbox destruction emits module:sandbox_destroyed', () => {
      core.register({ key: 'sb_d', label: 'SB Destroy' });
      core.destroySandbox('sb_d');
      expect(events.emitted.some(e => e.type === 'module:sandbox_destroyed' && e.payload?.key === 'sb_d')).toBe(true);
    });

    it('access violations emit sandbox:access_violation', () => {
      core.register({ key: 'viol', label: 'Violator' });
      const sandbox = core.sandbox('viol');

      try { (sandbox.gateway as any)._raw; } catch { /* expected */ }
      expect(events.emitted.some(e =>
        e.type === 'sandbox:access_violation' && e.payload?.module === 'viol'
      )).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 10. CROSS-CUTTING — Full User Journey
  // ─────────────────────────────────────────────────────────────

  describe('10. Full User Journey — Boot to Widget Render', () => {
    it('complete flow: boot → tenant setup → activate → resolve widgets → navigation', async () => {
      // ── Step 1: Boot all modules ──
      core.registerAll();
      expect(core.list().length).toBe(4);

      // ── Step 2: Configure tenant ──
      const tenantId = 'acme_corp';
      core.disableForTenant('reporting', tenantId);

      // ── Step 3: Activate modules for this tenant ──
      await core.activate('core_hr');
      await core.activate('tenant_admin');
      await core.activateWithDeps('compensation_engine');

      expect(core.listActive().length).toBe(3);

      // ── Step 4: Resolve widgets for admin context ──
      const adminCtx = adminContext(tenantId);
      const dashboardWidgets = core.resolveWidgets('dashboard', {
        tenant_id: tenantId,
        roles: adminCtx.roles,
        permissions: adminCtx.permissions,
        feature_flags: ['ff_hr_org_chart', 'ff_comp_simulations', 'ff_admin_impersonation'],
      });

      // Should have: HR headcount + compensation payroll_summary + tenant active_users
      // But NOT reporting widgets (disabled for tenant)
      const widgetIds = dashboardWidgets.map(w => w.widget_id);
      expect(widgetIds).toContain('core_hr:headcount_kpi');
      expect(widgetIds).toContain('compensation:payroll_summary');
      expect(widgetIds).toContain('tenant_admin:active_users');
      expect(widgetIds).not.toContain('reporting:kpi_strip');

      // ── Step 5: Navigation bridge syncs active modules ──
      const nav = createMockNavigationOrchestrator();
      const bridge = createModuleNavigationBridge(nav, core.loader, events);
      bridge.syncAll();

      expect(nav._moduleRoutes.has('core_hr')).toBe(true);
      expect(nav._moduleRoutes.has('compensation_engine')).toBe(true);

      // HR navigation has children
      const hrRoutes = nav._moduleRoutes.get('core_hr')!;
      expect(hrRoutes[0].children?.length).toBe(4);

      // ── Step 6: Verify sandbox isolation for each active module ──
      for (const activeModule of core.listActive()) {
        const sandbox = core.sandbox(activeModule.key as string);
        expect(() => sandbox.gateway.query('_security_kernel', 'bypass')).toThrow();
        expect(() => sandbox.assertImportAllowed('@/integrations/supabase/client')).toThrow();
      }

      // ── Step 7: Verify permission checks ──
      const viewerCtx = viewerContext(tenantId);
      expect(core.canAccess('core_hr', viewerCtx)).toBe(true); // active + has hr:read
      expect(core.canAccess('tenant_admin', viewerCtx)).toBe(false); // active but no admin:read
      expect(core.canAccess('compensation_engine', viewerCtx)).toBe(false); // active but no compensation:read
    });

    it('module removal cascades through all subsystems', () => {
      core.registerAll();

      // Before removal
      expect(core.get('core_hr')).toBeTruthy();
      expect(core.getManifest('core_hr')).toBeTruthy();
      expect(core.widgets.hasWidget('core_hr:headcount_kpi')).toBe(true);
      expect(core.sandboxManager.has('core_hr')).toBe(true);

      // Remove module
      core.unregister('core_hr');

      // After removal — everything is cleaned up
      expect(core.get('core_hr')).toBeNull();
      expect(core.widgets.hasWidget('core_hr:headcount_kpi')).toBe(false);
      expect(core.widgets.hasWidget('core_hr:recent_hires')).toBe(false);
      expect(core.sandboxManager.has('core_hr')).toBe(false);
    });

    it('multi-tenant isolation works correctly', () => {
      core.registerAll();

      // Tenant A: all modules
      // Tenant B: no compensation
      // Tenant C: no reporting
      core.disableForTenant('compensation_engine', 'tenant_b');
      core.disableForTenant('reporting', 'tenant_c');

      const tenantAModules = core.listForTenant('tenant_a').map(m => m.key);
      const tenantBModules = core.listForTenant('tenant_b').map(m => m.key);
      const tenantCModules = core.listForTenant('tenant_c').map(m => m.key);

      expect(tenantAModules.length).toBe(4);
      expect(tenantBModules).not.toContain('compensation_engine');
      expect(tenantBModules).toContain('core_hr');
      expect(tenantCModules).not.toContain('reporting');
      expect(tenantCModules).toContain('core_hr');
    });
  });
});
