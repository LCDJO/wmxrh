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

export interface ModuleManifest {
  key: string;
  /** Dynamic import factory — e.g. () => import('@/modules/hr') */
  loadComponent: () => Promise<{ default: React.ComponentType<any> }>;
  /** Optional preload strategy */
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
    manifests.set(manifest.key, manifest);
    events.emit('module:manifest_registered', 'ModuleLoader', { key: manifest.key });

    // Schedule idle preload if requested
    if (manifest.preload === 'idle' && typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => preload(manifest.key));
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
