import { Button } from '@/components/ui/button';
import type { LPCopyBlueprint } from '@/domains/platform-growth/types';
import { ArrowRight, Sparkles } from 'lucide-react';

interface Props {
  data: LPCopyBlueprint['hero'];
  onCTAClick?: () => void;
}

export function HeroSection({ data, onCTAClick }: Props) {
  return (
    <section className="relative py-20 px-6 text-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {data.fab.feature}
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-tight">
          {data.headline}
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          {data.subheadline}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button size="lg" className="gap-2 text-base px-8" onClick={onCTAClick}>
            {data.ctaText} <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">Sem cartão de crédito</p>
        </div>

        {/* FAB micro-copy */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 max-w-2xl mx-auto">
          {[
            { label: 'Feature', text: data.fab.feature },
            { label: 'Advantage', text: data.fab.advantage },
            { label: 'Benefit', text: data.fab.benefit },
          ].map(item => (
            <div key={item.label} className="text-left p-3 rounded-lg border border-border/40 bg-card/40">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">{item.label}</p>
              <p className="text-xs text-foreground mt-1">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
