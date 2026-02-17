/**
 * DynamicModuleSlot — Renders all widgets registered for a given slot.
 *
 * Usage:
 *   <DynamicModuleSlot
 *     slot="dashboard"
 *     registry={platformCore.widgets}
 *     renderCtx={{ roles, permissions, tenant_id, feature_flags }}
 *   />
 *
 * Features:
 *   - Lazy-loads each widget with React.Suspense
 *   - Per-widget error boundaries
 *   - Respects roles, permissions, feature flags, viewport
 *   - Configurable layout (grid / flex / stack)
 */

import React, { Suspense, Component, type ReactNode, type ErrorInfo } from 'react';
import type { WidgetContext, WidgetRenderContext, WidgetRegistryAPI } from '../federation/widget-registry';
import { usePlatformWidgets } from './usePlatformWidgets';

// ── Props ──────────────────────────────────────────────────────

export interface DynamicModuleSlotProps {
  /** Which slot to render */
  slot: WidgetContext;
  /** Widget registry instance */
  registry: WidgetRegistryAPI;
  /** Current user/tenant context */
  renderCtx: WidgetRenderContext;
  /** Layout mode */
  layout?: 'grid' | 'flex' | 'stack';
  /** Grid columns (for grid layout) */
  columns?: number;
  /** Gap between widgets (Tailwind spacing) */
  gap?: string;
  /** Custom fallback while widget loads */
  loadingFallback?: ReactNode;
  /** Custom fallback when widget errors */
  errorFallback?: ReactNode;
  /** Custom empty state */
  emptyState?: ReactNode;
  /** Extra class for the container */
  className?: string;
  /** Whether to show widget labels */
  showLabels?: boolean;
}

// ── Widget Error Boundary ──────────────────────────────────────

interface WidgetErrorBoundaryProps {
  widgetId: string;
  fallback?: ReactNode;
  children: ReactNode;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[DynamicModuleSlot] Widget "${this.props.widgetId}" crashed:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">Widget error</p>
          <p className="mt-1 text-xs opacity-70">{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Loading Skeleton ───────────────────────────────────────────

function WidgetSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-muted/30 p-6">
      <div className="h-4 w-1/3 rounded bg-muted mb-3" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}

// ── Layout helpers ─────────────────────────────────────────────

function layoutClass(layout: string, columns: number, gap: string): string {
  switch (layout) {
    case 'grid':
      return `grid grid-cols-1 md:grid-cols-${Math.min(columns, 4)} gap-${gap}`;
    case 'flex':
      return `flex flex-wrap gap-${gap}`;
    case 'stack':
    default:
      return `flex flex-col gap-${gap}`;
  }
}

// ── Component ──────────────────────────────────────────────────

export function DynamicModuleSlot({
  slot,
  registry,
  renderCtx,
  layout = 'grid',
  columns = 2,
  gap = '4',
  loadingFallback,
  errorFallback,
  emptyState,
  className = '',
  showLabels = false,
}: DynamicModuleSlotProps) {
  const { widgets, isEmpty } = usePlatformWidgets({
    registry,
    context: slot,
    renderCtx,
  });

  if (isEmpty) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className={`${layoutClass(layout, columns, gap)} ${className}`.trim()}>
      {widgets.map(({ registration, Component }) => (
        <WidgetErrorBoundary
          key={registration.widget_id}
          widgetId={registration.widget_id}
          fallback={errorFallback}
        >
          {showLabels && (
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {registration.label}
            </p>
          )}
          <Suspense fallback={loadingFallback ?? <WidgetSkeleton />}>
            <Component />
          </Suspense>
        </WidgetErrorBoundary>
      ))}
    </div>
  );
}
