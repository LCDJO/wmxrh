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
import type { PlatformExperienceEngineAPI } from '@/domains/platform-experience/types';

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
  /** Other services this one depends on */
  dependencies: string[];
  /** Capabilities this service exposes (e.g. 'auth:verify', 'data:encrypt') */
  capabilities: string[];
  /** Permissions required to consume this service */
  required_permissions: string[];
  registered_at: number;
  metadata?: Record<string, unknown>;
}

export interface ServiceRegistrationOpts {
  version?: string;
  dependencies?: string[];
  /** Capabilities this service exposes for discovery */
  capabilities?: string[];
  /** Permissions a caller must hold to use this service */
  required_permissions?: string[];
  metadata?: Record<string, unknown>;
}

export interface ServiceRegistryAPI {
  register<T>(name: string, instance: T, opts?: ServiceRegistrationOpts): void;
  resolve<T>(name: string): T | null;
  has(name: string): boolean;
  list(): ServiceDescriptor[];
  dispose(name: string): void;

  // ── Discovery ─────────────────────────────────────────────
  /** Find all services that expose a given capability */
  findByCapability(capability: string): ServiceDescriptor[];
  /** Find all services that depend on a given service */
  dependentsOf(name: string): ServiceDescriptor[];
  /** Get the full dependency graph as adjacency list */
  dependencyGraph(): Record<string, string[]>;
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
  deactivated_at: number | null;
  error?: string;

  // ── Tenant-scoped activation ──────────────────────────────
  /** Tenants for which this module is explicitly enabled (empty = all) */
  enabled_tenants: string[];
  /** Tenants for which this module is explicitly disabled */
  disabled_tenants: string[];
  /** Whether this module is a core module (always active, cannot be deactivated) */
  is_core: boolean;
  /** Whether this module uses lazy activation (activated on first access) */
  lazy: boolean;
}

export interface ModuleRegistration {
  key: ModuleKey | string;
  label: string;
  version?: string;
  routes?: string[];
  required_permissions?: string[];
  dependencies?: (ModuleKey | string)[];
  cognitive_signals?: string[];
  /** Mark as core module — always active, cannot be deactivated */
  is_core?: boolean;
  /** Lazy activation — module stays registered until first access via activateIfNeeded() */
  lazy?: boolean;
  /** Restrict activation to specific tenants (empty = all tenants) */
  enabled_tenants?: string[];
  /** Lifecycle hooks */
  onActivate?: () => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
  onError?: (error: Error) => void;
}

// ══════════════════════════════════════════════════════════════════
// Identity Orchestrator
// ══════════════════════════════════════════════════════════════════

/**
 * OperationalIdentitySnapshot — Unified read-model combining:
 *
 *   1. Platform Identity  (is_platform_admin, platform_role)
 *   2. Tenant Identity    (tenant_id, tenant_name, tenant_role, scope)
 *   3. Dual Identity      (impersonation state)
 *   4. UnifiedIdentitySession (IIL full session)
 *
 * This is the SINGLE object any UI or service should consume
 * to answer "who is operating, where, and with what permissions?"
 */
export interface OperationalIdentitySnapshot {
  // ── Core ──────────────────────────────────────────────────
  user_id: string | null;
  email: string | null;
  is_authenticated: boolean;
  phase: IdentityPhase;

  // ── Platform layer ────────────────────────────────────────
  is_platform_admin: boolean;
  platform_role: string | null;
  user_type: 'platform' | 'tenant' | 'unknown';

  // ── Tenant layer ──────────────────────────────────────────
  current_tenant_id: string | null;
  current_tenant_name: string | null;
  tenant_role: string | null;
  effective_roles: readonly string[];
  scope_level: string | null;
  current_group_id: string | null;
  current_company_id: string | null;

  // ── Dual identity (impersonation) ─────────────────────────
  is_impersonating: boolean;
  impersonation: {
    real_user_id: string;
    target_tenant_id: string;
    simulated_role: string;
    reason: string;
    remaining_ms: number;
    operation_count: number;
  } | null;

