import type { LPCopyBlueprint } from '@/domains/platform-growth/types';
import { Quote } from 'lucide-react';

interface Props {
  data: LPCopyBlueprint['proof'];
}

export function TestimonialsSection({ data }: Props) {
  return (
    <section className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">O que nossos clientes dizem</h2>
        <p className="text-sm text-muted-foreground text-center mb-10">Empresas que transformaram seu RH</p>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {data.testimonials.map((t, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-3">
              <Quote className="h-5 w-5 text-primary/40" />
              <p className="text-sm text-foreground leading-relaxed italic">"{t.quote}"</p>
              <div>
                <p className="text-xs font-semibold text-foreground">{t.name}</p>
                <p className="text-[10px] text-muted-foreground">{t.role} · {t.company}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          {data.stats.map(s => (
            <div key={s.label} className="text-center p-4 rounded-lg border border-border/40 bg-card/40">
              <p className="text-2xl font-bold text-primary">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Logos + Certifications */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          {data.logos.map(logo => (
            <span key={logo} className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">{logo}</span>
          ))}
          {data.certifications.map(cert => (
            <span key={cert} className="text-[10px] font-medium text-primary/70 border border-primary/20 rounded-full px-3 py-1">{cert}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
