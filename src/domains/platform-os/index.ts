/**
 * Platform Operating System Layer (POSL) — Barrel Export
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  POSL — Núcleo operacional central do SaaS                     ║
 * ║                                                                 ║
 * ║  Orquestra: Módulos, Identidade, Navegação, Segurança,         ║
 * ║  Eventos, Cognitive Layer e Feature Flags.                      ║
 * ║                                                                 ║
 * ║  PlatformOS                                                     ║
 * ║   ├── PlatformRuntime          ← Lifecycle + Facade             ║
 * ║   ├── GlobalEventKernel        ← Unified Event Bus             ║
 * ║   ├── ServiceRegistry          ← IoC Container                 ║
 * ║   ├── ModuleOrchestrator       ← Module Lifecycle              ║
 * ║   ├── IdentityOrchestrator     ← Identity State                ║
 * ║   ├── NavigationOrchestrator   ← Route + Breadcrumb State      ║
 * ║   ├── FeatureLifecycleManager  ← Feature Flags + Phases        ║
 * ║   └── CognitiveOrchestrator    ← AI + Behavior Tracking        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ── Runtime (main entry point) ────────────────────────────────
export { createPlatformRuntime, getPlatformRuntime, resetPlatformRuntime } from './platform-runtime';

// ── Sub-systems ───────────────────────────────────────────────
export { createGlobalEventKernel } from './global-event-kernel';
export { createServiceRegistry } from './service-registry';
export { createModuleOrchestrator } from './module-orchestrator';
export { createIdentityOrchestrator } from './identity-orchestrator';
export { createNavigationOrchestrator } from './navigation-orchestrator';
export { createFeatureLifecycleManager } from './feature-lifecycle-manager';
export { createCognitiveOrchestrator } from './cognitive-orchestrator';

// ── Types ─────────────────────────────────────────────────────
export type {
  // Runtime
  PlatformRuntimeAPI,
  RuntimePhase,
  RuntimeStatus,
  RuntimeHealthReport,
  RuntimeHealthCheck,

  // Event Kernel
  GlobalEventKernelAPI,
  KernelEvent,
  KernelEventHandler,
  EventSubscription,
  EventKernelStats,
  EventPriority,

  // Service Registry
  ServiceRegistryAPI,
  ServiceDescriptor,
  ServiceStatus,

  // Module Orchestrator
  ModuleOrchestratorAPI,
  ModuleDescriptor,
  ModuleRegistration,
  ModuleStatus,

  // Identity
  IdentityOrchestratorAPI,
  IdentitySnapshot,

  // Navigation
  NavigationOrchestratorAPI,
  NavigationState,
  NavigationEntry,

  // Feature Lifecycle
  FeatureLifecycleAPI,
  FeatureDescriptor,
  FeaturePhase,

  // Cognitive
  CognitiveOrchestratorAPI,
  CognitiveState,
} from './types';
