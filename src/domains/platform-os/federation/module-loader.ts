/**
 * ModuleLoader — Dynamic lazy-loading of module UI & logic.
 *
 * Uses React.lazy + dynamic import() to load module code on demand.
 * Each module can register a `loadComponent` factory; the loader
 * caches resolved components and exposes them as React.lazy wrappers.
 */

import React from 'react';
import type { GlobalEventKernelAPI } from '../types';

// ── Types ──────────────────────────────────────────────────────

/** Widget slot that a module contributes to the platform shell */
export interface ModuleWidget {
  /** Unique widget id (e.g. "hr:headcount-kpi") */
  widget_id: string;
  /** Human-readable label */
  label: string;
  /** Shell slot where this widget should render */
  slot: 'dashboard' | 'sidebar' | 'header' | 'detail-panel' | 'custom';
  /** Lazy component factory */
  loadComponent: () => Promise<{ default: React.ComponentType<any> }>;
  /** Minimum permission required to render */
  required_permission?: string;
  /** Display priority within the slot (lower = higher priority) */
  priority?: number;
}

/** Navigation entry contributed by a module */
export interface ModuleNavigationEntry {
  /** Route path (e.g. "/hr/employees") */
  path: string;
  /** Display label in nav menus */
  label: string;
  /** Lucide icon name */
  icon?: string;
  /** Parent path for nested navigation */
  parent?: string;
  /** Sort order within the group */
  order?: number;
  /** Permission required to show this entry */
  required_permission?: string;
  /** Badge count source (e.g. "hr:pending_approvals") */
  badge_source?: string;
}

/**
 * ModuleManifest — Full declarative contract for a federated module.
 *
 * Every module MUST declare a manifest before it can be loaded.
 */
export interface ModuleManifest {
  // ── Identity ─────────────────────────────────────────────
  /** Unique module identifier (e.g. "hr", "compensation", "crm") */
  module_id: string;
  /** Human-readable module name */
  module_name: string;
  /** SemVer version string */
  version: string;

  // ── Routes ───────────────────────────────────────────────
  /** Route paths this module owns */
  routes: string[];

  // ── Widgets ──────────────────────────────────────────────
  /** Widget slots this module contributes to the shell */
  widgets: ModuleWidget[];

  // ── Security ─────────────────────────────────────────────
  /** Permissions this module requires/exposes */
  permissions: string[];

  // ── Feature Flags ────────────────────────────────────────
  /** Feature flags this module reads or declares */
  feature_flags: string[];

  // ── Navigation ───────────────────────────────────────────
  /** Navigation entries this module contributes */
  navigation_entries: ModuleNavigationEntry[];

  // ── Loading ──────────────────────────────────────────────
  /** Root component factory — e.g. () => import('@/modules/hr') */
  loadComponent: () => Promise<{ default: React.ComponentType<any> }>;
  /** Preload strategy */
  preload?: 'idle' | 'hover' | 'none';
}

export interface ModuleLoaderAPI {
  /** Register a lazy-loadable manifest */
  registerManifest(manifest: ModuleManifest): void;
  /** Get a React.lazy component for a module key (cached) */
  getComponent(key: string): React.LazyExoticComponent<React.ComponentType<any>> | null;
  /** Preload a module (downloads JS but doesn't mount) */
  preload(key: string): Promise<void>;
  /** Check if a module has a manifest registered */
  hasManifest(key: string): boolean;
  /** List all registered manifest keys */
  manifestKeys(): string[];
}

export function createModuleLoader(events: GlobalEventKernelAPI): ModuleLoaderAPI {
  const manifests = new Map<string, ModuleManifest>();
  const componentCache = new Map<string, React.LazyExoticComponent<React.ComponentType<any>>>();
  const preloadCache = new Map<string, Promise<void>>();

  function registerManifest(manifest: ModuleManifest): void {
    manifests.set(manifest.module_id, manifest);
    events.emit('module:manifest_registered', 'ModuleLoader', { key: manifest.module_id });

    // Schedule idle preload if requested
    if (manifest.preload === 'idle' && typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => preload(manifest.module_id));
    }
  }

  function getComponent(key: string): React.LazyExoticComponent<React.ComponentType<any>> | null {
    if (componentCache.has(key)) return componentCache.get(key)!;

    const manifest = manifests.get(key);
    if (!manifest) return null;

    const lazy = React.lazy(async () => {
      events.emit('module:loading', 'ModuleLoader', { key });
      try {
        const mod = await manifest.loadComponent();
        events.emit('module:loaded', 'ModuleLoader', { key });
        return mod;
      } catch (err) {
        events.emit('module:load_error', 'ModuleLoader', {
          key,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    });

    componentCache.set(key, lazy);
    return lazy;
  }

  async function preload(key: string): Promise<void> {
    if (preloadCache.has(key)) return preloadCache.get(key);
    const manifest = manifests.get(key);
    if (!manifest) return;

    const promise = manifest.loadComponent().then(() => {
      events.emit('module:preloaded', 'ModuleLoader', { key });
    });
    preloadCache.set(key, promise);
    return promise;
  }

  function hasManifest(key: string): boolean {
    return manifests.has(key);
  }

  function manifestKeys(): string[] {
    return [...manifests.keys()];
  }

  return { registerManifest, getComponent, preload, hasManifest, manifestKeys };
}
