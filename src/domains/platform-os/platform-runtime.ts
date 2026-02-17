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

import type { PlatformRuntimeAPI, RuntimeStatus, RuntimePhase, RuntimeHealthCheck, AuthorizationRequest, AuthorizationResult } from './types';
import { createGlobalEventKernel } from './global-event-kernel';
import { createServiceRegistry } from './service-registry';
import { createModuleOrchestrator } from './module-orchestrator';
import { createIdentityOrchestrator } from './identity-orchestrator';
import { createNavigationOrchestrator } from './navigation-orchestrator';
import { createFeatureLifecycleManager } from './feature-lifecycle-manager';
import { createCognitiveOrchestrator } from './cognitive-orchestrator';
import { CognitiveInsightsService } from '@/domains/platform-cognitive/cognitive-insights.service';
import { installEventBridges } from './event-bridges';
import { PLATFORM_EVENTS } from './platform-events';
import { createPlatformExperienceEngine } from '@/domains/platform-experience';
import { createPlatformBillingCore } from '@/domains/billing-core';
import type { PlatformBootstrappedPayload } from './platform-events';
import { getSelfHealingEngine } from '@/domains/self-healing';
import { getControlPlaneEngine } from '@/domains/control-plane/control-plane-engine';

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
  executeSecurityPipeline,
  buildSecurityContext,
} from '@/domains/security/kernel';
import type { PermissionAction, PermissionEntity } from '@/domains/security/permissions';

// ── Identity Intelligence ────────────────────────────────────────
import { identityIntelligence } from '@/domains/security/kernel/identity-intelligence';