  // ── Workspace / navigation context ────────────────────────
  available_tenants: ReadonlyArray<{ tenant_id: string; tenant_name: string; role: string; is_active: boolean }>;
  available_groups: ReadonlyArray<{ group_id: string; tenant_id: string }>;
  can_switch_workspace: boolean;

  // ── Access graph ──────────────────────────────────────────
  has_access_graph: boolean;
  reachable_company_count: number;
  reachable_group_count: number;

  // ── Risk ──────────────────────────────────────────────────
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;

  // ── Metadata ──────────────────────────────────────────────
  resolved_at: number;
  session_id: string | null;
}

/** @deprecated Use OperationalIdentitySnapshot instead */
export type IdentitySnapshot = OperationalIdentitySnapshot;

type IdentityPhase = 'anonymous' | 'authenticated' | 'scoped' | 'impersonating' | 'idle';

// ══════════════════════════════════════════════════════════════════
// Navigation Orchestrator
// ══════════════════════════════════════════════════════════════════

export type NavigationSource = 'core' | 'module' | 'cognitive' | 'pinned';

export interface NavigationEntry {
  path: string;
  label: string;
  module?: ModuleKey | string;
  icon?: string;
  /** Where this entry came from */
  source: NavigationSource;
  /** Permissions required to see this route */
  required_permissions?: string[];
  /** Feature flag that gates this route */
  feature_flag?: string;
  /** Cognitive hint metadata (confidence, reason) */
  cognitive_hint?: { confidence: number; reason: string };
  /** Sort priority (lower = higher in tree) */
  priority?: number;
  children?: NavigationEntry[];
}

/**
 * MergedNavigationTree — The final navigation tree after merging
 * Core Navigation + Module Routes + Cognitive Hints.
 */
export interface MergedNavigationTree {
  /** All entries merged and sorted */
  entries: NavigationEntry[];
  /** Core entries only */
  core: NavigationEntry[];
  /** Module-contributed entries */
  modules: NavigationEntry[];
  /** AI-suggested entries */
  cognitive: NavigationEntry[];
  /** User-pinned entries */
  pinned: NavigationEntry[];
  /** Merge timestamp */
  merged_at: number;
}

export interface NavigationState {
  current_path: string;
  breadcrumbs: { label: string; path: string }[];
  history: string[];
  pinned: string[];
  suggestions: NavigationEntry[];
  /** The merged navigation tree */
  tree: MergedNavigationTree;
}

// ══════════════════════════════════════════════════════════════════
// Feature Lifecycle Manager
// ══════════════════════════════════════════════════════════════════

export type FeaturePhase = 'experimental' | 'alpha' | 'beta' | 'active' | 'ga' | 'deprecated' | 'sunset';

