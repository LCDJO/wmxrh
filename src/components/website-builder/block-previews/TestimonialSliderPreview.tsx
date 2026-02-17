import { MessageSquareQuote } from 'lucide-react';

interface Testimonial {
  name: string;
  role: string;
  company: string;
  quote: string;
}

interface Props {
  content: Record<string, unknown>;
}

export function TestimonialSliderPreview({ content }: Props) {
  const testimonials = (content.testimonials as Testimonial[]) || [];

  return (
    <div className="space-y-4 p-6">
      <h3 className="text-lg font-bold font-display text-foreground text-center">
        {(content.title as string) || 'Depoimentos'}
      </h3>
      <div className="grid grid-cols-2 gap-3">
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
