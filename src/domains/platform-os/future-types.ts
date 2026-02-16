/**
 * Platform OS — Future Extension Contracts
 *
 * Type foundations for upcoming capabilities:
 *
 * ┌──────────────────────────────┬────────────────────────────────────┐
 * │ Capability                   │ Status                             │
 * ├──────────────────────────────┼────────────────────────────────────┤
 * │ Module Marketplace           │ Types ready, impl deferred         │
 * │ External Plugins             │ Sandbox + lifecycle types          │
 * │ Third-Party SDK              │ Public API surface types           │
 * │ Microfrontend Orchestration  │ Remote entry + container types     │
 * └──────────────────────────────┴────────────────────────────────────┘
 *
 * IMPORTANT: These are CONTRACT-ONLY definitions.
 * No runtime code is shipped until the feature is built.
 */

import type { ModuleRegistration, FeaturePhase } from './types';

// ══════════════════════════════════════════════════════════════════
// 1. Module Marketplace
// ══════════════════════════════════════════════════════════════════

/** A marketplace listing for a module available for installation */
export interface MarketplaceModule {
  /** Unique marketplace identifier */
  marketplace_id: string;
  /** Module key (same as ModuleRegistration.key after install) */
  module_key: string;
  /** Display name */
  name: string;
  description: string;
  /** Publisher / vendor */
  publisher: MarketplacePublisher;
  /** Version semver */
  version: string;
  /** Minimum POSL runtime version required */
  min_runtime_version: string;
  /** Category for filtering */
  category: MarketplaceCategory;
  /** Tags for search */
  tags: string[];
  /** Pricing tier */
  pricing: 'free' | 'freemium' | 'paid' | 'enterprise';
  /** Monthly price in cents (0 if free) */
  price_cents: number;
  /** Number of active installations */
  install_count: number;
  /** Average rating (0-5) */
  rating: number;
  /** Required permissions the module will need */
  required_permissions: string[];
  /** Other modules this depends on */
  dependencies: string[];
  /** Screenshots / preview URLs */
  screenshots: string[];
  /** Changelog entries */
  changelog: { version: string; date: string; notes: string }[];
  /** Review status */
  review_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  published_at: string;
  updated_at: string;
}

export interface MarketplacePublisher {
  id: string;
  name: string;
  verified: boolean;
  website?: string;
  support_email?: string;
}

export type MarketplaceCategory =
  | 'hr'
  | 'compliance'
  | 'payroll'
  | 'analytics'
  | 'integration'
  | 'security'
  | 'communication'
  | 'automation'
  | 'other';

export interface MarketplaceInstallation {
  marketplace_id: string;
  module_key: string;
  tenant_id: string;
  installed_version: string;
  installed_at: string;
  installed_by: string;
  status: 'active' | 'suspended' | 'uninstalling';
  /** Auto-update policy */
  auto_update: boolean;
  /** Configuration overrides for this tenant */
  config: Record<string, unknown>;
}

/** Future API surface for the Marketplace orchestrator */
export interface MarketplaceAPI {
  /** Search available modules */
  search(query: string, filters?: { category?: MarketplaceCategory; pricing?: string }): Promise<MarketplaceModule[]>;
  /** Get module details */
  getModule(marketplaceId: string): Promise<MarketplaceModule | null>;
  /** Install a module for the current tenant */
  install(marketplaceId: string, config?: Record<string, unknown>): Promise<MarketplaceInstallation>;
  /** Uninstall a module */
  uninstall(marketplaceId: string): Promise<void>;
  /** List installed modules for the current tenant */
  listInstalled(): Promise<MarketplaceInstallation[]>;
  /** Check for available updates */
  checkUpdates(): Promise<{ module_key: string; current: string; available: string }[]>;
  /** Apply an update */
  update(marketplaceId: string, targetVersion?: string): Promise<void>;
}

// ══════════════════════════════════════════════════════════════════
// 2. External Plugins
// ══════════════════════════════════════════════════════════════════

/** Plugin manifest — shipped alongside the plugin code */
export interface PluginManifest {
  /** Unique plugin identifier (reverse-domain: com.vendor.plugin-name) */
  id: string;
  name: string;
  version: string;
  /** Plugin author */
  author: { name: string; email?: string; url?: string };
  /** Entry point (relative to plugin root) */
  main: string;
  /** Permissions this plugin requests */
  permissions: PluginPermission[];
  /** POSL events this plugin wants to subscribe to */
  subscribed_events: string[];
  /** UI extension points this plugin provides */
  extension_points: PluginExtensionPoint[];
  /** Sandbox constraints */
  sandbox: PluginSandboxConfig;
}

