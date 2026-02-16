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

export function createPlatformRuntime(): PlatformRuntimeAPI {
  let phase: RuntimePhase = 'idle';
  let bootedAt: number | null = null;

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
      // Register core services
      services.register('EventKernel', events, { version: '1.0.0' });
      services.register('ModuleOrchestrator', modules, { version: '1.0.0' });
      services.register('IdentityOrchestrator', identity, { version: '1.0.0' });
      services.register('NavigationOrchestrator', navigation, { version: '1.0.0' });
      services.register('FeatureLifecycleManager', features, { version: '1.0.0' });
      services.register('CognitiveOrchestrator', cognitive, { version: '1.0.0' });
      services.register('CognitiveInsightsService', cognitiveService, { version: '1.0.0' });

      bootedAt = Date.now();
      phase = 'ready';
      events.emit('runtime:ready', 'PlatformRuntime', { booted_at: bootedAt });

      console.info('[PlatformOS] Runtime ready', {
        services: services.list().length,
        uptime: 0,
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
        name: 'EventKernel',
        status: events.stats().active_subscriptions >= 0 ? 'ok' : 'warn',
        checked_at: Date.now(),
      },
      {
        name: 'ServiceRegistry',
        status: services.list().every(s => s.status === 'ready' || s.status === 'registered') ? 'ok' : 'warn',
        checked_at: Date.now(),
      },
      {
        name: 'Modules',
        status: modules.list().every(m => m.status !== 'error') ? 'ok' : 'warn',
        message: `${modules.listActive().length} active / ${modules.list().length} total`,
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
