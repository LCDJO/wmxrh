import type { LPCopyBlueprint } from '@/domains/platform-growth/types';
import { CheckCircle, ArrowRight, TrendingUp } from 'lucide-react';

interface Props {
  features: LPCopyBlueprint['features'];
  advantages: LPCopyBlueprint['advantages'];
  benefits: LPCopyBlueprint['benefits'];
}

export function FABSection({ features, advantages, benefits }: Props) {
  return (
    <section className="py-16 px-6">
      <div className="max-w-5xl mx-auto space-y-16">
        {/* Features */}
        <div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-2">Features</h2>
          <p className="text-sm text-muted-foreground text-center mb-8">O que a plataforma oferece</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div key={i} className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-2 hover:border-primary/30 transition-colors">
                <CheckCircle className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{f.feature}</h3>
                <p className="text-xs text-muted-foreground">{f.advantage}</p>
                <p className="text-xs text-primary/80 font-medium">{f.benefit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Advantages */}
        <div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-2">Advantages</h2>
          <p className="text-sm text-muted-foreground text-center mb-8">Por que somos diferentes</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {advantages.map((a, i) => (
              <div key={i} className="flex gap-4 rounded-xl border border-border/50 bg-card/60 p-5 hover:border-primary/30 transition-colors">
                <ArrowRight className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-2">Benefits</h2>
          <p className="text-sm text-muted-foreground text-center mb-8">Resultados mensuráveis</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map((b, i) => (
              <div key={i} className="rounded-xl border border-border/50 bg-card/60 p-5 text-center space-y-2 hover:border-primary/30 transition-colors">
                <TrendingUp className="h-5 w-5 text-primary mx-auto" />
                <p className="text-2xl font-bold text-primary">{b.metric}</p>
                <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>
                <p className="text-xs text-muted-foreground">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
