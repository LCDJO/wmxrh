/**
 * NavigationOrchestrator — Centralized navigation state and route registry.
 *
 * Merges three sources into a unified NavigationTree:
 *
 *   1. Core Navigation   — static sidebar/top-nav entries
 *   2. Module Routes     — contributed by each active module
 *   3. Cognitive Hints   — AI-suggested shortcuts and routes
 *
 * The merged tree is re-computed on every mutation and
 * emitted as a kernel event for reactive consumers.
 */

import type {
  NavigationOrchestratorAPI,
  NavigationState,
  NavigationEntry,
  MergedNavigationTree,
  GlobalEventKernelAPI,
} from './types';
import { PLATFORM_EVENTS } from './platform-events';
import type { NavigationTreeUpdatedPayload } from './platform-events';

const MAX_HISTORY = 50;
const MAX_COGNITIVE_HINTS = 5;

export function createNavigationOrchestrator(events: GlobalEventKernelAPI): NavigationOrchestratorAPI {
  // ── Source buckets ──────────────────────────────────────────
  const coreRoutes: NavigationEntry[] = [];
  const moduleRoutes = new Map<string, NavigationEntry[]>();
  const cognitiveHints: NavigationEntry[] = [];

  // ── State ──────────────────────────────────────────────────
  const history: string[] = [];
  const pinned = new Set<string>();
  let currentPath = '/';
  let breadcrumbs: { label: string; path: string }[] = [];
  let cachedTree: MergedNavigationTree | null = null;

  // ── Tree merge ─────────────────────────────────────────────

  function invalidateTree(trigger: NavigationTreeUpdatedPayload['trigger'] = 'navigate'): void {
    cachedTree = null;
    // Emit canonical event
    const tree = buildMergedTree();
    events.emit<NavigationTreeUpdatedPayload>(
      PLATFORM_EVENTS.NavigationTreeUpdated,
      'NavigationOrchestrator',
      {
        core_count: tree.core.length,
        module_count: tree.modules.length,
        cognitive_count: tree.cognitive.length,
        pinned_count: tree.pinned.length,
        trigger,
      },
    );
  }

  function buildMergedTree(): MergedNavigationTree {
    if (cachedTree) return cachedTree;

    const allModuleEntries = [...moduleRoutes.values()].flat();
    const pinnedEntries = getAllEntries()
      .filter(e => pinned.has(e.path))
      .map(e => ({ ...e, source: 'pinned' as const }));

    // Merge all, sort by priority then alphabetically
    const all = [
      ...coreRoutes,
      ...allModuleEntries,
      ...cognitiveHints,
      ...pinnedEntries,
    ].sort((a, b) => {
      const pa = a.priority ?? 100;
      const pb = b.priority ?? 100;
      if (pa !== pb) return pa - pb;
      return a.label.localeCompare(b.label);
    });

    // Deduplicate by path (first wins based on priority)
    const seen = new Set<string>();
    const deduplicated: NavigationEntry[] = [];
    for (const entry of all) {
      if (!seen.has(entry.path)) {
        seen.add(entry.path);
        deduplicated.push(entry);
      }
    }

    cachedTree = {
      entries: deduplicated,
      core: [...coreRoutes],
      modules: allModuleEntries,
      cognitive: [...cognitiveHints],
      pinned: pinnedEntries,
      merged_at: Date.now(),
    };

    return cachedTree;
  }

  function getAllEntries(): NavigationEntry[] {
    return [
      ...coreRoutes,
      ...[...moduleRoutes.values()].flat(),
      ...cognitiveHints,
    ];
  }

  // ── Public API ─────────────────────────────────────────────

  function state(): NavigationState {
    return {
      current_path: currentPath,
      breadcrumbs: [...breadcrumbs],
      history: [...history],
      pinned: [...pinned],
      suggestions: [...cognitiveHints],
      tree: buildMergedTree(),
    };
  }

  function navigate(path: string): void {
    currentPath = path;
    history.push(path);
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    breadcrumbs = buildBreadcrumbs(path);
    events.emit('navigation:navigated', 'NavigationOrchestrator', { path });
  }

  function registerCoreRoutes(entries: NavigationEntry[]): void {
    for (const entry of entries) {
      const tagged = { ...entry, source: 'core' as const };
      const idx = coreRoutes.findIndex(r => r.path === entry.path);
      if (idx >= 0) {
        coreRoutes[idx] = tagged;
      } else {
        coreRoutes.push(tagged);
      }
    }
    invalidateTree('core_registered');
    events.emit('navigation:core_routes_registered', 'NavigationOrchestrator', { count: entries.length });
  }

  function registerModuleRoutes(moduleKey: string, entries: NavigationEntry[]): void {
    const tagged = entries.map(e => ({ ...e, source: 'module' as const, module: moduleKey }));
    moduleRoutes.set(moduleKey, tagged);
    invalidateTree('module_registered');
    events.emit('navigation:module_routes_registered', 'NavigationOrchestrator', { moduleKey, count: entries.length });
  }

  function removeModuleRoutes(moduleKey: string): void {
    moduleRoutes.delete(moduleKey);
    invalidateTree('module_removed');
    events.emit('navigation:module_routes_removed', 'NavigationOrchestrator', { moduleKey });
  }

  function pushCognitiveHints(entries: NavigationEntry[]): void {
    cognitiveHints.length = 0;
    const tagged = entries
      .slice(0, MAX_COGNITIVE_HINTS)
      .map(e => ({ ...e, source: 'cognitive' as const }));
    cognitiveHints.push(...tagged);
    invalidateTree('cognitive_hints');
    events.emit('navigation:cognitive_hints_updated', 'NavigationOrchestrator', { count: cognitiveHints.length });
  }

  function pin(path: string): void {
    pinned.add(path);
    invalidateTree('pin_change');
    events.emit('navigation:pinned', 'NavigationOrchestrator', { path });
  }

  function unpin(path: string): void {
    pinned.delete(path);
    invalidateTree('pin_change');
    events.emit('navigation:unpinned', 'NavigationOrchestrator', { path });
  }

  function mergedTree(): MergedNavigationTree {
    return buildMergedTree();
  }

  // ── Legacy API ─────────────────────────────────────────────

  function registerRoutes(entries: NavigationEntry[]): void {
    registerCoreRoutes(entries);
  }

  function suggest(entries: NavigationEntry[]): void {
    pushCognitiveHints(entries);
  }

  // ── Helpers ────────────────────────────────────────────────

  function buildBreadcrumbs(path: string): { label: string; path: string }[] {
    const segments = path.split('/').filter(Boolean);
    const crumbs: { label: string; path: string }[] = [];
    let accumulated = '';
    const allEntries = getAllEntries();

    for (const segment of segments) {
      accumulated += `/${segment}`;
      const route = allEntries.find(r => r.path === accumulated);
      crumbs.push({ label: route?.label ?? segment, path: accumulated });
    }

    return crumbs;
  }

  // ── Listen for module lifecycle events ─────────────────────

  events.on('module:deactivated', (evt) => {
    const key = (evt.payload as { key: string }).key;
    if (key) removeModuleRoutes(key);
  });

  return {
    state,
    navigate,
    registerCoreRoutes,
    registerModuleRoutes,
    pushCognitiveHints,
    removeModuleRoutes,
    pin,
    unpin,
    mergedTree,
    registerRoutes,
    suggest,
  };
}
