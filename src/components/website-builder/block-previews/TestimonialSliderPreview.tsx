import { MessageSquareQuote } from 'lucide-react';
import type { Viewport, BreakpointOverrides } from '@/domains/website-builder/types';
import { getGridCols } from '@/domains/website-builder/responsive-layout-engine';

interface Testimonial {
  name: string;
  role: string;
  company: string;
  quote: string;
}

interface Props {
  content: Record<string, unknown>;
  viewport: Viewport;
  breakpoint: BreakpointOverrides;
}

export function TestimonialSliderPreview({ content, breakpoint }: Props) {
  const testimonials = (content.testimonials as Testimonial[]) || [];
  const cols = breakpoint.columns ?? 2;

  return (
    <div className={`space-y-4 ${breakpoint.padding ?? 'p-6'}`}>
      <h3 className="text-lg font-bold font-display text-foreground text-center">
        {(content.title as string) || 'Depoimentos'}
      </h3>
      <div className={`grid gap-3 ${getGridCols(cols)}`}>
        {testimonials.map((t, i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-2">
            <MessageSquareQuote className="h-4 w-4 text-primary/50" />
            <p className="text-xs text-muted-foreground italic">"{t.quote}"</p>
            <div>
              <p className="text-xs font-semibold text-foreground">{t.name}</p>
              <p className="text-[10px] text-muted-foreground">{t.role} — {t.company}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
