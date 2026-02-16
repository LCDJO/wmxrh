/**
 * Platform Operating System Layer (POSL) — Core Type Definitions
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SECURITY CONTRACT                                              ║
 * ║  The POSL is an ORCHESTRATION layer. It coordinates services    ║
 * ║  but NEVER bypasses the Security Kernel. All identity,          ║
 * ║  permission, and scope checks still flow through the Kernel.    ║
 * ║  The POSL only provides a unified runtime surface.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { ModuleKey } from '@/domains/platform/platform-modules';

// ══════════════════════════════════════════════════════════════════
// Runtime Lifecycle
// ══════════════════════════════════════════════════════════════════

export type RuntimePhase = 'idle' | 'booting' | 'ready' | 'degraded' | 'shutting_down';

export interface RuntimeStatus {
  phase: RuntimePhase;
  booted_at: number | null;
  uptime_ms: number;
  registered_modules: number;
  registered_services: number;
  active_subscriptions: number;
  health: RuntimeHealthReport;
}

export interface RuntimeHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: RuntimeHealthCheck[];
}

export interface RuntimeHealthCheck {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  message?: string;
  checked_at: number;
}

// ══════════════════════════════════════════════════════════════════
// Global Event Kernel
// ══════════════════════════════════════════════════════════════════

export type EventPriority = 'low' | 'normal' | 'high' | 'critical';

export interface KernelEvent<T = unknown> {
  id: string;
  type: string;
  source: string;
  timestamp: number;
  priority: EventPriority;
  payload: T;
  metadata?: Record<string, unknown>;
  /** Correlation ID for tracing related events */
  correlation_id?: string;
}

export type KernelEventHandler<T = unknown> = (event: KernelEvent<T>) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  event_type: string | '*';
  source_filter?: string;
  handler: KernelEventHandler;
  priority: EventPriority;
}

export interface EventKernelStats {
  total_emitted: number;
  total_handled: number;
  active_subscriptions: number;
  events_per_type: Record<string, number>;
}

// ══════════════════════════════════════════════════════════════════
// Service Registry
// ══════════════════════════════════════════════════════════════════

export type ServiceStatus = 'registered' | 'initializing' | 'ready' | 'failed' | 'disposed';

export interface ServiceDescriptor<T = unknown> {
  name: string;
  version: string;
  instance: T;
  status: ServiceStatus;
  dependencies: string[];
  registered_at: number;
  metadata?: Record<string, unknown>;
}

export interface ServiceRegistryAPI {
  register<T>(name: string, instance: T, opts?: { version?: string; dependencies?: string[] }): void;
  resolve<T>(name: string): T | null;
  has(name: string): boolean;
  list(): ServiceDescriptor[];
  dispose(name: string): void;
}

// ══════════════════════════════════════════════════════════════════
// Module Orchestrator
// ══════════════════════════════════════════════════════════════════

export type ModuleStatus = 'registered' | 'activating' | 'active' | 'suspended' | 'error';

export interface ModuleDescriptor {
  key: ModuleKey | string;
  label: string;
  status: ModuleStatus;
  version: string;
  /** Routes this module owns */
  routes: string[];
  /** Permissions this module requires */
  required_permissions: string[];
  /** Other modules this module depends on */
  dependencies: (ModuleKey | string)[];
  /** Cognitive signals this module emits */
  cognitive_signals: string[];
  registered_at: number;
  activated_at: number | null;
  error?: string;
}

export interface ModuleRegistration {
  key: ModuleKey | string;
  label: string;
  version?: string;
  routes?: string[];
  required_permissions?: string[];
  dependencies?: (ModuleKey | string)[];
  cognitive_signals?: string[];
  onActivate?: () => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
}

// ══════════════════════════════════════════════════════════════════
// Identity Orchestrator
// ══════════════════════════════════════════════════════════════════

export interface IdentitySnapshot {
  user_id: string | null;
  email: string | null;
  is_authenticated: boolean;
  is_platform_admin: boolean;
  is_tenant_admin: boolean;
  current_tenant_id: string | null;
  current_scope: string | null;
  roles: string[];
  impersonating: boolean;
  phase: string;
}

