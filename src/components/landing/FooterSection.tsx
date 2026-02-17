import { Button } from '@/components/ui/button';
import type { LPCopyBlueprint } from '@/domains/platform-growth/types';
import { ArrowRight } from 'lucide-react';

interface Props {
  cta: LPCopyBlueprint['cta'];
}

export function FooterSection({ cta }: Props) {
  return (
    <footer className="border-t border-border/40">
      {/* Final CTA */}
      <div className="py-16 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold text-foreground">{cta.headline}</h2>
          <p className="text-sm text-muted-foreground">{cta.subheadline}</p>
          <Button size="lg" className="gap-2 text-base px-8">
            {cta.ctaText} <ArrowRight className="h-4 w-4" />
          </Button>
          {cta.urgency && (
            <p className="text-xs text-primary/70">{cta.urgency}</p>
          )}
        </div>
      </div>

      {/* Footer bottom */}
      <div className="border-t border-border/30 py-6 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Plataforma SaaS. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            {['Termos de Uso', 'Política de Privacidade', 'LGPD', 'Status'].map(link => (
              <a key={link} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{link}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
