/**
 * PlatformRuntime — Central orchestrator of the Platform Operating System Layer.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PlatformOS                                                     ║
 * ║   ├── PlatformRuntime          (lifecycle + facade)             ║
 * ║   ├── GlobalEventKernel        (unified event bus)              ║
 * ║   ├── ServiceRegistry          (IoC container)                  ║
 * ║   ├── ModuleOrchestrator       (module lifecycle)               ║
 * ║   ├── IdentityOrchestrator     (identity state)                 ║
 * ║   ├── NavigationOrchestrator   (route + breadcrumb state)       ║
 * ║   ├── FeatureLifecycleManager  (feature flags + phases)         ║
 * ║   └── CognitiveOrchestrator    (AI + behavior tracking)         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Boot sequence initialises:
 *   1. SecurityKernel services (permissionEngine, policyEngine, etc.)
 *   2. IdentityIntelligence (FSM, workspace resolver, risk engine)
 *   3. AccessGraph service + cache
 *   4. Module Federation (ModuleOrchestrator)
 *   5. Navigation Intelligence (NavigationOrchestrator + cognitive)
 *
 * SECURITY CONTRACT:
 *   The POSL does NOT replace the Security Kernel. All permission
 *   checks, scope resolution, and policy evaluation still flow
 *   through the Kernel. The POSL provides a unified runtime
 *   surface for coordination, not authorization.
 */

import type { PlatformRuntimeAPI, RuntimeStatus, RuntimePhase, RuntimeHealthCheck } from './types';
import { createGlobalEventKernel } from './global-event-kernel';
import { createServiceRegistry } from './service-registry';
import { createModuleOrchestrator } from './module-orchestrator';
import { createIdentityOrchestrator } from './identity-orchestrator';
import { createNavigationOrchestrator } from './navigation-orchestrator';
import { createFeatureLifecycleManager } from './feature-lifecycle-manager';
import { createCognitiveOrchestrator } from './cognitive-orchestrator';
import { CognitiveInsightsService } from '@/domains/platform-cognitive/cognitive-insights.service';
import { installEventBridges } from './event-bridges';

// ── Security Kernel imports ──────────────────────────────────────
import {
  permissionEngine,
  policyEngine,
  featureFlagEngine,
  auditSecurity,
  accessGraphService,
  accessGraphCache,
  identityBoundary,
  dualIdentityEngine,
} from '@/domains/security/kernel';

// ── Identity Intelligence ────────────────────────────────────────
import { identityIntelligence } from '@/domains/security/kernel/identity-intelligence';

