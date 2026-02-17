/**
 * ModuleNavigationBridge — Syncs Module Federation manifests
 * with the NavigationOrchestrator to compose:
 *
 *   NavigationTree = Core Navigation + Module Navigation
 *
 * When a module is activated, its `navigation_entries` are
 * automatically registered as module routes. When deactivated,
 * they are removed.
 *
 * Example: If module "ads" is active, the bridge adds:
 *   Marketing
 *    └── ADS Manager
 */

import type { NavigationOrchestratorAPI, NavigationEntry, GlobalEventKernelAPI } from '../types';
import type { ModuleLoaderAPI, ModuleNavigationEntry } from './module-loader';

export interface ModuleNavigationBridgeAPI {
  /** Sync a module's navigation entries into the NavigationOrchestrator */
  syncModule(moduleKey: string): void;
  /** Remove a module's navigation entries */
  removeModule(moduleKey: string): void;
  /** Sync all registered modules */
  syncAll(): void;
  /** Start listening to module lifecycle events for auto-sync */
  startAutoSync(): () => void;
}

/**
 * Convert ModuleNavigationEntry (from manifest) → NavigationEntry (for orchestrator).
 */
function toNavigationEntry(moduleKey: string, entry: ModuleNavigationEntry): NavigationEntry {
  return {
    path: entry.path,
    label: entry.label,
    icon: entry.icon,
    module: moduleKey,
    source: 'module',
    required_permissions: entry.required_permission ? [entry.required_permission] : undefined,
    priority: entry.order,
  };
}

/**
 * Build a hierarchical tree from flat manifest entries using `parent` field.
 */
function buildHierarchy(moduleKey: string, entries: ModuleNavigationEntry[]): NavigationEntry[] {
  const flat = entries.map(e => ({
    entry: toNavigationEntry(moduleKey, e),
    parent: e.parent,
    order: e.order ?? 99,
  }));

  // Group children under parents
  const roots: NavigationEntry[] = [];
  const childMap = new Map<string, NavigationEntry[]>();

  for (const { entry, parent } of flat) {
    if (!parent) {
      roots.push(entry);
    } else {
      if (!childMap.has(parent)) childMap.set(parent, []);
      childMap.get(parent)!.push(entry);
    }
  }

  // Attach children to roots
  for (const root of roots) {
    const children = childMap.get(root.path);
    if (children) {
      root.children = children.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    }
  }

  return roots.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

export function createModuleNavigationBridge(
  navigation: NavigationOrchestratorAPI,
  loader: ModuleLoaderAPI,
  events: GlobalEventKernelAPI,
): ModuleNavigationBridgeAPI {

  function syncModule(moduleKey: string): void {
    const manifest = loader.getManifest(moduleKey);
    if (!manifest || manifest.navigation_entries.length === 0) return;

    const tree = buildHierarchy(moduleKey, manifest.navigation_entries);
    navigation.registerModuleRoutes(moduleKey, tree);

    events.emit('navigation:module_synced', 'NavigationBridge', {
      moduleKey,
      entries_count: manifest.navigation_entries.length,
    });
  }

  function removeModule(moduleKey: string): void {
    navigation.removeModuleRoutes(moduleKey);
    events.emit('navigation:module_unsynced', 'NavigationBridge', { moduleKey });
  }

  function syncAll(): void {
    for (const key of loader.manifestKeys()) {
      syncModule(key);
    }
  }

  function startAutoSync(): () => void {
    const unsub1 = events.on('module:activated', (payload: any) => {
      if (payload?.key) syncModule(payload.key);
    });

    const unsub2 = events.on('module:deactivated', (payload: any) => {
      if (payload?.key) removeModule(payload.key);
    });

    const unsub3 = events.on('module:lazy_activated', (payload: any) => {
      if (payload?.key) syncModule(payload.key);
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }

  return { syncModule, removeModule, syncAll, startAutoSync };
}
