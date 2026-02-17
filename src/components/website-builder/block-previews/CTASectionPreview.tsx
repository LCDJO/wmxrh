import type { Viewport, BreakpointOverrides } from '@/domains/website-builder/types';
import { getTextAlign } from '@/domains/website-builder/responsive-layout-engine';

interface Props {
  content: Record<string, unknown>;
  viewport: Viewport;
  breakpoint: BreakpointOverrides;
}

export function CTASectionPreview({ content, viewport, breakpoint }: Props) {
  const isCompact = viewport === 'mobile';
  const align = getTextAlign(breakpoint.textAlign);

  return (
    <div className={`rounded-lg bg-gradient-to-r from-primary to-primary/80 ${breakpoint.padding ?? 'p-8'} ${align} space-y-3`}>
      <h3 className={`font-bold text-primary-foreground ${isCompact ? 'text-lg' : 'text-xl'}`}>
        {(content.headline as string) || 'CTA'}
      </h3>
      <p className={`text-primary-foreground/80 ${isCompact ? 'text-xs' : 'text-sm'}`}>
        {(content.subheadline as string) || ''}
      </p>
      <button className={`inline-flex items-center rounded-lg bg-background text-foreground font-medium ${isCompact ? 'px-4 py-2 text-xs' : 'px-6 py-2.5 text-sm'}`}>
        {(content.ctaText as string) || 'Ação'}
      </button>
    </div>
  );
}
