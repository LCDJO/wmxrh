/**
 * WidgetRegistry — Centralized registry for module-contributed dashboard widgets.
 *
 * Modules register widgets via `registerWidget()`. The shell renders them
 * by querying widgets for a given slot + context (roles, permissions, tenant).
 *
 * Each widget declares:
 *   - widget_id:      unique identifier
 *   - allowed_roles:  roles that can see this widget
 *   - contexts:       where this widget can appear (e.g. ["dashboard", "detail-panel"])
 */

import React from 'react';
import type { GlobalEventKernelAPI } from '../types';

// ── Types ──────────────────────────────────────────────────────

export type WidgetContext = 'dashboard' | 'sidebar' | 'header' | 'detail-panel' | 'onboarding' | 'custom';

export interface WidgetRegistration {
  /** Unique widget identifier (e.g. "hr:headcount_kpi") */
  widget_id: string;
  /** Human-readable label */
  label: string;
  /** Module that owns this widget */
  module_id: string;
  /** Roles allowed to see this widget (empty = all roles) */
  allowed_roles: string[];
  /** Contexts where this widget can render */
  contexts: WidgetContext[];
  /** Lazy component factory */
  loadComponent: () => Promise<{ default: React.ComponentType<any> }>;
  /** Required permission (beyond role check) */
  required_permission?: string;
  /** Display priority (lower = higher in layout) */
  priority?: number;
  /** Minimum viewport width for rendering (responsive) */
  min_width?: number;
  /** Feature flag that gates this widget */
  feature_flag?: string;
  /** Widget size hint */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether the widget can be dismissed/hidden by users */
  dismissable?: boolean;
}

export interface WidgetRenderContext {
  roles: string[];
  permissions: string[];
  tenant_id: string;
  /** Active feature flags */
  feature_flags: string[];
  /** Current viewport context */
  viewport_width?: number;
}

export interface ResolvedWidget {
  registration: WidgetRegistration;
  Component: React.LazyExoticComponent<React.ComponentType<any>>;
}

export interface WidgetRegistryAPI {
  /** Register a widget */
  registerWidget(widget: WidgetRegistration): void;
  /** Remove a widget */
  unregisterWidget(widgetId: string): void;
  /** Resolve widgets for a given context and slot */
  resolveWidgets(context: WidgetContext, renderCtx: WidgetRenderContext): ResolvedWidget[];
  /** Get all registered widgets */
  listWidgets(): WidgetRegistration[];
  /** Get widgets for a specific module */
  listWidgetsForModule(moduleId: string): WidgetRegistration[];
  /** Check if a widget exists */
  hasWidget(widgetId: string): boolean;
  /** Bulk register widgets from module manifests */
  registerFromManifest(manifest: { module_id: string; widgets: Array<{ widget_id: string; label: string; slot: string; loadComponent: () => Promise<{ default: React.ComponentType<any> }>; required_permission?: string; priority?: number }> }): void;
}

// ── Implementation ─────────────────────────────────────────────

export function createWidgetRegistry(events: GlobalEventKernelAPI): WidgetRegistryAPI {
  const widgets = new Map<string, WidgetRegistration>();
  const componentCache = new Map<string, React.LazyExoticComponent<React.ComponentType<any>>>();

  function registerWidget(widget: WidgetRegistration): void {
    widgets.set(widget.widget_id, widget);

    // Create lazy component wrapper
    const lazy = React.lazy(async () => {
      events.emit('widget:loading', 'WidgetRegistry', { widget_id: widget.widget_id });
      try {
        const mod = await widget.loadComponent();
        events.emit('widget:loaded', 'WidgetRegistry', { widget_id: widget.widget_id });
        return mod;
      } catch (err) {
        events.emit('widget:load_error', 'WidgetRegistry', {
          widget_id: widget.widget_id,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    });
    componentCache.set(widget.widget_id, lazy);

    events.emit('widget:registered', 'WidgetRegistry', {
      widget_id: widget.widget_id,
      module_id: widget.module_id,
      contexts: widget.contexts,
    });
  }

  function unregisterWidget(widgetId: string): void {
    widgets.delete(widgetId);
    componentCache.delete(widgetId);
    events.emit('widget:unregistered', 'WidgetRegistry', { widget_id: widgetId });
  }

  function resolveWidgets(context: WidgetContext, renderCtx: WidgetRenderContext): ResolvedWidget[] {
    const resolved: ResolvedWidget[] = [];

    for (const [id, widget] of widgets) {
      // 1. Context match
      if (!widget.contexts.includes(context)) continue;

      // 2. Role check (empty = all roles allowed)
      if (widget.allowed_roles.length > 0) {
        const hasRole = widget.allowed_roles.some(r => renderCtx.roles.includes(r));
        if (!hasRole) continue;
      }

      // 3. Permission check
      if (widget.required_permission && !renderCtx.permissions.includes(widget.required_permission)) continue;

      // 4. Feature flag gate
      if (widget.feature_flag && !renderCtx.feature_flags.includes(widget.feature_flag)) continue;

      // 5. Viewport check
      if (widget.min_width && renderCtx.viewport_width && renderCtx.viewport_width < widget.min_width) continue;

      const Component = componentCache.get(id);
      if (!Component) continue;

      resolved.push({ registration: widget, Component });
    }

    // Sort by priority
    return resolved.sort((a, b) => (a.registration.priority ?? 99) - (b.registration.priority ?? 99));
  }

  function listWidgets(): WidgetRegistration[] {
    return [...widgets.values()];
  }

  function listWidgetsForModule(moduleId: string): WidgetRegistration[] {
    return [...widgets.values()].filter(w => w.module_id === moduleId);
  }

  function hasWidget(widgetId: string): boolean {
    return widgets.has(widgetId);
  }

  function registerFromManifest(manifest: { module_id: string; widgets: Array<{ widget_id: string; label: string; slot: string; loadComponent: () => Promise<{ default: React.ComponentType<any> }>; required_permission?: string; priority?: number }> }): void {
    for (const w of manifest.widgets) {
      registerWidget({
        widget_id: w.widget_id,
        label: w.label,
        module_id: manifest.module_id,
        allowed_roles: [],
        contexts: [w.slot as WidgetContext],
        loadComponent: w.loadComponent,
        required_permission: w.required_permission,
        priority: w.priority,
      });
    }
  }

  return {
    registerWidget,
    unregisterWidget,
    resolveWidgets,
    listWidgets,
    listWidgetsForModule,
    hasWidget,
    registerFromManifest,
  };
}
