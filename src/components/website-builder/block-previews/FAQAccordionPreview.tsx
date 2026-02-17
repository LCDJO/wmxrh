import { ChevronDown } from 'lucide-react';
import type { Viewport, BreakpointOverrides } from '@/domains/website-builder/types';

interface FAQItem {
  question: string;
  answer: string;
}

interface Props {
  content: Record<string, unknown>;
  viewport: Viewport;
  breakpoint: BreakpointOverrides;
}

export function FAQAccordionPreview({ content, breakpoint }: Props) {
  const items = (content.items as FAQItem[]) || [];

  return (
    <div className={`space-y-4 ${breakpoint.padding ?? 'p-6'}`}>
      <h3 className="text-lg font-bold font-display text-foreground text-center">
        {(content.title as string) || 'FAQ'}
      </h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-card/60">
            <div className="flex items-center justify-between p-3">
              <span className="text-sm font-medium text-foreground">{item.question}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
            {i === 0 && (
              <div className="px-3 pb-3">
                <p className="text-xs text-muted-foreground">{item.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
