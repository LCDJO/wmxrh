import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
  question: string;
  answer: string;
}

interface Props {
  items?: FAQItem[];
}

const DEFAULT_FAQ: FAQItem[] = [
  { question: 'Quanto tempo leva para implementar?', answer: 'O setup básico leva menos de 5 minutos. A migração completa de dados pode ser feita em até 48h com nossa equipe de onboarding.' },
  { question: 'Preciso de conhecimento técnico?', answer: 'Não. A plataforma foi desenhada para profissionais de RH e DP. Tudo é configurável via interface, sem necessidade de código.' },
  { question: 'Os dados estão seguros?', answer: 'Sim. Utilizamos criptografia end-to-end, isolamento por tenant e somos compliance com LGPD e SOC 2 Type II.' },
  { question: 'Posso cancelar a qualquer momento?', answer: 'Sim. Não há fidelidade. Você pode cancelar ou fazer downgrade do plano quando quiser, sem taxas adicionais.' },
  { question: 'Como funciona o programa de indicação?', answer: 'Compartilhe seu link exclusivo. Para cada empresa que assinar, vocês dois ganham créditos na plataforma. Sem limite de indicações.' },
  { question: 'Vocês integram com eSocial?', answer: 'Sim. Temos integração nativa e homologada com o eSocial, gerando e enviando eventos automaticamente.' },
];

export function FAQSection({ items = DEFAULT_FAQ }: Props) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-16 px-6 bg-muted/20">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">Perguntas frequentes</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">Tire suas dúvidas antes de começar</p>

        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border border-border/50 bg-card/60 overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{item.question}</span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open === i && 'rotate-180')} />
              </button>
              {open === i && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