export function createPlatformRuntime(): PlatformRuntimeAPI {
  let phase: RuntimePhase = 'idle';
  let bootedAt: number | null = null;
  const disposers: Array<() => void> = [];

  // ── Sub-systems ──────────────────────────────────────────────
  const events = createGlobalEventKernel();
  const services = createServiceRegistry();
  const modules = createModuleOrchestrator(events);
  const identity = createIdentityOrchestrator(events);
  const navigation = createNavigationOrchestrator(events);
  const features = createFeatureLifecycleManager(events);

  // Cognitive needs a service instance
  const cognitiveService = new CognitiveInsightsService();
  const cognitive = createCognitiveOrchestrator(events, cognitiveService);

  // ── Lifecycle ────────────────────────────────────────────────

  async function boot(): Promise<void> {
    if (phase === 'ready') return;

    phase = 'booting';
    events.emit('runtime:booting', 'PlatformRuntime', {});

    try {
      // ── 1. Register Security Kernel services ──────────────────
      services.register('SecurityKernel.PermissionEngine', permissionEngine, {
        version: '1.0.0',
        capabilities: ['auth:check-permission', 'auth:evaluate-access'],
        required_permissions: ['platform:security:read'],
      });
      services.register('SecurityKernel.PolicyEngine', policyEngine, {
        version: '1.0.0',
        capabilities: ['auth:evaluate-policy', 'auth:enforce-rules'],
        required_permissions: ['platform:security:read'],
      });
      services.register('SecurityKernel.FeatureFlagEngine', featureFlagEngine, {
        version: '1.0.0',
        capabilities: ['feature:evaluate', 'feature:toggle'],
        required_permissions: ['platform:features:read'],
      });
      services.register('SecurityKernel.AuditSecurity', auditSecurity, {
        version: '1.0.0',
        capabilities: ['audit:log', 'audit:query'],
        required_permissions: ['platform:audit:read'],
      });
      services.register('SecurityKernel.IdentityBoundary', identityBoundary, {
        version: '1.0.0',
        capabilities: ['identity:resolve', 'identity:context-switch', 'identity:scope-validate'],
        required_permissions: ['platform:identity:read'],
      });
      services.register('SecurityKernel.DualIdentityEngine', dualIdentityEngine, {
        version: '1.0.0',
        capabilities: ['identity:impersonate', 'identity:end-impersonation'],
        required_permissions: ['platform:identity:impersonate'],
      });

      // ── 2. Register Identity Intelligence ─────────────────────
      services.register('IdentityIntelligence', identityIntelligence, {
        version: '1.0.0',
        dependencies: ['SecurityKernel.IdentityBoundary', 'SecurityKernel.DualIdentityEngine'],
        capabilities: ['intelligence:detect-user-type', 'intelligence:risk-assess', 'intelligence:workspace-resolve'],
        required_permissions: ['platform:identity:read'],
      });

      // ── 3. Register AccessGraph service + cache ───────────────
      services.register('SecurityKernel.AccessGraphService', accessGraphService, {
        version: '1.0.0',
        capabilities: ['graph:build', 'graph:check-access', 'graph:inherit-scopes'],
        required_permissions: ['platform:security:read'],
      });
      services.register('SecurityKernel.AccessGraphCache', accessGraphCache, {
        version: '1.0.0',
        capabilities: ['graph:cache-get', 'graph:cache-invalidate'],
        required_permissions: ['platform:security:read'],
      });

      // ── 4. Register POSL orchestrators ────────────────────────
      services.register('EventKernel', events, {
        version: '1.0.0',
        capabilities: ['events:emit', 'events:subscribe', 'events:stats'],
      });
      services.register('ModuleOrchestrator', modules, {
        version: '1.0.0',
        capabilities: ['module:register', 'module:activate', 'module:deactivate', 'module:list'],
      });
      services.register('IdentityOrchestrator', identity, {
        version: '1.0.0',
        dependencies: ['SecurityKernel.IdentityBoundary', 'IdentityIntelligence'],
        capabilities: ['identity:snapshot', 'identity:refresh', 'identity:observe'],
      });
      services.register('NavigationOrchestrator', navigation, {
        version: '1.0.0',
        capabilities: ['navigation:navigate', 'navigation:register-routes', 'navigation:suggest'],
      });
      services.register('FeatureLifecycleManager', features, {
        version: '1.0.0',
        dependencies: ['SecurityKernel.FeatureFlagEngine'],
        capabilities: ['feature:register', 'feature:check', 'feature:toggle', 'feature:lifecycle'],
      });
      services.register('CognitiveOrchestrator', cognitive, {
        version: '1.0.0',
        capabilities: ['cognitive:track-navigation', 'cognitive:track-module', 'cognitive:insights'],
      });
      services.register('CognitiveInsightsService', cognitiveService, {
        version: '1.0.0',
        capabilities: ['cognitive:generate-insights', 'cognitive:role-suggestion', 'cognitive:permission-risk'],
      });

      // ── 5. Install ALL domain event bridges → GlobalEventKernel
      const teardownBridges = installEventBridges(events);
      disposers.push(teardownBridges);

      bootedAt = Date.now();
      phase = 'ready';
      events.emit('runtime:ready', 'PlatformRuntime', { booted_at: bootedAt });

      console.info('[PlatformOS] Runtime ready', {
        services: services.list().length,
        securityKernel: 'initialized',
        identityIntelligence: 'initialized',
        accessGraph: 'initialized',
        moduleFederation: `${modules.list().length} modules`,
        navigationIntelligence: 'initialized',
      });
    } catch (err) {
      phase = 'degraded';
      events.emit('runtime:error', 'PlatformRuntime', { error: String(err) });
      console.error('[PlatformOS] Boot failed:', err);
      throw err;
    }
  }

  function shutdown(): void {
    phase = 'shutting_down';
    events.emit('runtime:shutdown', 'PlatformRuntime', {});

    // Tear down event bridges
    disposers.forEach(fn => fn());
    disposers.length = 0;

    // Dispose all services
    for (const svc of services.list()) {
      services.dispose(svc.name);
    }

    phase = 'idle';
    bootedAt = null;
  }

  function status(): RuntimeStatus {
    const healthChecks: RuntimeHealthCheck[] = [
      {
        name: 'SecurityKernel',
        status: services.has('SecurityKernel.PermissionEngine') ? 'ok' : 'fail',
        checked_at: Date.now(),
      },
      {
        name: 'IdentityIntelligence',
        status: services.has('IdentityIntelligence') ? 'ok' : 'warn',
        checked_at: Date.now(),
      },
      {
        name: 'AccessGraph',
        status: services.has('SecurityKernel.AccessGraphService') ? 'ok' : 'warn',
        checked_at: Date.now(),
      },
      {
        name: 'EventKernel',
        status: events.stats().active_subscriptions >= 0 ? 'ok' : 'warn',
        message: `${events.stats().total_emitted} emitted, ${events.stats().active_subscriptions} subs`,
        checked_at: Date.now(),
      },
      {
        name: 'ServiceRegistry',
        status: services.list().every(s => s.status === 'ready' || s.status === 'registered') ? 'ok' : 'warn',
        message: `${services.list().length} services`,
        checked_at: Date.now(),
      },
      {
        name: 'ModuleFederation',
        status: modules.list().every(m => m.status !== 'error') ? 'ok' : 'warn',
        message: `${modules.listActive().length} active / ${modules.list().length} total`,
        checked_at: Date.now(),
      },
      {
        name: 'NavigationIntelligence',
        status: services.has('NavigationOrchestrator') ? 'ok' : 'warn',
        checked_at: Date.now(),
      },
    ];

    const failedChecks = healthChecks.filter(c => c.status === 'fail');
    const warnChecks = healthChecks.filter(c => c.status === 'warn');

    return {
      phase,
      booted_at: bootedAt,
      uptime_ms: bootedAt ? Date.now() - bootedAt : 0,
      registered_modules: modules.list().length,
      registered_services: services.list().length,
      active_subscriptions: events.stats().active_subscriptions,
      health: {
        overall: failedChecks.length > 0 ? 'unhealthy' : warnChecks.length > 0 ? 'degraded' : 'healthy',
        checks: healthChecks,
      },
    };
  }

  return {
    boot,
    shutdown,
    status,
    events,
    services,
    modules,
    identity,
    navigation,
    features,
    cognitive,
  };
}

// ══════════════════════════════════════════════════════════════════
// Singleton
// ══════════════════════════════════════════════════════════════════

let _runtime: PlatformRuntimeAPI | null = null;

export function getPlatformRuntime(): PlatformRuntimeAPI {
  if (!_runtime) {
    _runtime = createPlatformRuntime();
  }
  return _runtime;
}

/** Reset runtime (testing only) */
export function resetPlatformRuntime(): void {
  if (_runtime) {
    _runtime.shutdown();
    _runtime = null;
  }
}
