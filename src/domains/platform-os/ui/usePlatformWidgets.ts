/**
 * usePlatformWidgets — React hook to resolve widgets for a given slot.
 *
 * Returns lazy-loaded React components filtered by the current user's
 * roles, permissions, feature flags, and viewport.
 *
 * Widgets are memoized to avoid re-resolving on every render.
 */

import { useMemo } from 'react';
import type { WidgetContext, WidgetRenderContext, ResolvedWidget, WidgetRegistryAPI } from '../federation/widget-registry';

export interface UsePlatformWidgetsOptions {
  /** The widget registry instance */
  registry: WidgetRegistryAPI;
  /** Which slot to resolve */
  context: WidgetContext;
  /** Current user/tenant context */
  renderCtx: WidgetRenderContext;
  /** Whether to enable resolution (default true) */
  enabled?: boolean;
}

export interface UsePlatformWidgetsResult {
  widgets: ResolvedWidget[];
  count: number;
  isEmpty: boolean;
}

export function usePlatformWidgets({
  registry,
  context,
  renderCtx,
  enabled = true,
}: UsePlatformWidgetsOptions): UsePlatformWidgetsResult {
  const widgets = useMemo(() => {
    if (!enabled) return [];
    return registry.resolveWidgets(context, renderCtx);
  }, [
    registry,
    context,
    enabled,
    // Stringify to stabilize reference — renderCtx is typically a new object each render
    JSON.stringify(renderCtx),
  ]);

  return {
    widgets,
    count: widgets.length,
    isEmpty: widgets.length === 0,
  };
}