// ══════════════════════════════════════════════════════════════════
// Navigation Orchestrator
// ══════════════════════════════════════════════════════════════════

export interface NavigationEntry {
  path: string;
  label: string;
  module?: ModuleKey | string;
  icon?: string;
  /** Permissions required to see this route */
  required_permissions?: string[];
  /** Feature flag that gates this route */
  feature_flag?: string;
  children?: NavigationEntry[];
}

export interface NavigationState {
  current_path: string;
  breadcrumbs: { label: string; path: string }[];
  history: string[];
  pinned: string[];
  suggestions: NavigationEntry[];
}

// ══════════════════════════════════════════════════════════════════
// Feature Lifecycle Manager
// ══════════════════════════════════════════════════════════════════

export type FeaturePhase = 'alpha' | 'beta' | 'ga' | 'deprecated' | 'sunset';

export interface FeatureDescriptor {
  key: string;
  label: string;
  phase: FeaturePhase;
  enabled: boolean;
  /** Module that owns this feature */
  module?: ModuleKey | string;
  /** When the feature was last toggled */
  toggled_at: number | null;
  /** Rollout percentage (0-100) for gradual releases */
  rollout_pct: number;
  metadata?: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════
// Cognitive Orchestrator
// ══════════════════════════════════════════════════════════════════

export interface CognitiveState {
  is_active: boolean;
  last_query_at: number | null;
  pending_suggestions: number;
  active_signals: number;
  behavior_session_count: number;
}

// ══════════════════════════════════════════════════════════════════
// PlatformRuntime (main façade)
// ══════════════════════════════════════════════════════════════════

export interface PlatformRuntimeAPI {
  // Lifecycle
  boot(): Promise<void>;
  shutdown(): void;
  status(): RuntimeStatus;

  // Sub-systems (typed accessors)
  events: GlobalEventKernelAPI;
  services: ServiceRegistryAPI;
  modules: ModuleOrchestratorAPI;
  identity: IdentityOrchestratorAPI;
  navigation: NavigationOrchestratorAPI;
  features: FeatureLifecycleAPI;
  cognitive: CognitiveOrchestratorAPI;
}

// ── Sub-system APIs (contracts) ──────────────────────────────────

export interface GlobalEventKernelAPI {
  emit<T = unknown>(type: string, source: string, payload: T, opts?: { priority?: EventPriority; correlation_id?: string }): void;
  on<T = unknown>(type: string, handler: KernelEventHandler<T>, opts?: { priority?: EventPriority; source_filter?: string }): () => void;
  once<T = unknown>(type: string, handler: KernelEventHandler<T>): () => void;
  stats(): EventKernelStats;
}

export interface ModuleOrchestratorAPI {
  register(mod: ModuleRegistration): void;
  activate(key: string): Promise<void>;
  deactivate(key: string): Promise<void>;
  get(key: string): ModuleDescriptor | null;
  list(): ModuleDescriptor[];
  listActive(): ModuleDescriptor[];
}

export interface IdentityOrchestratorAPI {
  snapshot(): IdentitySnapshot;
  refresh(): Promise<void>;
  onIdentityChange(handler: (snapshot: IdentitySnapshot) => void): () => void;
}

export interface NavigationOrchestratorAPI {
  state(): NavigationState;
  navigate(path: string): void;
  registerRoutes(entries: NavigationEntry[]): void;
  pin(path: string): void;
  unpin(path: string): void;
  suggest(entries: NavigationEntry[]): void;
}

export interface FeatureLifecycleAPI {
  register(feature: Omit<FeatureDescriptor, 'toggled_at'>): void;
  isEnabled(key: string, ctx?: { tenantId?: string }): boolean;
  toggle(key: string, enabled: boolean): void;
  list(): FeatureDescriptor[];
  getPhase(key: string): FeaturePhase | null;
}

export interface CognitiveOrchestratorAPI {
  state(): CognitiveState;
  trackNavigation(route: string, userId?: string): void;
  trackModuleUse(moduleKey: string): void;
  isActive(): boolean;
}