export interface FeatureDescriptor {
  key: string;
  label: string;
  phase: FeaturePhase;
  enabled: boolean;
  /** Module that owns this feature */
  module?: ModuleKey | string;
  /** When the feature was last toggled */
  toggled_at: number | null;
  /** When the phase was last transitioned */
  phase_changed_at: number | null;
  /** Previous phase (for audit trail) */
  previous_phase: FeaturePhase | null;
  /** Rollout percentage (0-100) for gradual releases */
  rollout_pct: number;
  /** Tenant allow-list (empty = all) */
  allowed_tenants: string[];
  /** Tenant deny-list */
  denied_tenants: string[];
  /** Sunset date — auto-disable after this timestamp */
  sunset_at: number | null;
  /** Human-readable description */
  description?: string;
  metadata?: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════
// Cognitive Orchestrator
// ══════════════════════════════════════════════════════════════════

export type CognitiveSignalKind =
  | 'layout_suggestion'
  | 'permission_suggestion'
  | 'shortcut_suggestion'
  | 'pattern_detection'
  | 'dashboard_recommendation'
  | 'quick_setup'
  | 'role_suggestion'
  | 'risk_alert';

export interface CognitiveSignal {
  id: string;
  kind: CognitiveSignalKind;
  title: string;
  description: string;
  confidence: number;
  /** Where this signal came from */
  source: 'behavior_analyzer' | 'permission_advisor' | 'navigation_advisor' | 'role_engine' | 'external';
  /** Action label for UI (e.g. "Aplicar layout", "Adicionar atalho") */
  action_label?: string;
  /** Whether the user has dismissed this signal */
  dismissed: boolean;
  /** Whether the user has accepted/applied this signal */
  accepted: boolean;
  created_at: number;
  expires_at: number | null;
  metadata?: Record<string, unknown>;
}

export interface CognitiveState {
  is_active: boolean;
  last_query_at: number | null;
  pending_suggestions: number;
  active_signals: number;
  behavior_session_count: number;
  /** Active (non-dismissed, non-expired) signals grouped by kind */
  signals_by_kind: Partial<Record<CognitiveSignalKind, number>>;
}

// ══════════════════════════════════════════════════════════════════
// Security Delegation (POSL → SecurityKernel)
// ══════════════════════════════════════════════════════════════════

/**
 * AuthorizationRequest — Simplified facade for POSL consumers.
 *
 * POSL NEVER evaluates permissions itself.
 * All authorization flows delegate to SecurityKernel.authorize().
 */
export interface AuthorizationRequest {
  action: string;
  resource: string;
  /** Optional ABAC target (company/group scoping) */
  target?: { tenant_id?: string; company_group_id?: string; company_id?: string };
  /** Skip expensive checks for high-frequency reads */
  skipAccessGraph?: boolean;
  skipPolicy?: boolean;
  skipAudit?: boolean;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  deniedBy?: string;
  requestId: string;
}

// ══════════════════════════════════════════════════════════════════
// PlatformRuntime (main façade)
// ══════════════════════════════════════════════════════════════════

export interface PlatformRuntimeAPI {
  // Lifecycle
  boot(): Promise<void>;
  shutdown(): void;
  status(): RuntimeStatus;

  // ── Security delegation ───────────────────────────────────
  /**
   * Authorize an action by delegating to SecurityKernel.
   *
   * INVARIANT: POSL NEVER evaluates permissions directly.
   * This is the ONLY authorization entry point from the POSL.
   */
  authorize(request: AuthorizationRequest): AuthorizationResult;

  // Sub-systems (typed accessors)
  events: GlobalEventKernelAPI;
  services: ServiceRegistryAPI;
  modules: ModuleOrchestratorAPI;
  identity: IdentityOrchestratorAPI;
  navigation: NavigationOrchestratorAPI;
  features: FeatureLifecycleAPI;
  cognitive: CognitiveOrchestratorAPI;
  experience: PlatformExperienceEngineAPI;
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

  // ── Lazy activation ───────────────────────────────────────
  /** Activate a module only if it was registered as lazy and is not yet active */
  activateIfNeeded(key: string): Promise<void>;

  // ── Tenant-scoped ─────────────────────────────────────────
  /** Check if a module is enabled for a specific tenant */
  isEnabledForTenant(key: string, tenantId: string): boolean;
  /** Enable a module for a specific tenant */
  enableForTenant(key: string, tenantId: string): void;
  /** Disable a module for a specific tenant */
  disableForTenant(key: string, tenantId: string): void;
  /** List modules available for a specific tenant */
  listForTenant(tenantId: string): ModuleDescriptor[];

