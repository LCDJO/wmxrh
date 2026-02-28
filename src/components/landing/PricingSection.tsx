import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles } from 'lucide-react';

type BillingInterval = 'monthly' | 'annual';

interface PricingPlan {
  name: string;
  monthlyPrice: number;
  annualPrice: number;       // total for 12 months (already discounted)
  discountPct: number;       // e.g. 16.67
  features: string[];
  highlighted?: boolean;
  ctaText: string;
  isTrial?: boolean;
  isFree?: boolean;
  isEnterprise?: boolean;
}

interface Props {
  plans?: PricingPlan[];
  onPlanSelect?: (planName: string, planPrice?: string) => void;
  onTrialStart?: (planName?: string) => void;
}

const DEFAULT_PLANS: PricingPlan[] = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    discountPct: 0,
    features: ['Até 5 colaboradores', '4 módulos básicos', 'Suporte comunitário'],
    ctaText: 'Começar grátis',
    isFree: true,
  },
  {
    name: 'Starter',
    monthlyPrice: 99.90,
    annualPrice: 1000,
    discountPct: 16.67,
    features: ['Até 20 colaboradores', '4 módulos', 'Suporte por email', 'eSocial básico'],
    ctaText: 'Começar agora',
    isTrial: true,
  },
  {
    name: 'Professional',
    monthlyPrice: 299.90,
    annualPrice: 2999,
    discountPct: 16.72,
    features: [
      'Até 100 colaboradores',
      'Todos os módulos',
      'Suporte prioritário',
      'eSocial completo',
      'API access',
      'Relatórios avançados',
    ],
    highlighted: true,
    ctaText: 'Teste grátis 14 dias',
    isTrial: true,
  },
  {
    name: 'Enterprise',
    monthlyPrice: 799.90,
    annualPrice: 7999,
    discountPct: 16.68,
    features: [
      'Colaboradores ilimitados',
      'Multi-tenant',
      'SLA dedicado',
      'Custom branding',
      'Onboarding assistido',
      'Integração sob medida',
    ],
    ctaText: 'Falar com vendas',
    isEnterprise: true,
  },
];

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PricingSection({ plans = DEFAULT_PLANS, onPlanSelect, onTrialStart }: Props) {
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  const handleClick = (plan: PricingPlan) => {
    const price = interval === 'monthly'
      ? formatBRL(plan.monthlyPrice)
      : formatBRL(plan.annualPrice);
    onPlanSelect?.(plan.name, price);
    if (plan.isTrial) onTrialStart?.(plan.name);
  };

  const getDisplayPrice = (plan: PricingPlan) => {
    if (plan.isFree) return 'Grátis';
    if (plan.isEnterprise && interval === 'monthly') return formatBRL(plan.monthlyPrice);
    if (interval === 'annual') {
      const perMonth = plan.annualPrice / 12;
      return formatBRL(perMonth);
    }
    return formatBRL(plan.monthlyPrice);
  };

  const getSavings = (plan: PricingPlan) => {
    if (plan.isFree || interval !== 'annual') return null;
    const fullAnnual = plan.monthlyPrice * 12;
    const saved = fullAnnual - plan.annualPrice;
    if (saved <= 0) return null;
    return saved;
  };

  return (
    <section className="py-16 px-6 bg-muted/20">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">
          Planos & Preços
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Escolha o plano ideal para sua empresa
        </p>

        {/* ── Billing Toggle ── */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setInterval('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              interval === 'monthly'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setInterval('annual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              interval === 'annual'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Anual
            <Badge variant="outline" className="text-[10px] border-primary/30 bg-primary/10 text-primary ml-1">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              Economize ~17%
            </Badge>
          </button>
        </div>

        {/* ── Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const savings = getSavings(plan);

            return (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 flex flex-col transition-all ${
                  plan.highlighted
                    ? 'border-primary bg-card shadow-lg relative scale-[1.02]'
                    : 'border-border/50 bg-card/60 hover:border-border'
                }`}
              >
                {plan.highlighted && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px]">
                    Mais popular
                  </Badge>
                )}

                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>

                <div className="mt-3 mb-1">
                  <span className="text-3xl font-bold text-foreground">
                    {getDisplayPrice(plan)}
                  </span>
                  {!plan.isFree && (
                    <span className="text-sm text-muted-foreground">
                      /mês
                    </span>
                  )}
                </div>

                {/* Annual savings callout */}
                {savings && interval === 'annual' ? (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground line-through">
                      {formatBRL(plan.monthlyPrice)}/mês
                    </p>
                    <p className="text-xs font-semibold text-primary">
                      Economia de {formatBRL(savings)}/ano
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Cobrado {formatBRL(plan.annualPrice)} anualmente
                    </p>
                  </div>
                ) : (
                  <div className="mb-4">
                    {!plan.isFree && interval === 'monthly' && (
                      <p className="text-xs text-muted-foreground">
                        ou {formatBRL(plan.annualPrice / 12)}/mês no plano anual
                      </p>
                    )}
                  </div>
                )}

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
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
            );
          })}
        </div>

        {/* ── Trust footer ── */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Sem fidelidade • Cancele a qualquer momento • Todos os preços em BRL
        </p>
      </div>
    </section>
  );
}
