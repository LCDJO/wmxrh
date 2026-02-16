/**
 * NavigationOrchestrator — Centralized navigation state and route registry.
 *
 * Manages registered routes, breadcrumbs, history, pinned items,
 * and AI-generated navigation suggestions.
 */

import type {
  NavigationOrchestratorAPI,
  NavigationState,
  NavigationEntry,
  GlobalEventKernelAPI,
} from './types';

const MAX_HISTORY = 50;

export function createNavigationOrchestrator(events: GlobalEventKernelAPI): NavigationOrchestratorAPI {
  const registeredRoutes: NavigationEntry[] = [];
  const history: string[] = [];
  const pinned = new Set<string>();
  let suggestions: NavigationEntry[] = [];
  let currentPath = '/';
  let breadcrumbs: { label: string; path: string }[] = [];

  function state(): NavigationState {
    return {
      current_path: currentPath,
      breadcrumbs: [...breadcrumbs],
      history: [...history],
      pinned: [...pinned],
      suggestions: [...suggestions],
    };
  }

  function navigate(path: string): void {
    currentPath = path;
    history.push(path);
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

    // Build breadcrumbs from registered routes
    breadcrumbs = buildBreadcrumbs(path);

    events.emit('navigation:navigated', 'NavigationOrchestrator', { path });
  }

  function registerRoutes(entries: NavigationEntry[]): void {
    for (const entry of entries) {
      const existing = registeredRoutes.findIndex(r => r.path === entry.path);
      if (existing >= 0) {
        registeredRoutes[existing] = entry;
      } else {
        registeredRoutes.push(entry);
      }
    }
    events.emit('navigation:routes_registered', 'NavigationOrchestrator', { count: entries.length });
  }

  function pin(path: string): void {
    pinned.add(path);
    events.emit('navigation:pinned', 'NavigationOrchestrator', { path });
  }

  function unpin(path: string): void {
    pinned.delete(path);
    events.emit('navigation:unpinned', 'NavigationOrchestrator', { path });
  }

  function suggest(entries: NavigationEntry[]): void {
    suggestions = entries.slice(0, 5);
    events.emit('navigation:suggestions_updated', 'NavigationOrchestrator', { count: suggestions.length });
  }

  function buildBreadcrumbs(path: string): { label: string; path: string }[] {
    const segments = path.split('/').filter(Boolean);
    const crumbs: { label: string; path: string }[] = [];
    let accumulated = '';

    for (const segment of segments) {
      accumulated += `/${segment}`;
      const route = registeredRoutes.find(r => r.path === accumulated);
      crumbs.push({ label: route?.label ?? segment, path: accumulated });
    }

    return crumbs;
  }

  return { state, navigate, registerRoutes, pin, unpin, suggest };
}