  // ── Dependency graph ──────────────────────────────────────
  /** Get the dependency tree (who depends on whom) */
  dependencyGraph(): Record<string, string[]>;
  /** Get topological activation order for a module and its deps */
  activationOrder(key: string): string[];
  /** Activate a module and all its unresolved dependencies (cascading) */
  activateWithDeps(key: string): Promise<void>;
  /** Deactivate a module and all its dependents (cascading) */
  deactivateWithDeps(key: string): Promise<void>;
}

export interface IdentityOrchestratorAPI {
  /** Get the unified operational identity snapshot */
  snapshot(): OperationalIdentitySnapshot;
  /** Force re-read from Security Kernel subsystems */
  refresh(): Promise<void>;
  /** Subscribe to identity state changes */
  onIdentityChange(handler: (snapshot: OperationalIdentitySnapshot) => void): () => void;
  /** Check if user is authenticated */
  isAuthenticated(): boolean;
  /** Check if currently impersonating */
  isImpersonating(): boolean;
  /** Get the current identity phase */
  currentPhase(): string;
}

export interface NavigationOrchestratorAPI {
  state(): NavigationState;
  navigate(path: string): void;
  /** Register core navigation entries (sidebar, top-nav) */
  registerCoreRoutes(entries: NavigationEntry[]): void;
  /** Register module-contributed routes (called by ModuleOrchestrator) */
  registerModuleRoutes(moduleKey: string, entries: NavigationEntry[]): void;
  /** Push cognitive hints from the AI layer */
  pushCognitiveHints(entries: NavigationEntry[]): void;
  /** Remove all routes contributed by a specific module */
  removeModuleRoutes(moduleKey: string): void;
  pin(path: string): void;
  unpin(path: string): void;
  /** Get the merged navigation tree (core + modules + cognitive + pinned) */
  mergedTree(): MergedNavigationTree;
  /** Legacy: register routes (delegates to registerCoreRoutes) */
  registerRoutes(entries: NavigationEntry[]): void;
  /** Legacy: set suggestions (delegates to pushCognitiveHints) */
  suggest(entries: NavigationEntry[]): void;
}

export interface FeatureLifecycleAPI {
  register(feature: Omit<FeatureDescriptor, 'toggled_at' | 'phase_changed_at' | 'previous_phase'>): void;
  isEnabled(key: string, ctx?: { tenantId?: string }): boolean;
  toggle(key: string, enabled: boolean): void;
  /** Transition a feature to a new phase */
  transitionPhase(key: string, newPhase: FeaturePhase): void;
  /** List all features, optionally filtered by phase */
  list(filter?: { phase?: FeaturePhase; module?: string; enabledOnly?: boolean }): FeatureDescriptor[];
  getPhase(key: string): FeaturePhase | null;
  get(key: string): FeatureDescriptor | null;
  /** List features nearing sunset */
  listSunsetting(): FeatureDescriptor[];
  /** Enable feature for specific tenant */
  enableForTenant(key: string, tenantId: string): void;
  /** Disable feature for specific tenant */
  disableForTenant(key: string, tenantId: string): void;
}

export interface CognitiveOrchestratorAPI {
  state(): CognitiveState;
  trackNavigation(route: string, userId?: string): void;
  trackModuleUse(moduleKey: string): void;
  isActive(): boolean;

  // ── Signal management ─────────────────────────────────────
  /** Push a cognitive signal (from any advisor/analyzer) */
  pushSignal(signal: Omit<CognitiveSignal, 'id' | 'dismissed' | 'accepted' | 'created_at'>): string;
  /** Get active signals (non-dismissed, non-expired) */
  activeSignals(filter?: { kind?: CognitiveSignalKind; minConfidence?: number }): CognitiveSignal[];
  /** Dismiss a signal (user rejected) */
  dismissSignal(signalId: string): void;
  /** Accept a signal (user confirmed — orchestrator emits event, does NOT mutate) */
  acceptSignal(signalId: string): void;
  /** Clear all signals */
  clearSignals(): void;

  // ── Query helpers (delegate to CognitiveInsightsService) ──
  /** Request layout suggestions based on behavior */
  suggestLayout(caller: { role: string; email: string }): Promise<CognitiveSignal[]>;
  /** Request permission suggestions for a role */
  suggestPermissions(caller: { role: string; email: string }, targetRole?: string): Promise<CognitiveSignal[]>;
  /** Request shortcut suggestions based on navigation patterns */
  suggestShortcuts(caller: { role: string; email: string }): Promise<CognitiveSignal[]>;
}