export function createPlatformRuntime(): PlatformRuntimeAPI {
  let phase: RuntimePhase = 'idle';
  let bootedAt: number | null = null;
  let bootPromise: Promise<void> | null = null;
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

  // ── Platform Experience Engine (PXE) ────────────────────────
  const experience = createPlatformExperienceEngine();

  // ── Platform Billing Core ──────────────────────────────────
  const billing = createPlatformBillingCore(experience, modules);

  // ── Lifecycle ────────────────────────────────────────────────

  async function boot(): Promise<void> {
    if (phase === 'ready') return;
    // Deduplicate concurrent boot calls — return existing promise
    if (phase === 'booting' && bootPromise) return bootPromise;

    phase = 'booting';
    bootPromise = doBoot();
    return bootPromise;
  }

  async function doBoot(): Promise<void> {
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

      // ── 6. Register PXE sub-systems ──────────────────────────
      services.register('PXE.PlanRegistry', experience.plans, {
        version: '1.0.0',
        capabilities: ['pxe:plan-catalog', 'pxe:plan-lookup'],
      });
      services.register('PXE.PlanLifecycleManager', experience.lifecycle, {
        version: '1.0.0',
        capabilities: ['pxe:plan-transition', 'pxe:plan-status'],
      });
      services.register('PXE.TenantPlanResolver', experience.tenantPlan, {
        version: '1.0.0',
        capabilities: ['pxe:tenant-plan-resolve', 'pxe:module-access-check'],
      });
      services.register('PXE.PaymentPolicyEngine', experience.payment, {
        version: '1.0.0',
        capabilities: ['pxe:payment-policy', 'pxe:proration'],
      });
      services.register('PXE.ModuleAccessResolver', experience.moduleAccess, {
        version: '1.0.0',
        capabilities: ['pxe:module-access', 'pxe:upgrade-prompt'],
      });
      services.register('PXE.ExperienceOrchestrator', experience.experience, {
        version: '1.0.0',
        capabilities: ['pxe:experience-profile', 'pxe:navigation-gate'],
      });

      // ── 4b. Register BillingCore sub-systems ─────────────────
      services.register('BillingCore.Calculator', billing.calculator, {
        version: '1.0.0',
        capabilities: ['billing:calculate', 'billing:proration', 'billing:plan-change'],
      });
      services.register('BillingCore.InvoiceEngine', billing.invoices, {
        version: '1.0.0',
        capabilities: ['billing:invoice-generate', 'billing:invoice-manage'],
      });
      services.register('BillingCore.Ledger', billing.ledger, {
        version: '1.0.0',
        capabilities: ['billing:ledger-record', 'billing:ledger-query'],
      });
      services.register('BillingCore.Revenue', billing.revenue, {
        version: '1.0.0',
        capabilities: ['billing:revenue-metrics', 'billing:mrr', 'billing:forecast'],
      });
      services.register('BillingCore.SubscriptionLifecycle', billing.subscriptionLifecycle, {
        version: '1.0.0',
        capabilities: ['billing:activate', 'billing:upgrade', 'billing:downgrade', 'billing:cancel'],
      });

      // ── 5. Install ALL domain event bridges → GlobalEventKernel
      const teardownBridges = installEventBridges(events);
      disposers.push(teardownBridges);

      // ── 6. Start Self-Healing Engine ──────────────────────────
      const selfHealing = getSelfHealingEngine(events, modules);
      selfHealing.start();
      services.register('SelfHealingEngine', selfHealing, {
        version: '1.0.0',
        capabilities: ['self-healing:detect', 'self-healing:recover', 'self-healing:circuit-break'],
        required_permissions: ['platform:monitoring:read'],
      });
      disposers.push(() => selfHealing.stop());

      // ── 7. Start Autonomous Control Plane ─────────────────────
      const controlPlane = getControlPlaneEngine({
        boot, shutdown, status, authorize, events, services, modules,
        identity, navigation, features, cognitive, experience,
      } as any);
      controlPlane.start();
      services.register('AutonomousControlPlane', controlPlane, {
        version: '1.0.0',
        capabilities: ['apcp:state', 'apcp:automation', 'apcp:actions', 'apcp:risk', 'apcp:modules', 'apcp:identity'],
        required_permissions: ['platform:monitoring:read'],
      });
      disposers.push(() => controlPlane.stop());

      bootedAt = Date.now();
      phase = 'ready';
      events.emit('runtime:ready', 'PlatformRuntime', { booted_at: bootedAt });

      // ── Canonical: PlatformBootstrapped ─────────────────────
      events.emit<PlatformBootstrappedPayload>(
        PLATFORM_EVENTS.PlatformBootstrapped,
        'PlatformRuntime',
        {
          booted_at: bootedAt,
          services_count: services.list().length,
          modules_count: modules.list().length,
        },
        { priority: 'high' },
      );

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

  // ── Security delegation ──────────────────────────────────────
  // INVARIANT: POSL NEVER evaluates permissions directly.
  // All authorization flows go through the SecurityKernel pipeline.

  function authorize(request: AuthorizationRequest): AuthorizationResult {
    // Resolve current SecurityContext from the identity orchestrator
    // POSL does NOT evaluate permissions — it delegates entirely.
    const snapshot = identity.snapshot();

    // If not authenticated, pipeline will deny at Stage 2
    const ctx = snapshot.is_authenticated
      ? services.resolve<any>('SecurityKernel.PermissionEngine')
        ? (identityBoundary as any)._sessionManager?.session
          ? buildSecurityContextFromSnapshot(snapshot)
          : null
        : null
      : null;

    const result = executeSecurityPipeline({
      action: request.action as PermissionAction,
      resource: request.resource as PermissionEntity,
      ctx,
      target: request.target ? {
        tenant_id: request.target.tenant_id ?? '',
        company_group_id: request.target.company_group_id ?? null,
        company_id: request.target.company_id ?? null,
      } : undefined,
      skipAccessGraph: request.skipAccessGraph,
      skipPolicy: request.skipPolicy,
      skipAudit: request.skipAudit,
    });

    return {
      allowed: result.decision === 'allow',
      reason: result.reason,
      deniedBy: result.deniedBy,
      requestId: result.requestId,
    };
  }

  /**
   * Build a minimal SecurityContext from the OperationalIdentitySnapshot.
   * This is a read-only mapping — no permission logic here.
   */
  function buildSecurityContextFromSnapshot(snapshot: import('./types').OperationalIdentitySnapshot) {
    return {
      user_id: snapshot.user_id ?? '',
      tenant_id: snapshot.current_tenant_id ?? '',
      user_type: snapshot.is_platform_admin ? 'platform' as const : 'tenant' as const,
      roles: snapshot.effective_roles ? [...snapshot.effective_roles] : [],
      request_id: `posl-${Date.now().toString(36)}`,
      meta: {
        scopeResolution: {
          tenantId: snapshot.current_tenant_id ?? '',
          uiScope: {
            level: snapshot.scope_level ?? 'tenant',
            groupId: snapshot.current_group_id ?? null,
            companyId: snapshot.current_company_id ?? null,
          },
          effectiveScope: {
            level: snapshot.scope_level ?? 'tenant',
            groupId: snapshot.current_group_id ?? null,
            companyId: snapshot.current_company_id ?? null,
          },
        },
      },
    } as any;
  }

  return {
    boot,
    shutdown,
    status,
    authorize,
    events,
    services,
    modules,
    identity,
    navigation,
    features,
    cognitive,
    experience,
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
