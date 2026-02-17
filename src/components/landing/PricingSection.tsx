import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
  ctaText: string;
  isTrial?: boolean;
}

interface Props {
  plans?: PricingPlan[];
  onPlanSelect?: (planName: string, planPrice?: string) => void;
  onTrialStart?: (planName?: string) => void;
}

const DEFAULT_PLANS: PricingPlan[] = [
  {
    name: 'Starter', price: 'R$ 197', period: '/mês',
    features: ['Até 50 colaboradores', '3 módulos', 'Suporte por email', 'eSocial básico'],
    ctaText: 'Começar grátis', isTrial: true,
  },
  {
    name: 'Professional', price: 'R$ 497', period: '/mês',
    features: ['Até 200 colaboradores', 'Todos os módulos', 'Suporte prioritário', 'eSocial completo', 'API access', 'Relatórios avançados'],
    highlighted: true, ctaText: 'Teste grátis 14 dias', isTrial: true,
  },
  {
    name: 'Enterprise', price: 'Sob consulta', period: '',
    features: ['Colaboradores ilimitados', 'Multi-tenant', 'SLA dedicado', 'Custom branding', 'Onboarding assistido', 'Integração sob medida'],
    ctaText: 'Falar com vendas',
  },
];

export function PricingSection({ plans = DEFAULT_PLANS, onPlanSelect, onTrialStart }: Props) {
  const handleClick = (plan: PricingPlan) => {
    // GTM: plan_selected
    onPlanSelect?.(plan.name, plan.price);
    // GTM: trial_start (if applicable)
    if (plan.isTrial) {
      onTrialStart?.(plan.name);
    }
  };

  return (
    <section className="py-16 px-6 bg-muted/20">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">Planos</h2>
        <p className="text-sm text-muted-foreground text-center mb-10">Escolha o plano ideal para sua empresa</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`rounded-xl border p-6 flex flex-col ${
                plan.highlighted
                  ? 'border-primary bg-card shadow-lg relative'
                  : 'border-border/50 bg-card/60'
              }`}
            >
              {plan.highlighted && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px]">
                  Mais popular
                </Badge>
              )}
              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              <div className="mt-3 mb-5">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <ul className="space-y-2.5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={plan.highlighted ? 'default' : 'outline'}
                onClick={() => handleClick(plan)}
              >
                {plan.ctaText}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