export type PluginPermission =
  | 'read:identity'
  | 'read:navigation'
  | 'read:modules'
  | 'read:features'
  | 'write:cognitive-signals'
  | 'emit:events'
  | 'access:service-registry'
  | 'ui:inject-widget'
  | 'ui:inject-route'
  | 'ui:inject-sidebar-item';

export interface PluginExtensionPoint {
  /** Where in the UI this plugin injects content */
  slot: PluginSlot;
  /** Component name exported from the plugin */
  component: string;
  /** Priority (lower = rendered first) */
  priority?: number;
}

export type PluginSlot =
  | 'sidebar:top'
  | 'sidebar:bottom'
  | 'dashboard:widget'
  | 'employee:tab'
  | 'settings:section'
  | 'toolbar:action'
  | 'header:right'
  | 'modal:custom';

export interface PluginSandboxConfig {
  /** Maximum memory (MB) — default 64 */
  max_memory_mb: number;
  /** Maximum execution time per handler (ms) — default 5000 */
  max_execution_ms: number;
  /** Network access allowed? */
  network_access: boolean;
  /** Allowed domains (if network_access is true) */
  allowed_domains: string[];
  /** Can access localStorage? */
  local_storage: boolean;
}

export type PluginLifecyclePhase =
  | 'loading'
  | 'validating'
  | 'sandboxed'
  | 'active'
  | 'suspended'
  | 'error'
  | 'unloaded';

export interface PluginInstance {
  manifest: PluginManifest;
  phase: PluginLifecyclePhase;
  loaded_at: number | null;
  error?: string;
  /** Granted permissions (subset of requested, approved by admin) */
  granted_permissions: PluginPermission[];
}

/** Future API surface for Plugin management */
export interface PluginManagerAPI {
  /** Load and sandbox a plugin from its manifest */
  load(manifest: PluginManifest, code: string): Promise<PluginInstance>;
  /** Unload a plugin */
  unload(pluginId: string): void;
  /** List all loaded plugins */
  list(): PluginInstance[];
  /** Get extension points for a slot */
  getExtensions(slot: PluginSlot): PluginExtensionPoint[];
  /** Approve/deny permissions for a plugin */
  setPermissions(pluginId: string, granted: PluginPermission[]): void;
}

// ══════════════════════════════════════════════════════════════════
// 3. Third-Party SDK
// ══════════════════════════════════════════════════════════════════

/**
 * PlatformSDK — Public API surface for third-party integrators.
 *
 * This is a RESTRICTED subset of PlatformRuntimeAPI.
 * Third-party code NEVER gets direct access to:
 *   - SecurityKernel internals
 *   - IdentityBoundary / DualIdentityEngine
 *   - ServiceRegistry (write)
 *   - Module lifecycle (activate/deactivate)
 *
 * They CAN:
 *   - Read identity snapshot (anonymized if needed)
 *   - Subscribe to events
 *   - Push cognitive signals
 *   - Register navigation entries
 *   - Query feature flags
 */
export interface PlatformSDK {
  /** SDK version */
  readonly version: string;

  /** Read-only identity information */
  identity: {
    /** Current user's tenant and role (no PII unless permitted) */
    snapshot(): SDKIdentitySnapshot;
    /** Subscribe to identity changes */
    onChange(handler: (snapshot: SDKIdentitySnapshot) => void): () => void;
  };

  /** Event bus (subscribe-only, no system events) */
  events: {
    /** Subscribe to specific event types (namespace-filtered) */
    on(type: string, handler: (payload: unknown) => void): () => void;
    /** Emit events (prefixed with sdk:{pluginId}:) */
    emit(type: string, payload: unknown): void;
  };

  /** Navigation (contribute routes/hints only) */
  navigation: {
    /** Register routes for the SDK consumer's module */
    registerRoutes(entries: SDKNavigationEntry[]): void;
    /** Push cognitive hints */
    pushHints(entries: SDKNavigationEntry[]): void;
    /** Get current path */
    currentPath(): string;
  };

  /** Feature flags (read-only) */
  features: {
    isEnabled(key: string): boolean;
    getPhase(key: string): FeaturePhase | null;
  };

  /** Cognitive (push signals only) */
  cognitive: {
    pushSignal(signal: SDKCognitiveSignal): string;
  };
}

