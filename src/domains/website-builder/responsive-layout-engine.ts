import type { Viewport, BreakpointOverrides, WebsiteBlock } from '@/domains/website-builder/types';

/**
 * ResponsiveLayoutEngine — resolves per-breakpoint overrides for blocks.
 *
 * Auto-generates mobile/tablet layouts from desktop defaults:
 *  - Multi-column grids collapse to fewer columns
 *  - Horizontal layouts become stacked
 *  - Spacing adjusts automatically
 */

const AUTO_COLUMN_MAP: Record<Viewport, (desktopCols: number) => number> = {
  desktop: (c) => c,
  tablet: (c) => Math.min(c, 2),
  mobile: () => 1,
};

const AUTO_LAYOUT_MAP: Record<Viewport, (desktopLayout: string) => string> = {
  desktop: (l) => l,
  tablet: (l) => l,
  mobile: () => 'vertical',
};

const AUTO_PADDING_MAP: Record<Viewport, string> = {
  desktop: 'p-6',
  tablet: 'p-5',
  mobile: 'p-4',
};

/** Resolve the effective overrides for a block at a given viewport */
export function resolveBreakpoint(
  block: WebsiteBlock,
  viewport: Viewport,
): BreakpointOverrides {
  // Explicit overrides take priority
  const explicit = block.responsive?.[viewport] ?? {};

  // Auto-generate defaults from content
  const desktopCols = (block.content.columns as number) ?? 3;
  const desktopLayout = (block.content.layout as string) ?? 'horizontal';

  const auto: BreakpointOverrides = {
    columns: AUTO_COLUMN_MAP[viewport](desktopCols),
    layout: AUTO_LAYOUT_MAP[viewport](desktopLayout) as BreakpointOverrides['layout'],
    padding: AUTO_PADDING_MAP[viewport],
    textAlign: viewport === 'mobile' ? 'center' : undefined,
    hidden: false,
  };

  return { ...auto, ...explicit };
}

/** Get responsive grid class based on resolved columns */
export function getGridCols(cols: number): string {
  switch (cols) {
    case 1: return 'grid-cols-1';
    case 2: return 'grid-cols-2';
    case 4: return 'grid-cols-4';
    default: return 'grid-cols-3';
  }
}

/** Get text alignment class */
export function getTextAlign(align?: string): string {
  switch (align) {
    case 'left': return 'text-left';
    case 'right': return 'text-right';
    default: return 'text-center';
  }
}
