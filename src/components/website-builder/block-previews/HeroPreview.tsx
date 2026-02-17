import type { Viewport, BreakpointOverrides } from '@/domains/website-builder/types';
import { getTextAlign } from '@/domains/website-builder/responsive-layout-engine';

interface Props {
  content: Record<string, unknown>;
  viewport: Viewport;
  breakpoint: BreakpointOverrides;
}

export function HeroPreview({ content, viewport, breakpoint }: Props) {
  const align = getTextAlign(breakpoint.textAlign);
  const isCompact = viewport === 'mobile';

  return (
    <div className={`rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 ${breakpoint.padding ?? 'p-8'} ${align} space-y-4`}>
      <h2 className={`font-bold font-display text-foreground ${isCompact ? 'text-xl' : 'text-2xl'}`}>
        {(content.headline as string) || 'Headline'}
      </h2>
      <p className={`text-muted-foreground max-w-lg ${align === 'text-center' ? 'mx-auto' : ''} ${isCompact ? 'text-xs' : 'text-sm'}`}>
        {(content.subheadline as string) || 'Subtítulo'}
      </p>
      <button className={`inline-flex items-center rounded-lg bg-primary text-primary-foreground font-medium ${isCompact ? 'px-4 py-2 text-xs' : 'px-6 py-2.5 text-sm'}`}>
        {(content.ctaText as string) || 'CTA'}
      </button>
    </div>
  );
}