/** Anonymized identity for SDK consumers */
export interface SDKIdentitySnapshot {
  tenant_id: string | null;
  is_authenticated: boolean;
  scope_level: string | null;
  roles: string[];
  /** PII fields omitted by default */
}

export interface SDKNavigationEntry {
  path: string;
  label: string;
  icon?: string;
  priority?: number;
}

export interface SDKCognitiveSignal {
  kind: string;
  title: string;
  description: string;
  confidence: number;
  action_label?: string;
  metadata?: Record<string, unknown>;
}

/** SDK initialization options */
export interface SDKInitOptions {
  /** Plugin/integration identifier */
  integrationId: string;
  /** API key for authentication */
  apiKey: string;
  /** Requested permissions */
  permissions: PluginPermission[];
  /** Callback when SDK is ready */
  onReady?: (sdk: PlatformSDK) => void;
  /** Callback on errors */
  onError?: (error: Error) => void;
}

// ══════════════════════════════════════════════════════════════════
// 4. Microfrontend Orchestration
// ══════════════════════════════════════════════════════════════════

/**
 * MicrofrontendDescriptor — Describes a remote microfrontend
 * that can be loaded into the POSL shell.
 *
 * Uses Module Federation (Webpack 5 / Vite plugin) conventions.
 */
export interface MicrofrontendDescriptor {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** URL to the remote entry (remoteEntry.js) */
  remote_entry_url: string;
  /** Exposed module name (e.g., './App') */
  exposed_module: string;
  /** Scope name for module federation */
  scope: string;
  /** Version of the microfrontend */
  version: string;
  /** Routes this microfrontend handles */
  routes: string[];
  /** Shared dependencies (React, etc.) */
  shared_deps: SharedDependency[];
  /** Loading strategy */
  loading: MicrofrontendLoadingStrategy;
  /** Fallback component key when loading/error */
  fallback?: string;
  /** CSP rules for the sandbox iframe (if sandboxed) */
  csp?: string;
  /** Health check endpoint */
  health_url?: string;
}

export interface SharedDependency {
  name: string;
  /** Required version range (semver) */
  requiredVersion: string;
  /** Whether to use the host's version (singleton) */
  singleton: boolean;
  /** Eagerly load this shared dep */
  eager?: boolean;
}

export type MicrofrontendLoadingStrategy =
  | 'eager'       // Load on boot
  | 'lazy'        // Load on first route match
  | 'prefetch'    // Load after idle
  | 'on-demand';  // Load only when explicitly requested

export type MicrofrontendStatus =
  | 'pending'
  | 'loading'
  | 'loaded'
  | 'mounted'
  | 'error'
  | 'unloaded';

export interface MicrofrontendInstance {
  descriptor: MicrofrontendDescriptor;
  status: MicrofrontendStatus;
  loaded_at: number | null;
  mounted_at: number | null;
  error?: string;
  /** Resolved module reference (React component) */
  component?: React.ComponentType<unknown>;
}

/** Future API surface for Microfrontend orchestration */
export interface MicrofrontendOrchestratorAPI {
  /** Register a remote microfrontend */
  register(descriptor: MicrofrontendDescriptor): void;
  /** Load a microfrontend (fetch remote entry + resolve module) */
  load(id: string): Promise<MicrofrontendInstance>;
  /** Mount a microfrontend into a container */
  mount(id: string, containerId: string): Promise<void>;
  /** Unmount a microfrontend */
  unmount(id: string): void;
  /** List all registered microfrontends */
  list(): MicrofrontendInstance[];
  /** Get instance by route match */
  resolveByRoute(path: string): MicrofrontendInstance | null;
  /** Health check all registered microfrontends */
  healthCheck(): Promise<{ id: string; healthy: boolean; latency_ms: number }[]>;
  /** Preload microfrontends marked as 'prefetch' */
  prefetchAll(): Promise<void>;
}

// ══════════════════════════════════════════════════════════════════
// Aggregate: Future PlatformRuntime extensions
// ══════════════════════════════════════════════════════════════════

/**
 * PlatformRuntimeFutureAPI — Extensions that will be added to
 * PlatformRuntimeAPI when implemented.
 *
 * Consumers can cast: (os as PlatformRuntimeFutureAPI).marketplace
 */
export interface PlatformRuntimeFutureAPI {
  marketplace: MarketplaceAPI;
  plugins: PluginManagerAPI;
  sdk: { create(opts: SDKInitOptions): PlatformSDK };
  microfrontends: MicrofrontendOrchestratorAPI;
}
